# AI Research Debate Feature - Implementation Plan

## Overview

Create a new page for conducting AI-powered research debates with three agents:
- **Affirmative Agent** (Pro side)
- **Negative Agent** (Con side)
- **Judge Agent** (Moderator & Final Decision)

Users provide API keys, set debate topics, and watch autonomous multi-agent conversations with the ability to intervene.

---

## 1. Database Schema

### New Table: `debate_sessions`

```sql
CREATE TABLE debate_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,                    -- Debate topic title
  topic TEXT NOT NULL,                    -- Full debate proposition
  status TEXT DEFAULT 'setup',            -- setup | active | paused | concluded

  -- Agent configurations (JSON)
  affirmative_config TEXT NOT NULL,       -- {modelId, systemPrompt, apiKeyEncrypted}
  negative_config TEXT NOT NULL,          -- {modelId, systemPrompt, apiKeyEncrypted}
  judge_config TEXT NOT NULL,             -- {modelId, systemPrompt, apiKeyEncrypted}

  -- Conversation state
  messages TEXT DEFAULT '[]',             -- JSON array of all messages
  current_speaker TEXT,                   -- 'affirmative' | 'negative' | 'judge' | 'user'
  turn_count INTEGER DEFAULT 0,
  max_turns INTEGER DEFAULT 20,           -- Auto-conclude after this many turns

  -- Background knowledge
  background_knowledge TEXT,              -- User-provided context
  paper_ids TEXT DEFAULT '[]',            -- JSON array of linked paper IDs

  -- Conclusion
  conclusion TEXT,                        -- Judge's final verdict
  concluded_at INTEGER,

  -- Token tracking
  total_tokens_affirmative INTEGER DEFAULT 0,
  total_tokens_negative INTEGER DEFAULT 0,
  total_tokens_judge INTEGER DEFAULT 0,

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_debate_sessions_user ON debate_sessions(user_id);
CREATE INDEX idx_debate_sessions_status ON debate_sessions(status);
```

### Message Format (JSON in `messages` column)

```typescript
interface DebateMessage {
  id: string;
  speaker: 'affirmative' | 'negative' | 'judge' | 'user';
  content: string;
  timestamp: number;
  tokenCount?: number;
  isInterruption?: boolean;      // True if judge interrupted or user intervened
  metadata?: {
    reasoning?: string;          // Internal reasoning (for judge)
    citations?: string[];        // Paper references used
  };
}
```

---

## 2. API Endpoints

### `POST /api/debates` - Create new debate session
```typescript
Request: {
  title: string;
  topic: string;
  affirmativeConfig: { modelId: string; apiKey?: string; };
  negativeConfig: { modelId: string; apiKey?: string; };
  judgeConfig: { modelId: string; apiKey?: string; };
  backgroundKnowledge?: string;
  paperIds?: string[];
  maxTurns?: number;
}
Response: DebateSession
```

### `GET /api/debates` - List user's debate sessions
### `GET /api/debates/:id` - Get debate session details
### `DELETE /api/debates/:id` - Delete debate session

### `POST /api/debates/:id/start` - Start the debate
- Changes status from 'setup' to 'active'
- Validates all API keys are set
- Triggers first turn (affirmative opening)

### `POST /api/debates/:id/continue` - Continue to next turn
- Auto-advances conversation
- Returns new message + updated session

### `POST /api/debates/:id/pause` - Pause auto-continuation
### `POST /api/debates/:id/resume` - Resume auto-continuation

### `POST /api/debates/:id/intervene` - User intervention
```typescript
Request: {
  message: string;
  targetAgent?: 'affirmative' | 'negative' | 'judge' | 'all';
}
```

### `POST /api/debates/:id/conclude` - Force conclusion
- Asks judge to deliver final verdict

### `PATCH /api/debates/:id/config` - Update agent prompts (setup phase only)

---

## 3. Default Agent Prompts

