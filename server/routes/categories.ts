import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth, requireAdmin } from './auth.js';
import type {
  Category,
  CategoryWithChildren,
  CategoryTreeResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ReorderCategoriesRequest,
} from '../../shared/types.js';

const router = Router();

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Helper to build category tree from flat list
function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const categoryMap = new Map<string, CategoryWithChildren>();
  const rootCategories: CategoryWithChildren[] = [];

  // First pass: create all nodes
  for (const cat of categories) {
    categoryMap.set(cat.id, { ...cat, children: [] });
  }

  // Second pass: build tree structure
  for (const cat of categories) {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else {
      rootCategories.push(node);
    }
  }

  // Sort children by orderIndex
  const sortChildren = (nodes: CategoryWithChildren[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(rootCategories);

  return rootCategories;
}

// GET /api/categories - Get category tree with paper counts
router.get('/', (_req: Request, res: Response) => {
  try {
    // Get all categories
    const categories = db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM paper_categories pc WHERE pc.category_id = c.id) as paper_count
      FROM categories c
      ORDER BY c.depth, c.order_index
    `).all() as any[];

    const formattedCategories: Category[] = categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parent_id,
      depth: c.depth,
      path: c.path,
      orderIndex: c.order_index,
      paperCount: c.paper_count || 0,
      icon: c.icon,
      color: c.color,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    const tree = buildCategoryTree(formattedCategories);
    const totalPapers = (db.prepare('SELECT COUNT(*) as count FROM papers').get() as any).count;

    const response: CategoryTreeResponse = {
      categories: tree,
      totalPapers,
    };

    res.json(response);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get categories' });
  }
});

// GET /api/categories/flat - Get flat list of all categories
router.get('/flat', (_req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM paper_categories pc WHERE pc.category_id = c.id) as paper_count
      FROM categories c
      ORDER BY c.path
    `).all() as any[];

    const formattedCategories: Category[] = categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parent_id,
      depth: c.depth,
      path: c.path,
      orderIndex: c.order_index,
      paperCount: c.paper_count || 0,
      icon: c.icon,
      color: c.color,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    res.json({ categories: formattedCategories });
  } catch (error) {
    console.error('Get flat categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get categories' });
  }
});

// GET /api/categories/:id - Get single category with children
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM paper_categories pc WHERE pc.category_id = c.id) as paper_count
      FROM categories c
      WHERE c.id = ?
    `).get(id) as any;

    if (!category) {
      return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
    }

    // Get children
    const children = db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM paper_categories pc WHERE pc.category_id = c.id) as paper_count
      FROM categories c
      WHERE c.parent_id = ?
      ORDER BY c.order_index
    `).all(id) as any[];

    const formattedCategory: CategoryWithChildren = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parent_id,
      depth: category.depth,
      path: category.path,
      orderIndex: category.order_index,
      paperCount: category.paper_count || 0,
      icon: category.icon,
      color: category.color,
      createdAt: category.created_at,
      updatedAt: category.updated_at,
      children: children.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: c.parent_id,
        depth: c.depth,
        path: c.path,
        orderIndex: c.order_index,
        paperCount: c.paper_count || 0,
        icon: c.icon,
        color: c.color,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        children: [],
      })),
    };

    res.json(formattedCategory);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get category' });
  }
});

