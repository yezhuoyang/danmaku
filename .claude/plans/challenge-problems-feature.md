# Challenge Research Problems & Ideas - Implementation Plan

## Overview

Create a new page where users can browse, search, and contribute to research problems and ideas generated from AI reading sessions across all papers. Each problem/idea can be marked as Solved/Unsolved and tagged with research areas from the source paper.

**Key Feature: Progress Tree**
- Each research question maintains a hierarchical progress tree
- Each node in the tree is itself a research question (sub-question/sub-problem)
- Research ideas can be linked to any research question as potential approaches
- This allows tracking decomposition of complex problems into smaller solvable parts

---

## Features

### 1. Main Browse Page (`/challenge-problems`)

**Purpose**: Discover and search all public research problems and ideas

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│  🔬 Challenge Research Problems & Ideas                         │
│                                                                 │
│  ┌────────────────────────────────────────────┐ [+ New Problem] │
│  │ 🔍 Search problems and ideas...            │                 │
│  └────────────────────────────────────────────┘                 │
│                                                                 │
│  Type: [All] [Open Questions] [Research Ideas]                  │
│  Status: [All] [Unsolved] [Investigating] [Solved]              │
│  Area: [All] [Quantum Computing] [Machine Learning] [...]       │
│  Sort: [Recent] [Most Discussed] [Most Upvoted]                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟡 UNSOLVED | Open Question | Quantum Computing          │   │
│  │                                                          │   │
│  │ How can quantum error correction be efficiently          │   │
│  │ implemented on NISQ devices?                             │   │
│  │                                                          │   │
│  │ From: "Quantum Circuit Optimization" by Smith et al.     │   │
│  │ Posted by: @researcher1 • 3 days ago                     │   │
│  │                                                          │   │
│  │ 👍 12  💬 5 discussions  🏷️ quantum, error-correction   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟢 SOLVED | Research Idea | Machine Learning             │   │
│  │                                                          │   │
│  │ Combining attention mechanisms with graph neural         │   │
│  │ networks for molecular property prediction               │   │
│  │                                                          │   │
│  │ From: "Attention Is All You Need" by Vaswani et al.     │   │
│  │ Posted by: @mlresearcher • 1 week ago                    │   │
│  │                                                          │   │
│  │ ✅ Solved by: @solver123                                 │   │
│  │ 👍 45  💬 23 discussions  🏷️ attention, GNN, molecules  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Individual Problem Page (`/challenge-problems/:id`)

**Purpose**: Detailed view of a specific problem with progress tree and discussions

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Problems                                              │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🟡 UNSOLVED                                                  │ │
│ │                                                              │ │
│ │ How can quantum error correction be efficiently              │ │
│ │ implemented on NISQ devices?                                 │ │
│ │                                                              │ │
│ │ ────────────────────────────────────────────────────────── │ │
│ │                                                              │ │
│ │ Type: Open Question                                          │ │
│ │ Area: Quantum Computing                                      │ │
│ │ Importance: High                                             │ │
│ │                                                              │ │
│ │ Context:                                                     │ │
│ │ "Current NISQ devices have limited qubit counts and high    │ │
│ │ error rates, making traditional error correction codes      │ │
│ │ impractical..."                                              │ │
│ │                                                              │ │
│ │ Related Topics: surface codes, threshold theorem, LDPC      │ │
│ │                                                              │ │
│ │ Source Paper: "Quantum Circuit Optimization"                 │ │
│ │               View Paper →                                   │ │
│ │                                                              │ │
│ │ Posted by: @researcher1 • Jan 15, 2026                      │ │
│ │ 👍 12  👎 2  [Mark as Solved] [Edit] [Delete]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ─── Progress Tree (3 sub-problems) ───────────── [+ Add Sub-Q] │
│                                                                 │
│  📌 Main Question                                               │
│   │                                                             │
│   ├─🟡 Sub-Q 1: How to reduce qubit overhead?                  │
│   │    │  └─💡 Idea: Use flag qubit technique (linked)         │
│   │    │                                                        │
│   │    ├─🟢 Sub-Q 1.1: Optimal flag placement? [SOLVED]        │
│   │    └─🟡 Sub-Q 1.2: Minimum auxiliary qubits needed?        │
│   │                                                             │
│   ├─🟡 Sub-Q 2: What's the threshold error rate?               │
│   │    └─💡 Idea: Analyze using statistical mechanics          │
│   │                                                             │
│   └─🔴 Sub-Q 3: Hardware implementation challenges?            │
│        └─💡 Idea: Superconducting transmon approach            │
│                                                                 │
│ ─── Linked Research Ideas (2) ────────────────── [+ Link Idea] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 Flag qubit error correction technique                     │ │
│ │    Feasibility: High | Novelty: Moderate                     │ │
│ │    Addresses: Sub-Q 1                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ─── Discussion (5 comments) ───                                 │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ @expert1 • 2 days ago                                       │ │
│ │ This is related to recent work on flag qubits...            │ │
│ │ 👍 3  Reply                                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Add your thoughts...                                   [Post]│ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Create New Problem Page (`/challenge-problems/new`)