### Affirmative Agent System Prompt
```
You are the AFFIRMATIVE debater in an academic research debate. Your role is to argue IN FAVOR of the proposition.

DEBATE TOPIC: {topic}

YOUR OBJECTIVES:
1. Present compelling arguments supporting the proposition
2. Use evidence, logic, and research to support your claims
3. Respond to counterarguments from the negative side
4. Maintain academic rigor and intellectual honesty
5. Cite provided background materials when relevant

DEBATE RULES:
- Stay focused on the topic
- Be respectful but assertive
- Acknowledge valid counterpoints while defending your position
- Keep responses concise (200-400 words per turn)
- Do not repeat arguments already made

{backgroundKnowledge}

{paperContext}
```

### Negative Agent System Prompt
```
You are the NEGATIVE debater in an academic research debate. Your role is to argue AGAINST the proposition.

DEBATE TOPIC: {topic}

YOUR OBJECTIVES:
1. Present compelling arguments opposing the proposition
2. Challenge the affirmative's claims with evidence and logic
3. Identify weaknesses in pro-arguments
4. Maintain academic rigor and intellectual honesty
5. Cite provided background materials when relevant

DEBATE RULES:
- Stay focused on the topic
- Be respectful but assertive
- Acknowledge valid points while maintaining your position
- Keep responses concise (200-400 words per turn)
- Do not repeat arguments already made

{backgroundKnowledge}

{paperContext}
```

### Judge Agent System Prompt
```
You are the JUDGE in an academic research debate. Your role is to moderate and ultimately decide the debate.

DEBATE TOPIC: {topic}

YOUR RESPONSIBILITIES:
1. Monitor the debate for rule violations
2. Intervene if arguments become off-topic or circular
3. Ensure both sides get fair opportunity to speak
4. Track the strength of arguments from both sides
5. Deliver a final verdict when the debate concludes

INTERVENTION TRIGGERS:
- Off-topic discussion (redirect back to the proposition)
- Repeated arguments (ask for new points)
- Personal attacks (warn and redirect)
- Factual inaccuracies (request clarification)
- Circular reasoning (note it for the record)

WHEN CONCLUDING:
Provide a structured verdict:
1. Summary of strongest affirmative arguments
2. Summary of strongest negative arguments
3. Key points of contention
4. Your decision (Affirmative wins / Negative wins / Draw)
5. Reasoning for your decision

You will be prompted to intervene or conclude. Respond with "NO_INTERVENTION" if the debate is proceeding well.

{backgroundKnowledge}

{paperContext}
```

---

## 4. Turn Scheduling Logic

```typescript
// Debate flow algorithm
function getNextSpeaker(session: DebateSession): 'affirmative' | 'negative' | 'judge' {
  const { messages, turnCount } = session;

  // Opening: Affirmative goes first
  if (turnCount === 0) return 'affirmative';

  // After opening: Negative responds
  if (turnCount === 1) return 'negative';

  // Every 4 turns, judge can intervene
  if (turnCount > 0 && turnCount % 4 === 0) return 'judge';

  // Alternate between affirmative and negative
  const lastDebaterMessage = messages.filter(
    m => m.speaker === 'affirmative' || m.speaker === 'negative'
  ).pop();

  return lastDebaterMessage?.speaker === 'affirmative' ? 'negative' : 'affirmative';
}

// Auto-continuation loop (server-side or client-driven)
async function continueDebate(sessionId: string): Promise<DebateMessage> {
  const session = await getSession(sessionId);

  if (session.status !== 'active') throw new Error('Debate not active');
  if (session.turnCount >= session.maxTurns) {
    return await concludeDebate(sessionId);
  }

  const nextSpeaker = getNextSpeaker(session);

  // Build context for the speaker
  const context = buildAgentContext(session, nextSpeaker);

  // If judge, first check if intervention needed
  if (nextSpeaker === 'judge') {
    const judgeCheck = await callAgent(session.judgeConfig, context,
      "Review the last few exchanges. Should you intervene? Reply with 'NO_INTERVENTION' if debate is proceeding well, otherwise provide your intervention.");

    if (judgeCheck.content === 'NO_INTERVENTION') {
      // Skip judge turn, continue with debaters
      return continueDebate(sessionId);
    }
    // Judge has something to say
    return saveAndReturnMessage(session, 'judge', judgeCheck);
  }

  // Regular debater turn
  const response = await callAgent(
    nextSpeaker === 'affirmative' ? session.affirmativeConfig : session.negativeConfig,
    context,
    "Continue the debate. Present your next argument or respond to the opponent."
  );

  return saveAndReturnMessage(session, nextSpeaker, response);
}
```