// POST /api/categories - Create new category (admin only)
router.post('/', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { name, slug, description, parentId, icon, color } = req.body as CreateCategoryRequest;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Category name is required' });
    }

    const categoryId = uuidv4();
    const categorySlug = slug || generateSlug(name);

    // Check if slug already exists
    const existingSlug = db.prepare('SELECT id FROM categories WHERE slug = ?').get(categorySlug);
    if (existingSlug) {
      return res.status(400).json({ error: 'Bad Request', message: 'Category slug already exists' });
    }

    // Calculate depth and path based on parent
    let depth = 0;
    let path = `/${categorySlug}`;

    if (parentId) {
      const parent = db.prepare('SELECT depth, path FROM categories WHERE id = ?').get(parentId) as any;
      if (!parent) {
        return res.status(400).json({ error: 'Bad Request', message: 'Parent category not found' });
      }
      depth = parent.depth + 1;
      path = `${parent.path}/${categorySlug}`;
    }

    // Get next order index among siblings
    const maxOrder = db.prepare(`
      SELECT MAX(order_index) as max_order FROM categories WHERE parent_id ${parentId ? '= ?' : 'IS NULL'}
    `).get(parentId || undefined) as any;
    const orderIndex = (maxOrder?.max_order ?? -1) + 1;

    db.prepare(`
      INSERT INTO categories (id, name, slug, description, parent_id, depth, path, order_index, icon, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(categoryId, name.trim(), categorySlug, description || null, parentId || null, depth, path, orderIndex, icon || null, color || null);

    const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as any;

    res.status(201).json({
      id: newCategory.id,
      name: newCategory.name,
      slug: newCategory.slug,
      description: newCategory.description,
      parentId: newCategory.parent_id,
      depth: newCategory.depth,
      path: newCategory.path,
      orderIndex: newCategory.order_index,
      paperCount: 0,
      icon: newCategory.icon,
      color: newCategory.color,
      createdAt: newCategory.created_at,
      updatedAt: newCategory.updated_at,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create category' });
  }
});

// PATCH /api/categories/:id - Update category (admin only)
router.patch('/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, description, parentId, orderIndex, icon, color } = req.body as UpdateCategoryRequest;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (slug !== undefined) {
      // Check if new slug conflicts
      const existingSlug = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id);
      if (existingSlug) {
        return res.status(400).json({ error: 'Bad Request', message: 'Category slug already exists' });
      }
      updates.push('slug = ?');
      params.push(slug);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon);
    }

    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (orderIndex !== undefined) {
      updates.push('order_index = ?');
      params.push(orderIndex);
    }

    // Handle parent change (more complex - need to update path and depth)
    if (parentId !== undefined && parentId !== existing.parent_id) {
      let newDepth = 0;
      let newPath = `/${slug || existing.slug}`;

      if (parentId) {
        // Prevent circular reference
        if (parentId === id) {
          return res.status(400).json({ error: 'Bad Request', message: 'Category cannot be its own parent' });
        }
        const parent = db.prepare('SELECT depth, path FROM categories WHERE id = ?').get(parentId) as any;
        if (!parent) {
          return res.status(400).json({ error: 'Bad Request', message: 'Parent category not found' });
        }
        newDepth = parent.depth + 1;
        newPath = `${parent.path}/${slug || existing.slug}`;
      }

      updates.push('parent_id = ?, depth = ?, path = ?');
      params.push(parentId || null, newDepth, newPath);

      // TODO: Also update all children's paths and depths recursively
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(Math.floor(Date.now() / 1000));
      params.push(id);

      db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM paper_categories pc WHERE pc.category_id = c.id) as paper_count
      FROM categories c WHERE c.id = ?
    `).get(id) as any;

    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      parentId: updated.parent_id,
      depth: updated.depth,
      path: updated.path,
      orderIndex: updated.order_index,
      paperCount: updated.paper_count || 0,
      icon: updated.icon,
      color: updated.color,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete category (admin only)
router.delete('/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
    }

    // Check if category has children
    const childCount = (db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(id) as any).count;
    if (childCount > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete category with children. Delete or move children first.'
      });
    }

    // Delete category (paper_categories will cascade)
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete category' });
  }
});

// POST /api/categories/reorder - Reorder categories (admin only)
router.post('/reorder', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { categoryId, newParentId, newOrderIndex } = req.body as ReorderCategoriesRequest;

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as any;
    if (!category) {
      return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
    }

    // Update order among siblings
    if (newParentId === category.parent_id) {
      // Same parent, just reorder
      db.prepare(`
        UPDATE categories
        SET order_index = order_index + 1
        WHERE parent_id ${newParentId ? '= ?' : 'IS NULL'} AND order_index >= ? AND id != ?
      `).run(...(newParentId ? [newParentId] : []), newOrderIndex, categoryId);

      db.prepare('UPDATE categories SET order_index = ?, updated_at = ? WHERE id = ?')
        .run(newOrderIndex, Math.floor(Date.now() / 1000), categoryId);
    } else {
      // Different parent, need to update path and depth too
      let newDepth = 0;
      let newPath = `/${category.slug}`;

      if (newParentId) {
        const parent = db.prepare('SELECT depth, path FROM categories WHERE id = ?').get(newParentId) as any;
        if (!parent) {
          return res.status(400).json({ error: 'Bad Request', message: 'New parent category not found' });
        }
        newDepth = parent.depth + 1;
        newPath = `${parent.path}/${category.slug}`;
      }

      db.prepare(`
        UPDATE categories
        SET parent_id = ?, depth = ?, path = ?, order_index = ?, updated_at = ?
        WHERE id = ?
      `).run(newParentId || null, newDepth, newPath, newOrderIndex, Math.floor(Date.now() / 1000), categoryId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reorder categories' });
  }
});