**Purpose**: Allow users to manually create research problems/ideas

**Features**:
- Select type: Open Question or Research Idea
- Title and detailed description
- Select research area/tags
- Link to source paper (optional)
- Auto-populate from AI-generated insights (if coming from a paper)

---

## Data Model

### New Database Table: `challenge_problems`

```sql
CREATE TABLE IF NOT EXISTS challenge_problems (
  id TEXT PRIMARY KEY,
  -- Source information
  paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
  history_id TEXT REFERENCES ai_agent_history(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Progress Tree: Hierarchical structure (self-referencing)
  parent_id TEXT REFERENCES challenge_problems(id) ON DELETE CASCADE,
  root_id TEXT REFERENCES challenge_problems(id) ON DELETE CASCADE,  -- Root question of the tree
  depth INTEGER DEFAULT 0,                                            -- Tree depth (0 = root)
  order_index INTEGER DEFAULT 0,                                      -- Sibling order within parent

  -- Problem details
  type TEXT NOT NULL CHECK(type IN ('open_question', 'research_idea')),
  status TEXT NOT NULL DEFAULT 'unsolved' CHECK(status IN ('unsolved', 'investigating', 'solved')),
  title TEXT NOT NULL,
  description TEXT,
  context TEXT,                    -- Where/why this problem matters

  -- For research ideas (additional fields)
  methodology TEXT,
  expected_outcome TEXT,
  feasibility TEXT CHECK(feasibility IN ('high', 'medium', 'low')),
  novelty TEXT CHECK(novelty IN ('incremental', 'moderate', 'breakthrough')),
  prerequisites TEXT,              -- JSON array

  -- Categorization
  importance TEXT CHECK(importance IN ('high', 'medium', 'low')),
  area TEXT,                       -- Primary research area (from paper tags)
  tags TEXT DEFAULT '[]',          -- JSON array of related topics

  -- Solution tracking
  solved_by TEXT REFERENCES users(id),
  solved_at INTEGER,
  solution_summary TEXT,

  -- Engagement metrics
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  child_count INTEGER DEFAULT 0,   -- Number of direct sub-questions
  linked_idea_count INTEGER DEFAULT 0,  -- Number of linked research ideas

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_challenge_problems_paper_id ON challenge_problems(paper_id);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_user_id ON challenge_problems(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_type ON challenge_problems(type);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_status ON challenge_problems(status);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_area ON challenge_problems(area);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_created_at ON challenge_problems(created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_parent_id ON challenge_problems(parent_id);
CREATE INDEX IF NOT EXISTS idx_challenge_problems_root_id ON challenge_problems(root_id);
```

### New Database Table: `challenge_idea_links`

Links research ideas to research questions they address.

```sql
CREATE TABLE IF NOT EXISTS challenge_idea_links (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
  idea_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'addresses' CHECK(relationship IN ('addresses', 'partial', 'inspired_by')),
  notes TEXT,                      -- Optional explanation of how the idea relates
  created_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(question_id, idea_id)     -- Prevent duplicate links
);

CREATE INDEX IF NOT EXISTS idx_challenge_idea_links_question_id ON challenge_idea_links(question_id);
CREATE INDEX IF NOT EXISTS idx_challenge_idea_links_idea_id ON challenge_idea_links(idea_id);
```

