/**
 * Seed famous research challenge problems
 * Run with: npx tsx server/seed-challenges.ts
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'danmaku.db');
const db = new Database(dbPath);

// Get or create a system user for seeding
function getSystemUser() {
  let user = db.prepare('SELECT id FROM users WHERE username = ?').get('system') as any;
  if (!user) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, is_admin)
      VALUES (?, 'system', 'PaperPilot System', 'disabled', 1)
    `).run(id);
    user = { id };
    console.log('Created system user');
  }
  return user.id;
}

interface ProblemSeed {
  title: string;
  description: string;
  context?: string;
  type: 'open_question' | 'research_idea';
  status: 'unsolved' | 'investigating' | 'solved';
  importance: 'high' | 'medium' | 'low';
  area: string;
  tags: string[];
  solutionSummary?: string;
  children?: ProblemSeed[];
}

function createProblem(
  problem: ProblemSeed,
  userId: string,
  parentId: string | null = null,
  rootId: string | null = null,
  depth: number = 0,
  orderIndex: number = 0
): string {
  const id = uuidv4();
  const actualRootId = rootId || (parentId ? null : id);

  db.prepare(`
    INSERT INTO challenge_problems (
      id, user_id, parent_id, root_id, depth, order_index,
      type, status, title, description, context,
      importance, area, tags, solution_summary, child_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    parentId,
    depth === 0 ? null : actualRootId,
    depth,
    orderIndex,
    problem.type,
    problem.status,
    problem.title,
    problem.description,
    problem.context || null,
    problem.importance,
    problem.area,
    JSON.stringify(problem.tags),
    problem.solutionSummary || null,
    problem.children?.length || 0
  );

  // Create children
  if (problem.children) {
    problem.children.forEach((child, idx) => {
      createProblem(
        child,
        userId,
        id,
        depth === 0 ? id : actualRootId,
        depth + 1,
        idx
      );
    });
  }

  return id;
}

// ============================================================================
// Famous Research Problems Data
// ============================================================================

const RESEARCH_PROBLEMS: ProblemSeed[] = [
  // P vs NP Problem
  {
    title: "P vs NP Problem",
    description: "Does P equal NP? Can every problem whose solution can be quickly verified also be quickly solved?",
    context: "One of the seven Millennium Prize Problems. If P=NP, many cryptographic systems would be broken. If P≠NP, there are fundamental limits to efficient computation.",
    type: "open_question",
    status: "unsolved",
    importance: "high",
    area: "Theoretical Computer Science",
    tags: ["complexity-theory", "millennium-prize", "algorithms", "cryptography"],
    children: [
      {
        title: "Proving P ≠ NP via Circuit Lower Bounds",
        description: "Can we prove P ≠ NP by showing that SAT requires super-polynomial sized circuits?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Theoretical Computer Science",
        tags: ["circuit-complexity", "SAT", "lower-bounds"],
        children: [
          {
            title: "Natural Proofs Barrier",
            description: "Razborov-Rudich showed that 'natural' proof techniques cannot prove circuit lower bounds if one-way functions exist.",
            type: "open_question",
            status: "solved",
            importance: "high",
            area: "Theoretical Computer Science",
            tags: ["barriers", "natural-proofs"],
            solutionSummary: "Natural proofs barrier established by Razborov & Rudich (1997). Shows limitations of combinatorial proof techniques."
          },
          {
            title: "Algebrization Barrier",
            description: "Can algebraic techniques overcome the relativization barrier?",
            type: "open_question",
            status: "solved",
            importance: "medium",
            area: "Theoretical Computer Science",
            tags: ["barriers", "algebrization"],
            solutionSummary: "Aaronson & Wigderson (2008) showed algebraic techniques also have inherent limitations."
          }
        ]
      },
      {
        title: "Average-Case Complexity of NP",
        description: "Are NP-complete problems hard on average, or only in worst case?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Theoretical Computer Science",
        tags: ["average-case", "cryptography", "hardness"],
        children: [
          {
            title: "Fine-Grained Complexity",
            description: "Can we prove conditional lower bounds based on hypotheses like SETH?",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Theoretical Computer Science",
            tags: ["SETH", "fine-grained", "conditional-bounds"]
          }
        ]
      },
      {
        title: "Quantum Approaches to P vs NP",
        description: "Can quantum computing help resolve or circumvent P vs NP?",
        type: "open_question",
        status: "investigating",
        importance: "medium",
        area: "Quantum Computing",
        tags: ["quantum", "BQP", "complexity"],
        children: [
          {
            title: "BQP vs NP Relationship",
            description: "Is BQP contained in NP? Can quantum computers solve NP-complete problems efficiently?",
            type: "open_question",
            status: "unsolved",
            importance: "high",
            area: "Quantum Computing",
            tags: ["BQP", "quantum-advantage"]
          }
        ]
      }
    ]
  },

  // Riemann Hypothesis
  {
    title: "Riemann Hypothesis",
    description: "All non-trivial zeros of the Riemann zeta function have real part 1/2.",
    context: "Perhaps the most famous unsolved problem in mathematics. Has profound implications for the distribution of prime numbers.",
    type: "open_question",
    status: "unsolved",
    importance: "high",
    area: "Mathematics",
    tags: ["number-theory", "millennium-prize", "prime-numbers", "analytic-number-theory"],
    children: [
      {
        title: "Computational Verification of Zeros",
        description: "Verify that the first N zeros lie on the critical line.",
        type: "open_question",
        status: "investigating",
        importance: "medium",
        area: "Mathematics",
        tags: ["computation", "zeros", "verification"],
        children: [
          {
            title: "First 10 Trillion Zeros Verified",
            description: "Computational verification of the first 10^13 non-trivial zeros.",
            type: "open_question",
            status: "solved",
            importance: "low",
            area: "Mathematics",
            tags: ["computation", "milestone"],
            solutionSummary: "Xavier Gourdon (2004) verified 10^13 zeros. Platt (2021) extended to 3×10^12 with rigorous bounds."
          }
        ]
      },
      {
        title: "Generalized Riemann Hypothesis",
        description: "Extend RH to Dirichlet L-functions and other zeta functions.",
        type: "open_question",
        status: "unsolved",
        importance: "high",
        area: "Mathematics",
        tags: ["GRH", "L-functions", "generalization"]
      },
      {
        title: "Random Matrix Theory Connection",
        description: "Why do zeros of zeta function correlate with eigenvalues of random matrices?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Mathematics",
        tags: ["random-matrices", "Montgomery", "quantum-chaos"],
        children: [
          {
            title: "Montgomery's Pair Correlation Conjecture",
            description: "The pair correlation of zeta zeros matches GUE random matrices.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Mathematics",
            tags: ["pair-correlation", "GUE"]
          }
        ]
      },
      {
        title: "Connections to Physics",
        description: "Is there a physical system whose spectrum corresponds to Riemann zeros?",
        type: "open_question",
        status: "investigating",
        importance: "medium",
        area: "Mathematical Physics",
        tags: ["Hilbert-Polya", "quantum-mechanics", "spectral-theory"]
      }
    ]
  },

  // High-Temperature Superconductivity
  {
    title: "Room-Temperature Superconductivity",
    description: "Can we achieve superconductivity at room temperature and ambient pressure?",
    context: "Would revolutionize power transmission, computing, transportation, and medical imaging. Current record is ~250K at extreme pressures.",
    type: "open_question",
    status: "investigating",
    importance: "high",
    area: "Condensed Matter Physics",
    tags: ["superconductivity", "materials-science", "energy", "quantum-materials"],
    children: [
      {
        title: "Understanding Cuprate Mechanism",
        description: "What is the pairing mechanism in copper-oxide high-Tc superconductors?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Condensed Matter Physics",
        tags: ["cuprates", "pairing-mechanism", "d-wave"],
        children: [
          {
            title: "Role of Antiferromagnetic Fluctuations",
            description: "Do spin fluctuations mediate Cooper pairing in cuprates?",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Condensed Matter Physics",
            tags: ["spin-fluctuations", "magnetism", "pairing"]
          },
          {
            title: "Pseudogap Phase Understanding",
            description: "What is the nature of the mysterious pseudogap phase?",
            type: "open_question",
            status: "unsolved",
            importance: "high",
            area: "Condensed Matter Physics",
            tags: ["pseudogap", "phase-diagram", "competing-orders"]
          }
        ]
      },
      {
        title: "Hydride Superconductors",
        description: "Can hydrogen-rich materials achieve room-temperature superconductivity?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Condensed Matter Physics",
        tags: ["hydrides", "high-pressure", "hydrogen"],
        children: [
          {
            title: "LaH10 at 250K",
            description: "Lanthanum hydride superconducts at 250K under extreme pressure.",
            type: "open_question",
            status: "solved",
            importance: "medium",
            area: "Condensed Matter Physics",
            tags: ["LaH10", "record", "high-pressure"],
            solutionSummary: "Drozdov et al. (2019) achieved Tc=250K in LaH10 at 170 GPa. Confirmed by multiple groups."
          },
          {
            title: "Reducing Pressure Requirements",
            description: "Can we achieve high-Tc hydride superconductivity at lower pressures?",
            type: "open_question",
            status: "investigating",
            importance: "high",
            area: "Condensed Matter Physics",
            tags: ["pressure", "metastability", "practical-applications"]
          }
        ]
      },
      {
        title: "Novel Material Discovery",
        description: "Can AI/ML help discover new superconducting materials?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Materials Science",
        tags: ["machine-learning", "materials-discovery", "AI"],
        children: [
          {
            title: "Theoretical Predictions from DFT",
            description: "Use density functional theory to predict new superconductors.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Materials Science",
            tags: ["DFT", "ab-initio", "prediction"]
          }
        ]
      }
    ]
  },

  // Quantum Computing / Quantum Error Correction
  {
    title: "Fault-Tolerant Quantum Computing",
    description: "Can we build a practical, fault-tolerant quantum computer?",
    context: "Current quantum computers are noisy and limited. Need error correction and millions of physical qubits for useful computation.",
    type: "open_question",
    status: "investigating",
    importance: "high",
    area: "Quantum Computing",
    tags: ["quantum-computing", "error-correction", "fault-tolerance"],
    children: [
      {
        title: "Reducing Qubit Error Rates",
        description: "Achieve error rates below fault-tolerance threshold (~0.1%).",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Quantum Computing",
        tags: ["error-rates", "coherence", "gates"],
        children: [
          {
            title: "Google's Error Correction Milestone",
            description: "Demonstrate that adding qubits reduces logical error rate.",
            type: "open_question",
            status: "solved",
            importance: "high",
            area: "Quantum Computing",
            tags: ["surface-code", "milestone", "Google"],
            solutionSummary: "Google (2023) demonstrated exponential suppression of errors with surface code, a key milestone for fault tolerance."
          }
        ]
      },
      {
        title: "Scaling to Millions of Qubits",
        description: "How do we manufacture and control millions of qubits?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Quantum Computing",
        tags: ["scaling", "manufacturing", "control"],
        children: [
          {
            title: "Cryogenic Control Electronics",
            description: "Develop control electronics that work at millikelvin temperatures.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Quantum Computing",
            tags: ["cryogenics", "electronics", "control"]
          }
        ]
      },
      {
        title: "Topological Quantum Computing",
        description: "Can topologically protected qubits provide inherent error protection?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Quantum Computing",
        tags: ["topological", "Majorana", "anyons"],
        children: [
          {
            title: "Majorana Fermion Detection",
            description: "Conclusively detect and manipulate Majorana zero modes.",
            type: "open_question",
            status: "investigating",
            importance: "high",
            area: "Quantum Computing",
            tags: ["Majorana", "detection", "Microsoft"]
          }
        ]
      }
    ]
  },

  // Artificial General Intelligence
  {
    title: "Artificial General Intelligence (AGI)",
    description: "Can we create AI systems with human-level general intelligence?",
    context: "Current AI excels at narrow tasks but lacks general reasoning, common sense, and transfer learning capabilities.",
    type: "open_question",
    status: "investigating",
    importance: "high",
    area: "Artificial Intelligence",
    tags: ["AGI", "machine-learning", "intelligence", "reasoning"],
    children: [
      {
        title: "Scaling Laws and Emergence",
        description: "Do larger models naturally develop general intelligence through scale alone?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Artificial Intelligence",
        tags: ["scaling-laws", "emergence", "LLMs"],
        children: [
          {
            title: "GPT-4 Emergent Capabilities",
            description: "Understanding emergent abilities in large language models.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Artificial Intelligence",
            tags: ["emergence", "GPT-4", "capabilities"]
          }
        ]
      },
      {
        title: "Reasoning and Planning in AI",
        description: "How do we give AI systems true reasoning and planning abilities?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Artificial Intelligence",
        tags: ["reasoning", "planning", "symbolic-AI"],
        children: [
          {
            title: "Chain-of-Thought and Beyond",
            description: "Can prompting techniques unlock reasoning in LLMs?",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Artificial Intelligence",
            tags: ["chain-of-thought", "prompting", "reasoning"]
          },
          {
            title: "Neuro-Symbolic Integration",
            description: "Combining neural networks with symbolic reasoning systems.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Artificial Intelligence",
            tags: ["neuro-symbolic", "hybrid", "knowledge-graphs"]
          }
        ]
      },
      {
        title: "AI Alignment and Safety",
        description: "How do we ensure AGI systems are aligned with human values?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Artificial Intelligence",
        tags: ["alignment", "safety", "values"],
        children: [
          {
            title: "Scalable Oversight",
            description: "How do humans oversee AI systems smarter than themselves?",
            type: "open_question",
            status: "unsolved",
            importance: "high",
            area: "Artificial Intelligence",
            tags: ["oversight", "interpretability", "control"]
          },
          {
            title: "RLHF and Alternatives",
            description: "Reinforcement Learning from Human Feedback and its limitations.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Artificial Intelligence",
            tags: ["RLHF", "alignment", "training"],
            solutionSummary: "RLHF demonstrated effective for aligning LLMs (InstructGPT, ChatGPT). Active research on improvements and alternatives."
          }
        ]
      }
    ]
  },

  // Dark Matter
  {
    title: "Nature of Dark Matter",
    description: "What is dark matter made of?",
    context: "~27% of the universe is dark matter, but we don't know what it is. Could be WIMPs, axions, primordial black holes, or something entirely new.",
    type: "open_question",
    status: "unsolved",
    importance: "high",
    area: "Physics",
    tags: ["dark-matter", "cosmology", "particle-physics", "astrophysics"],
    children: [
      {
        title: "WIMP Detection",
        description: "Can we directly detect Weakly Interacting Massive Particles?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Physics",
        tags: ["WIMPs", "direct-detection", "xenon"],
        children: [
          {
            title: "XENONnT and LZ Results",
            description: "Latest constraints from liquid xenon detectors.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Physics",
            tags: ["XENONnT", "LZ", "limits"],
            solutionSummary: "No WIMPs detected yet. XENONnT (2022) and LZ (2023) set strongest exclusion limits, pushing WIMP parameter space."
          }
        ]
      },
      {
        title: "Axion Searches",
        description: "Are axions the dark matter particle?",
        type: "open_question",
        status: "investigating",
        importance: "high",
        area: "Physics",
        tags: ["axions", "ADMX", "haloscopes"],
        children: [
          {
            title: "ADMX Sensitivity Improvements",
            description: "Axion Dark Matter eXperiment reaching QCD axion sensitivity.",
            type: "open_question",
            status: "investigating",
            importance: "medium",
            area: "Physics",
            tags: ["ADMX", "quantum-sensing"]
          }
        ]
      },
      {
        title: "Modified Gravity Alternatives",
        description: "Can modified gravity theories explain dark matter observations?",
        type: "open_question",
        status: "investigating",
        importance: "medium",
        area: "Physics",
        tags: ["MOND", "modified-gravity", "alternative"],
        children: [
          {
            title: "Bullet Cluster Constraint",
            description: "The Bullet Cluster strongly disfavors purely modified gravity explanations.",
            type: "open_question",
            status: "solved",
            importance: "medium",
            area: "Physics",
            tags: ["bullet-cluster", "constraint", "observation"],
            solutionSummary: "Bullet Cluster (2006) showed dark matter separating from baryonic matter during collision, strong evidence for particle dark matter."
          }
        ]
      }
    ]
  }
];

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('Seeding challenge problems...\n');

  const userId = getSystemUser();

  // Check if problems already exist
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM challenge_problems').get() as any).count;
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} challenge problems.`);
    console.log('To re-seed, delete existing problems first.');
    console.log('Run: DELETE FROM challenge_problems;');
    return;
  }

  let totalCreated = 0;

  for (const problem of RESEARCH_PROBLEMS) {
    console.log(`Creating: ${problem.title}`);
    createProblem(problem, userId);

    // Count this tree
    function countTree(p: ProblemSeed): number {
      let count = 1;
      if (p.children) {
        for (const child of p.children) {
          count += countTree(child);
        }
      }
      return count;
    }
    const treeSize = countTree(problem);
    totalCreated += treeSize;
    console.log(`  -> Created ${treeSize} problems in this tree\n`);
  }

  console.log(`\nDone! Created ${totalCreated} challenge problems total.`);
  console.log('\nTrees created:');
  RESEARCH_PROBLEMS.forEach(p => console.log(`  - ${p.title}`));
}

main();