// ============================================================================
// PAPER-CATEGORY MANAGEMENT
// ============================================================================

// GET /api/categories/:id/papers - Get papers in a category
router.get('/:id/papers', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0, includeChildren } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offsetNum = parseInt(offset as string) || 0;

    // Check if category exists
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!category) {
      return res.status(404).json({ error: 'Not Found', message: 'Category not found' });
    }

    let categoryIds = [id];

    // If includeChildren, get all descendant category IDs
    if (includeChildren === 'true') {
      const descendants = db.prepare(`
        SELECT id FROM categories WHERE path LIKE ?
      `).all(`${category.path}/%`) as any[];
      categoryIds = [id, ...descendants.map(d => d.id)];
    }

    const placeholders = categoryIds.map(() => '?').join(',');

    const papers = db.prepare(`
      SELECT DISTINCT p.*,
        u.display_name as uploader_name,
        u.username as uploader_username,
        u.avatar as uploader_avatar,
        (SELECT COUNT(DISTINCT user_id) FROM reading_sessions WHERE paper_id = p.id) as reader_count,
        (SELECT COUNT(*) FROM annotations WHERE paper_id = p.id) as annotation_count,
        (SELECT 1 FROM ai_analysis WHERE paper_id = p.id) as has_ai_analysis
      FROM papers p
      LEFT JOIN users u ON p.added_by = u.id
      INNER JOIN paper_categories pc ON p.id = pc.paper_id
      WHERE pc.category_id IN (${placeholders})
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...categoryIds, limitNum, offsetNum) as any[];

    const total = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM papers p
      INNER JOIN paper_categories pc ON p.id = pc.paper_id
      WHERE pc.category_id IN (${placeholders})
    `).get(...categoryIds) as any;

    res.json({
      papers: papers.map(p => ({
        id: p.id,
        arxivId: p.arxiv_id,
        contentHash: p.content_hash,
        title: p.title,
        authors: p.authors ? JSON.parse(p.authors) : [],
        abstract: p.abstract,
        addedBy: p.added_by,
        viewCount: p.view_count,
        tags: p.tags ? JSON.parse(p.tags) : [],
        createdAt: p.created_at,
        readerCount: p.reader_count || 0,
        annotationCount: p.annotation_count || 0,
        hasAiAnalysis: !!p.has_ai_analysis,
        uploaderName: p.uploader_name,
        uploaderUsername: p.uploader_username,
        uploaderAvatar: p.uploader_avatar,
      })),
      total: total.count,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        path: category.path,
      },
    });
  } catch (error) {
    console.error('Get category papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get papers' });
  }
});

// POST /api/papers/:paperId/categories - Add paper to categories
router.post('/papers/:paperId/categories', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const { categoryIds } = req.body;
    const user = (req as any).user;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'categoryIds array is required' });
    }

    // Check paper exists and user is uploader or admin
    const paper = db.prepare('SELECT added_by FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (paper.added_by !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the uploader can manage paper categories' });
    }

    // Verify all categories exist
    for (const catId of categoryIds) {
      const exists = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(catId);
      if (!exists) {
        return res.status(400).json({ error: 'Bad Request', message: `Category ${catId} not found` });
      }
    }

    // Add paper to categories
    const insertStmt = db.prepare('INSERT OR IGNORE INTO paper_categories (paper_id, category_id) VALUES (?, ?)');
    for (const catId of categoryIds) {
      insertStmt.run(paperId, catId);
    }

    // Return updated categories for the paper
    const paperCategories = db.prepare(`
      SELECT c.* FROM categories c
      INNER JOIN paper_categories pc ON c.id = pc.category_id
      WHERE pc.paper_id = ?
    `).all(paperId) as any[];

    res.json({
      success: true,
      categories: paperCategories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        path: c.path,
      })),
    });
  } catch (error) {
    console.error('Add paper to categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add paper to categories' });
  }
});

// DELETE /api/papers/:paperId/categories/:categoryId - Remove paper from category
router.delete('/papers/:paperId/categories/:categoryId', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId, categoryId } = req.params;
    const user = (req as any).user;

    // Check paper exists and user is uploader or admin
    const paper = db.prepare('SELECT added_by FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (paper.added_by !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the uploader can manage paper categories' });
    }

    db.prepare('DELETE FROM paper_categories WHERE paper_id = ? AND category_id = ?').run(paperId, categoryId);

    res.json({ success: true });
  } catch (error) {
    console.error('Remove paper from category error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove paper from category' });
  }
});