### New Database Table: `challenge_comments`

```sql
CREATE TABLE IF NOT EXISTS challenge_comments (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES challenge_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_challenge_comments_problem_id ON challenge_comments(problem_id);
CREATE INDEX IF NOT EXISTS idx_challenge_comments_user_id ON challenge_comments(user_id);
```

### TypeScript Types (shared/types.ts)

```typescript
// Challenge problem status
export type ChallengeProblemStatus = 'unsolved' | 'investigating' | 'solved';
export type ChallengeProblemType = 'open_question' | 'research_idea';
export type IdeaLinkRelationship = 'addresses' | 'partial' | 'inspired_by';

// Challenge problem (combines OpenQuestion and ResearchIdea with metadata)
export interface ChallengeProblem {
  id: string;
  paperId?: string;
  paperTitle?: string;
  historyId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;

  // Progress Tree fields
  parentId?: string;               // Parent question (null for root)
  rootId?: string;                 // Root question of the tree (null for root)
  depth: number;                   // Tree depth (0 = root)
  orderIndex: number;              // Sibling order within parent
  children?: ChallengeProblem[];   // Nested children (populated on detail view)

  type: ChallengeProblemType;
  status: ChallengeProblemStatus;
  title: string;
  description?: string;
  context?: string;

  // Research idea specific
  methodology?: string;
  expectedOutcome?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'incremental' | 'moderate' | 'breakthrough';
  prerequisites?: string[];

  // Categorization
  importance?: 'high' | 'medium' | 'low';
  area?: string;
  tags: string[];

  // Solution tracking
  solvedBy?: string;
  solvedByName?: string;
  solvedAt?: number;
  solutionSummary?: string;

  // Engagement
  upvotes: number;
  downvotes: number;
  commentCount: number;
  childCount: number;              // Number of sub-questions
  linkedIdeaCount: number;         // Number of linked research ideas

  // Linked ideas (populated on detail view)
  linkedIdeas?: ChallengeIdeaLink[];

  createdAt: number;
  updatedAt: number;
}

// Link between a research idea and a research question
export interface ChallengeIdeaLink {
  id: string;
  questionId: string;
  ideaId: string;
  idea?: ChallengeProblem;         // Populated when fetching
  userId: string;
  userName: string;
  relationship: IdeaLinkRelationship;
  notes?: string;
  createdAt: number;
}

// Challenge comment
export interface ChallengeComment {
  id: string;
  problemId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  parentId?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  replies?: ChallengeComment[];
  createdAt: number;
  updatedAt: number;
}

// API Response types
export interface ChallengeProblemsResponse {
  problems: ChallengeProblem[];
  total: number;
}

export interface ChallengeProblemDetailResponse {
  problem: ChallengeProblem;        // Includes nested children[] and linkedIdeas[]
  comments: ChallengeComment[];
  progressTree: ChallengeProblem[]; // Full tree structure (all descendants)
}

// Create/Update request types
export interface CreateChallengeProblemRequest {
  type: ChallengeProblemType;
  title: string;
  description?: string;
  context?: string;
  paperId?: string;
  historyId?: string;
  parentId?: string;               // For creating sub-questions
  methodology?: string;
  expectedOutcome?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'incremental' | 'moderate' | 'breakthrough';
  prerequisites?: string[];
  importance?: 'high' | 'medium' | 'low';
  area?: string;
  tags?: string[];
}

export interface UpdateChallengeProblemRequest {
  status?: ChallengeProblemStatus;
  title?: string;
  description?: string;
  solutionSummary?: string;
  tags?: string[];
  orderIndex?: number;             // For reordering in tree
}

// Link idea to question request
export interface LinkIdeaToQuestionRequest {
  questionId: string;
  ideaId: string;
  relationship: IdeaLinkRelationship;
  notes?: string;
}
```