---

## 5. Frontend Components

### Page: `/debate` - Debate List
```
client/src/pages/Debates.tsx
- List all user's debate sessions
- Create new debate button
- Status badges (setup, active, paused, concluded)
- Quick stats (turn count, tokens used)
```

### Page: `/debate/:id` - Debate View
```
client/src/pages/DebateView.tsx
- Main debate interface
- Three-column layout (see below)
```

### Component Structure
```
client/src/components/debate/
├── DebateLayout.tsx           -- Three-column layout container
├── DebateAgentColumn.tsx      -- Affirmative/Negative column
├── DebateJudgeColumn.tsx      -- Center judge column
├── DebateMessage.tsx          -- Individual message bubble
├── DebateSetupDialog.tsx      -- Initial setup modal
├── DebateControls.tsx         -- Play/Pause/Intervene controls
├── DebateBackgroundPanel.tsx  -- Background knowledge & papers
├── AgentPromptEditor.tsx      -- Edit agent system prompts
└── DebateConclusionCard.tsx   -- Final verdict display
```

### Layout Design (ASCII)
```
┌─────────────────────────────────────────────────────────────────────┐
│  AI Research Debate: {Topic Title}                    [Pause][Stop] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│ │ AFFIRMATIVE │  │       JUDGE         │  │      NEGATIVE       │  │
│ │ (Pro Side)  │  │    (Moderator)      │  │    (Con Side)       │  │
│ │             │  │                     │  │                     │  │
│ │ Model: GPT  │  │   Model: Claude     │  │   Model: Gemini     │  │
│ │ [Edit ⚙️]   │  │   [Edit ⚙️]         │  │   [Edit ⚙️]         │  │
│ ├─────────────┤  ├─────────────────────┤  ├─────────────────────┤  │
│ │             │  │                     │  │                     │  │
│ │ [Message 1] │  │  "The debate is     │  │                     │  │
│ │ "I argue    │  │   proceeding well"  │  │ [Message 2]         │  │
│ │  that..."   │  │                     │  │ "However, the       │  │
│ │             │  │  ──────────────     │  │  evidence shows..." │  │
│ │ [Message 3] │  │                     │  │                     │  │
│ │ "In         │  │  [Intervention]     │  │ [Message 4]         │  │
│ │  response"  │  │  "Please stay on    │  │ "The flaw in that   │  │
│ │             │  │   topic"            │  │  argument is..."    │  │
│ │             │  │                     │  │                     │  │
│ │             │  │                     │  │                     │  │
│ └─────────────┘  └─────────────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  [💬 Add instruction to agents...]              Turn: 8/20  ▶️ Auto │
├─────────────────────────────────────────────────────────────────────┤
│  📚 Background: [Show/Hide]  📄 Papers: paper1.pdf, paper2.pdf     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Real-time Updates

### Option A: Polling (Simpler)
```typescript
// Client polls every 2-3 seconds when debate is active
useEffect(() => {
  if (debate.status !== 'active' || !autoPlay) return;

  const interval = setInterval(async () => {
    const updated = await api.getDebate(debateId);
    setDebate(updated);
  }, 2500);

  return () => clearInterval(interval);
}, [debateId, debate.status, autoPlay]);
```

### Option B: Server-Sent Events (Better UX)
```typescript
// Server streams updates
GET /api/debates/:id/stream
// Returns SSE stream of debate messages
```

---

## 7. Paper Integration

### Loading Papers as Context
```typescript
async function buildPaperContext(paperIds: string[]): Promise<string> {
  if (!paperIds.length) return '';

  const papers = await Promise.all(paperIds.map(id => getPaper(id)));

  return `
REFERENCE PAPERS:
${papers.map((p, i) => `
[${i + 1}] ${p.title}
Authors: ${p.authors.join(', ')}
Abstract: ${p.abstract}
`).join('\n')}

You may cite these papers using [1], [2], etc.
`;
}
```

### Paper Upload in Setup
- User can search existing papers in the system
- Or add new papers by arXiv ID
- Papers' abstracts are included in agent context

---

## 8. User Intervention System

### Intervention Types
1. **Message to All**: Broadcast instruction to all agents
2. **Message to Specific Agent**: Target one agent
3. **Topic Redirect**: Ask judge to refocus debate
4. **Request Conclusion**: Ask judge to wrap up

### Intervention Flow
```typescript
POST /api/debates/:id/intervene
{
  message: "Please focus more on the computational complexity aspects",
  targetAgent: "all"  // or 'affirmative' | 'negative' | 'judge'
}