// GET /api/papers/:paperId/categories - Get categories for a paper
router.get('/papers/:paperId/categories', (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;

    const categories = db.prepare(`
      SELECT c.* FROM categories c
      INNER JOIN paper_categories pc ON c.id = pc.category_id
      WHERE pc.paper_id = ?
      ORDER BY c.path
    `).all(paperId) as any[];

    res.json({
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: c.parent_id,
        depth: c.depth,
        path: c.path,
        icon: c.icon,
        color: c.color,
      })),
    });
  } catch (error) {
    console.error('Get paper categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get paper categories' });
  }
});

// ============================================================================
// AI AUTO-CATEGORIZATION
// ============================================================================

// POST /api/categories/ai/suggest - Get AI suggestions for paper categories
router.post('/ai/suggest', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { paperId, apiKey, model = 'gpt-4o-mini' } = req.body;

    if (!paperId) {
      return res.status(400).json({ error: 'Bad Request', message: 'paperId is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'apiKey is required' });
    }

    // Get paper details
    const paper = db.prepare(`
      SELECT id, title, abstract, authors, tags FROM papers WHERE id = ?
    `).get(paperId) as any;

    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Get all categories (flat list)
    const categories = db.prepare(`
      SELECT id, name, slug, parent_id, depth, path FROM categories ORDER BY path
    `).all() as any[];

    // Build category list for AI prompt
    const categoryList = categories.map(c => {
      const indent = '  '.repeat(c.depth);
      return `${indent}- ${c.name} (id: ${c.id})`;
    }).join('\n');

    // Prepare paper info for AI
    const paperInfo = {
      title: paper.title,
      abstract: paper.abstract || 'No abstract available',
      authors: paper.authors ? JSON.parse(paper.authors).join(', ') : 'Unknown',
      tags: paper.tags ? JSON.parse(paper.tags).join(', ') : 'None',
    };

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an academic paper categorization assistant. Your task is to suggest the most appropriate categories for a research paper based on its title and abstract.

Available categories (hierarchical):
${categoryList}

Rules:
1. Select 1-4 most relevant categories
2. Prefer specific subcategories over broad parent categories when appropriate
3. Only suggest categories from the provided list
4. Return ONLY a JSON object with the format: {"categoryIds": ["id1", "id2"], "reasoning": "brief explanation"}
5. Do not include any other text, just the JSON object`
          },
          {
            role: 'user',
            content: `Please categorize this paper:

Title: ${paperInfo.title}

Abstract: ${paperInfo.abstract}

Authors: ${paperInfo.authors}

Existing tags: ${paperInfo.tags}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({
        error: 'AI Error',
        message: errorData.error?.message || 'Failed to get AI suggestions'
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse AI response
    let suggestions: { categoryIds: string[]; reasoning: string };
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      suggestions = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return res.status(500).json({
        error: 'AI Error',
        message: 'Failed to parse AI suggestions'
      });
    }

    // Validate suggested category IDs
    const validCategoryIds = new Set(categories.map(c => c.id));
    const validSuggestions = suggestions.categoryIds.filter(id => validCategoryIds.has(id));

    // Get full category info for suggestions
    const suggestedCategories = validSuggestions.map(id => {
      const cat = categories.find(c => c.id === id);
      return cat ? {
        id: cat.id,
        name: cat.name,
        path: cat.path,
      } : null;
    }).filter(Boolean);

    res.json({
      paperId,
      paperTitle: paper.title,
      suggestions: suggestedCategories,
      reasoning: suggestions.reasoning,
      tokensUsed: aiResponse.usage?.total_tokens || 0,
    });
  } catch (error) {
    console.error('AI suggest categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI suggestions' });
  }
});

// POST /api/categories/ai/apply - Apply AI-suggested categories to a paper
router.post('/ai/apply', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { paperId, categoryIds } = req.body;

    if (!paperId || !Array.isArray(categoryIds)) {
      return res.status(400).json({ error: 'Bad Request', message: 'paperId and categoryIds array required' });
    }

    // Verify paper exists
    const paper = db.prepare('SELECT id FROM papers WHERE id = ?').get(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Clear existing categories for this paper
    db.prepare('DELETE FROM paper_categories WHERE paper_id = ?').run(paperId);

    // Add new categories
    const insertStmt = db.prepare('INSERT OR IGNORE INTO paper_categories (paper_id, category_id) VALUES (?, ?)');
    for (const catId of categoryIds) {
      insertStmt.run(paperId, catId);
    }

    // Return updated categories
    const updatedCategories = db.prepare(`
      SELECT c.id, c.name, c.slug, c.path, c.icon, c.color
      FROM categories c
      INNER JOIN paper_categories pc ON c.id = pc.category_id
      WHERE pc.paper_id = ?
    `).all(paperId) as any[];

    res.json({
      success: true,
      paperId,
      categories: updatedCategories,
    });
  } catch (error) {
    console.error('Apply AI categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to apply categories' });
  }
});