---

## API Endpoints

### Server Route: `/server/routes/challenges.ts`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/challenges` | List/search root problems (depth=0) | No |
| GET | `/api/challenges/:id` | Get problem with progress tree & linked ideas | No |
| POST | `/api/challenges` | Create new problem (or sub-question if parentId) | Yes |
| PUT | `/api/challenges/:id` | Update problem | Yes (owner) |
| DELETE | `/api/challenges/:id` | Delete problem (cascades to children) | Yes (owner) |
| POST | `/api/challenges/:id/status` | Update status (mark solved) | Yes (owner) |
| POST | `/api/challenges/:id/vote` | Upvote/downvote | Yes |
| **Progress Tree** | | | |
| GET | `/api/challenges/:id/tree` | Get full progress tree | No |
| POST | `/api/challenges/:id/children` | Add sub-question | Yes |
| PUT | `/api/challenges/:id/reorder` | Reorder children | Yes (owner) |
| **Idea Linking** | | | |
| GET | `/api/challenges/:id/ideas` | Get linked ideas for a question | No |
| POST | `/api/challenges/:id/ideas` | Link an idea to this question | Yes |
| DELETE | `/api/challenges/:id/ideas/:linkId` | Remove idea link | Yes (owner) |
| GET | `/api/challenges/:id/questions` | Get questions this idea addresses | No |
| **Comments** | | | |
| GET | `/api/challenges/:id/comments` | Get comments | No |
| POST | `/api/challenges/:id/comments` | Add comment | Yes |
| PUT | `/api/challenges/comments/:id` | Edit comment | Yes (owner) |
| DELETE | `/api/challenges/comments/:id` | Delete comment | Yes (owner) |

### Query Parameters for GET /api/challenges

| Param | Type | Description |
|-------|------|-------------|
| q | string | Search in title, description |
| type | 'open_question' \| 'research_idea' | Filter by type |
| status | 'unsolved' \| 'investigating' \| 'solved' | Filter by status |
| area | string | Filter by research area |
| paperId | string | Filter by source paper |
| userId | string | Filter by author |
| rootOnly | boolean | Only return root problems (default: true) |
| parentId | string | Get children of specific parent |
| sort | 'recent' \| 'popular' \| 'discussed' \| 'tree_progress' | Sort order |
| limit | number | Items per page (default: 20) |
| offset | number | Pagination offset |

**Note**: By default, only root-level problems (depth=0) are returned in the browse view. Sub-questions are accessed via the progress tree on the detail page.

---

## File Structure

```
client/src/pages/
├── ChallengeProblems.tsx        # Main browse page
├── ChallengeProblemDetail.tsx   # Individual problem page (with progress tree)
└── ChallengeProblemNew.tsx      # Create new problem/sub-question page

client/src/components/challenges/
├── ChallengeProblemCard.tsx     # Card component for list
├── ChallengeFilters.tsx         # Filter/search controls
├── ChallengeComments.tsx        # Comments section
├── ProgressTree.tsx             # Collapsible tree view of sub-questions
├── ProgressTreeNode.tsx         # Single node in progress tree
├── LinkedIdeasPanel.tsx         # Panel showing linked research ideas
├── LinkIdeaDialog.tsx           # Dialog to link an idea to a question
└── index.ts                     # Exports

server/routes/
└── challenges.ts                # API endpoints

shared/types.ts                  # Add new types (shown above)
```

---

## Navigation Integration

### Add to Home page and header:

```typescript
// Navigation links
{ href: '/challenge-problems', label: 'Research Challenges', icon: <FlaskConical /> }
```

### Add to Paper Detail page:

When viewing Open Questions or Research Ideas, add button:
```
[📤 Share to Challenge Board]
```

This converts the AI-generated insight into a public challenge problem.

---

## Implementation Steps

### Phase 1: Database & Types
1. Add `challenge_problems` table to `server/db.ts` (with parent_id, root_id, depth)
2. Add `challenge_idea_links` table to `server/db.ts`
3. Add `challenge_comments` table to `server/db.ts`
4. Add TypeScript types to `shared/types.ts`