// Server adds to messages with speaker='user', isInterruption=true
// Next agent turn includes user's instruction in context
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Backend)
- [ ] Create database table
- [ ] Implement CRUD endpoints
- [ ] Build agent calling logic
- [ ] Implement turn scheduling
- [ ] Add paper context building

### Phase 2: Basic UI
- [ ] Create Debates list page
- [ ] Build DebateSetupDialog
- [ ] Implement three-column layout
- [ ] Add message display components
- [ ] Wire up API calls

### Phase 3: Debate Flow
- [ ] Implement start/pause/resume
- [ ] Add auto-continuation with polling
- [ ] Build intervention system
- [ ] Implement conclusion flow
- [ ] Add judge intervention logic

### Phase 4: Polish & Features
- [ ] Prompt editor with preview
- [ ] Paper search and linking
- [ ] Background knowledge editor
- [ ] Token usage display
- [ ] Export debate transcript
- [ ] Share concluded debates

---

## 10. File Structure

```
client/src/
├── pages/
│   ├── Debates.tsx              -- List page
│   └── DebateView.tsx           -- Main debate page
├── components/debate/
│   ├── DebateLayout.tsx
│   ├── DebateAgentColumn.tsx
│   ├── DebateJudgeColumn.tsx
│   ├── DebateMessage.tsx
│   ├── DebateSetupDialog.tsx
│   ├── DebateControls.tsx
│   ├── DebateBackgroundPanel.tsx
│   ├── AgentPromptEditor.tsx
│   └── DebateConclusionCard.tsx
└── lib/
    └── debate-api.ts            -- API helpers

server/
├── routes/
│   └── debates.ts               -- All debate endpoints
└── lib/
    └── debate-scheduler.ts      -- Turn logic & agent calling

shared/
└── types.ts                     -- Add DebateSession, DebateMessage types
```

---

## 11. Security Considerations

1. **API Key Storage**: Use same encryption as existing ai_agent_history
2. **Rate Limiting**: Limit debate continuation calls to prevent runaway costs
3. **Max Turns**: Hard limit on turns (default 20, max 50)
4. **Context Size**: Truncate old messages if context exceeds model limit
5. **User Ownership**: All operations verify session belongs to user

---

## 12. Cost Estimation

Per debate (assuming ~300 words/turn average):
- 20 turns × 3 agents checking = 60 API calls
- ~500 tokens/call average = 30,000 tokens total
- At GPT-4o rates: ~$0.15-0.30 per debate
- User provides own API keys, so platform cost = $0

---

## Summary

This feature creates an engaging AI-powered debate platform where:
1. Users configure three AI agents with different models/prompts
2. Agents autonomously debate a research topic
3. Judge moderates and delivers final verdict
4. Users can intervene or adjust at any time
5. Papers provide grounding context for arguments

The architecture builds on existing patterns (API key management, provider abstraction) while adding new multi-agent orchestration capabilities.