// POST /api/categories/ai/bulk-suggest - Get AI suggestions for multiple papers
router.post('/ai/bulk-suggest', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { paperIds, apiKey, model = 'gpt-4o-mini' } = req.body;

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'paperIds array is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'apiKey is required' });
    }

    // Limit to 20 papers at a time
    const limitedPaperIds = paperIds.slice(0, 20);

    // Get papers
    const placeholders = limitedPaperIds.map(() => '?').join(',');
    const papers = db.prepare(`
      SELECT id, title, abstract, authors, tags FROM papers WHERE id IN (${placeholders})
    `).all(...limitedPaperIds) as any[];

    // Get all categories
    const categories = db.prepare(`
      SELECT id, name, slug, parent_id, depth, path FROM categories ORDER BY path
    `).all() as any[];

    const categoryList = categories.map(c => {
      const indent = '  '.repeat(c.depth);
      return `${indent}- ${c.name} (id: ${c.id})`;
    }).join('\n');

    // Process each paper
    const results: any[] = [];
    let totalTokens = 0;

    for (const paper of papers) {
      const paperInfo = {
        title: paper.title,
        abstract: paper.abstract || 'No abstract available',
      };

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `You are an academic paper categorization assistant. Suggest 1-4 most relevant categories for each paper.

Available categories:
${categoryList}

Return ONLY JSON: {"categoryIds": ["id1", "id2"], "reasoning": "brief reason"}`
              },
              {
                role: 'user',
                content: `Title: ${paperInfo.title}\n\nAbstract: ${paperInfo.abstract}`
              }
            ],
            temperature: 0.3,
            max_tokens: 300,
          }),
        });

        if (response.ok) {
          const aiResponse = await response.json();
          const content = aiResponse.choices?.[0]?.message?.content || '';
          totalTokens += aiResponse.usage?.total_tokens || 0;

          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            const validCategoryIds = new Set(categories.map(c => c.id));
            const validSuggestions = suggestions.categoryIds.filter((id: string) => validCategoryIds.has(id));

            results.push({
              paperId: paper.id,
              paperTitle: paper.title,
              suggestions: validSuggestions.map((id: string) => {
                const cat = categories.find(c => c.id === id);
                return cat ? { id: cat.id, name: cat.name, path: cat.path } : null;
              }).filter(Boolean),
              reasoning: suggestions.reasoning,
              status: 'success',
            });
          } else {
            results.push({
              paperId: paper.id,
              paperTitle: paper.title,
              suggestions: [],
              status: 'parse_error',
            });
          }
        } else {
          results.push({
            paperId: paper.id,
            paperTitle: paper.title,
            suggestions: [],
            status: 'api_error',
          });
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        results.push({
          paperId: paper.id,
          paperTitle: paper.title,
          suggestions: [],
          status: 'error',
        });
      }
    }

    res.json({
      results,
      totalTokens,
      processed: results.length,
      total: paperIds.length,
    });
  } catch (error) {
    console.error('Bulk AI suggest error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process bulk suggestions' });
  }
});

// POST /api/categories/ai/bulk-apply - Apply categories to multiple papers at once
router.post('/ai/bulk-apply', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'Bad Request', message: 'assignments array required' });
    }

    // assignments is array of { paperId, categoryIds }
    const insertStmt = db.prepare('INSERT OR IGNORE INTO paper_categories (paper_id, category_id) VALUES (?, ?)');
    const deleteStmt = db.prepare('DELETE FROM paper_categories WHERE paper_id = ?');

    let applied = 0;
    for (const { paperId, categoryIds } of assignments) {
      if (paperId && Array.isArray(categoryIds) && categoryIds.length > 0) {
        deleteStmt.run(paperId);
        for (const catId of categoryIds) {
          insertStmt.run(paperId, catId);
        }
        applied++;
      }
    }

    res.json({
      success: true,
      applied,
      total: assignments.length,
    });
  } catch (error) {
    console.error('Bulk apply categories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to apply categories' });
  }
});

export default router;