### Phase 2: Server API - Core
5. Create `server/routes/challenges.ts` with basic CRUD endpoints
6. Implement progress tree endpoints (GET tree, POST children, reorder)
7. Implement idea linking endpoints (link/unlink ideas to questions)
8. Register routes in `server/index.ts`
9. Add API functions to `client/src/lib/api.ts`

### Phase 3: Main Browse Page
10. Create `ChallengeProblems.tsx` with search/filter UI
11. Create `ChallengeProblemCard.tsx` component (shows child_count indicator)
12. Add route to `App.tsx`

### Phase 4: Detail Page with Progress Tree
13. Create `ChallengeProblemDetail.tsx` (main layout)
14. Create `ProgressTree.tsx` (collapsible tree component)
15. Create `ProgressTreeNode.tsx` (recursive tree node with status icons)
16. Create `LinkedIdeasPanel.tsx` (shows ideas linked to this question)
17. Create `LinkIdeaDialog.tsx` (search and link ideas)
18. Create `ChallengeComments.tsx` component
19. Add route to `App.tsx`

### Phase 5: Create Page
20. Create `ChallengeProblemNew.tsx` (supports creating sub-questions)
21. Add route to `App.tsx`

### Phase 6: Integration
22. Add navigation link to Home page header
23. Add "Share to Challenge Board" button in OpenQuestionsSection and ResearchIdeasSection
24. Update existing insights components to link to challenge problems
25. Add "Add Sub-Question" inline action in progress tree

---

## Verification Steps

### Basic Functionality
1. Browse page loads with root-level problems only
2. Search and filters work correctly
3. Can create new problem (logged in)
4. Can view problem detail page
5. Can add comments (logged in)
6. Can upvote/downvote (logged in)
7. Owner can mark as solved
8. Can share AI-generated insight to challenge board

### Progress Tree
9. Can add sub-question to existing question
10. Progress tree displays correctly with proper nesting/indentation
11. Tree nodes show correct status icons (unsolved/investigating/solved)
12. Can expand/collapse tree branches
13. Clicking a sub-question navigates to its detail page
14. Deleting a parent cascades to children

### Idea Linking
15. Can link a research idea to a question
16. Can specify relationship type (addresses/partial/inspired_by)
17. Linked ideas appear in LinkedIdeasPanel
18. Can view which questions an idea addresses
19. Can remove idea link

### UI/UX
20. Mobile responsive layout works
21. Tree view is usable on mobile (collapsible)

---

## Questions to Clarify

1. **Moderation**: Should there be admin approval for new problems?
2. **Notifications**: Notify users when their problem gets solved or commented?
3. **Reputation**: Award points to users who solve problems or link useful ideas?
4. **Linking**: Should solved problems link to papers/resources that provide the solution?
5. **Duplicates**: How to handle duplicate/similar problems?
6. **Tree Permissions**: Should anyone be able to add sub-questions, or only the root question owner?
7. **Tree Depth Limit**: Should there be a maximum depth for the progress tree (e.g., 5 levels)?
8. **Auto-solve propagation**: When all sub-questions are solved, should the parent auto-update to "solved"?

---

## Progress Tree Visual Reference

```
📌 Main Question (root, depth=0)
 │
 ├─🟡 Sub-Q 1 (depth=1, parent_id=root)
 │    │
 │    ├─🟢 Sub-Q 1.1 (depth=2) [SOLVED]
 │    │    └─💡 Linked Idea: "Approach A"
 │    │
 │    └─🟡 Sub-Q 1.2 (depth=2)
 │         └─💡 Linked Idea: "Approach B"
 │
 ├─🔴 Sub-Q 2 (depth=1) [HIGH PRIORITY]
 │    └─💡 Linked Idea: "Novel method"
 │
 └─🟡 Sub-Q 3 (depth=1)

Legend:
📌 = Root question
🟢 = Solved
🟡 = Unsolved/Investigating
🔴 = High importance
💡 = Linked research idea
```

---

Ready for implementation when approved!
