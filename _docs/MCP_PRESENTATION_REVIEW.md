# MCP Presentation Review (Car Dealer “In-Shop” App)

Date: 2025-12-29

This document reviews the repo as a presentation vehicle for Model Context Protocol (MCP):
- MCP server implementation (tools/resources/prompts)
- 3 client consumption approaches:
  1) Node “agent runtime” (Agent SDK + MCP passed as agent params)
  2) Browser LLM (Responses API + `tools: [{ type: "mcp" }]`)
  3) Browser LLM (manual MCP client + manual tool mapping)

It also lists concrete copy/label/comment polish items (especially removing the word “demo” from comments/descriptions) and a recommended cleanup plan.

---

## 1) High-level assessment

### What’s already strong

- **Clear conceptual split**: the MCP server is “pure MCP” (no UI), and the clients demonstrate different ways to consume the same contract.
- **Good coverage of the core MCP primitives**:
  - Tools: inventory browsing/search, quote generation, order creation, order listing.
  - Resource: dealership info (`dealer://info`).
  - Prompt: a reusable quotation email seed (`sales-quotation`).
- **Good “stageability”**: deterministic IDs (`c1`, `c2`…), fixed discount bounds, and persisted state allow repeatable flows.

### Technical approach overall

- The three approaches are technically credible and map well to real-world options:
  - **Agent runtime** is closest to a production-safe posture (keys server-side; easier to secure; centralizes policy).
  - **Responses API with MCP tool type** is the clearest “magic” story: discovery + tool calls handled by the platform.
  - **Manual mapping** is the best “under the hood” story: it shows exactly what the client has to do when the platform does *not* natively manage MCP.

---

## 2) What’s missing (to cover “the entire picture”)

You already cover the most important MCP concepts. If you want “roughly the entire picture” for an audience, the missing parts are mostly *explanatory* (and a few optional server features that demonstrate additional protocol concepts).

### A) Explicitly show the MCP lifecycle / handshake

Add one slide / 60-second explanation (no code needed) describing:
- **Initialize / protocol negotiation** (why `mcp-protocol-version` exists)
- **Capability discovery**:
  - `listTools` (manual mode currently demonstrates this)
  - `listResources` and `listPrompts` (Inspector covers this; manual browser mode does not)
- **Invocation**:
  - `callTool`, `readResource`, `getPrompt`
- **Transport/session semantics**:
  - Streamable HTTP sessions and the `mcp-session-id` header

Reason: right now, the audience sees “LLM calls tools” but may not internalize the “typed contract + discovery + JSON-RPC-ish transport” story.

### B) Resource linking + resource templates (high value)

Right now tools return `uri: car://<id>` in their results, but the server does not expose a `car://...` resource.

To deepen MCP coverage, consider either:
- **Option 1 (preferred):** add a resource/template so `car://c1` is actually readable.
- **Option 2:** remove the `car://...` URIs from tool outputs to avoid implying a resource that doesn’t exist.

This is the cleanest way to teach: *tools return structured objects that can contain links to resources*.

### C) Content types beyond plain text (optional)

All tool results are returned as JSON-in-text. That’s fine for simplicity, but MCP supports richer content.

For broader coverage, consider a single example tool/resource returning:
- `application/json` structured content as the primary payload (and/or)
- a second content item (e.g., a short human-readable summary)

### D) Subscriptions/notifications (optional)

If you want one “advanced MCP” concept without adding UX:
- show resource updates or server notifications (even just conceptually) such as “inventory changed” after `create_order`.

### E) Security + deployment story (important to say out loud)

The browser modes require an OpenAI key in the browser. Even if acceptable for a workshop, call it out explicitly:
- Browser key exposure is unsafe for production.
- “Agent runtime” mode is the recommended production posture.

Also, for the remote MCP mode:
- Talk briefly about transport security, auth headers, and why a public MCP endpoint needs auth/rate limits.

### F) Tool approval / human-in-the-loop (nice-to-have concept)

You already set `require_approval: 'never'` in the browser MCP tool config.

To cover the concept:
- mention that some hosts allow approval gates for destructive tools.
- optionally change it later for the talk (but only if it won’t derail timing).

---

## 3) Review by project

### 3.1 MCP Server (mcp-server)

**Strengths**
- Very readable MCP registration; small surface area.
- Good use of tool annotations (`readOnlyHint`, `idempotentHint`, `destructiveHint`).
- Clear split of data access into `src/data/*`.

**Issues / polish suggestions**
- **Tool description drift:**
  - `list_cars` description claims “no filtering” but the schema includes `showSold` and default behavior filters sold cars.
- **CORS is wide open** (OK for local workshop); note this in docs.
- **Transport semantics:** current server code constructs a new transport per request and calls `server.connect(transport)` each time. It works for presentation, but consider adding one paragraph to docs explaining:
  - clients may send `mcp-session-id` across requests,
  - server/SDK may enforce Accept headers (JSON + SSE).

**Data layer**
- `cars.ts` and `orders.ts` write JSON files directly. That’s perfect for stage resets.
- If you want to be extra clear, add a “Reset data” note (script or instructions) in the playbook.

### 3.2 Agent Runtime (agent-runtime)

**Strengths**
- Excellent as the “production-ish” story: server holds secrets, UI is a thin client.
- Correctly demonstrates “agent + MCP server” integration.
- Good addition of explicit bridge tools (`mcp_read_resource`, `mcp_get_prompt`) so resources/prompts are visible to the agent.

**Polish suggestions**
- History handling currently uses a single text prompt with “User:” / “Assistant:” lines. That’s OK, but consider documenting why:
  - it keeps the integration minimal,
  - it avoids leaking too much complexity into the sample.

### 3.3 Web App (web-app)

#### Mode A — “Local LLM (remote MCP)” (Responses API MCP tool type)

**Strengths**
- Cleanest end-user story: `tools: [{ type: 'mcp', ... }]` and OpenAI handles discovery + calls.

**Risks / clarifications**
- Requires exposing the MCP server publicly (tunnel). Mention deployment/auth considerations.
- Browser OpenAI key is insecure; explicitly label this as workshop-only.

#### Mode B — “Local LLM (manual tools)” (manual MCP client + manual mapping)

**Strengths**
- Best “how it works” teaching mode.
- Correctly uses `listTools()` and maps MCP tools into OpenAI function tools.

**Polish suggestions**
- Tool-result plumbing is currently done by appending `TOOL_RESULT(...):: ...` as a user message. It may work, but it’s not the cleanest semantic representation.
  - Consider (later) adopting the Responses API’s dedicated tool-result input format (if available in your SDK version) so the model sees tool results as tool results.
- Bridge tool outputs currently stringify raw MCP responses. Consider returning a cleaner “text” or “json” payload.

---

## 4) “No demo word” cleanup (comments, labels, descriptions)

Goal: remove the word “demo” from code comments and user-facing descriptions, while keeping them informative.

### Targeted copy updates (recommended)

1) **Browser MCP config description**
- File: web-app/src/hooks/useChatRemoteMCP.ts
- Current:
  - `server_description: 'Remote MCP server (tunneled for demo).',`
- Suggested (more contextual, no “demo”):
  - `server_description: 'Car Dealership MCP endpoint: inventory search, quotations, and order creation.',`
  - If you still want to mention tunneling, do it without “demo”:
    - `server_description: 'Car Dealership MCP endpoint exposed via a temporary public URL (tunnel).',`

2) **Replace “demo-friendly” phrasing**
- Files with occurrences:
  - web-app/src/hooks/useChatRemoteMCP.ts (comments)
  - agent-runtime/src/server.ts (comments)
  - web-app/src/hooks/useChat.ts (comment “demo only”)
  - mcp-server/README.md (“demo clarity”)
- Suggested replacements:
  - “presentation-friendly”
  - “workshop-friendly”
  - “training-friendly”
  - “example-friendly” (only where appropriate)

3) **Docs folder + headings**
- Current path: mcp-server/docs/mcp-demo/
- If you want to fully remove “demo” from docs, rename conceptually to one of:
  - `mcp-server/docs/mcp-playbook/`
  - `mcp-server/docs/mcp-walkthrough/`
  - `mcp-server/docs/mcp-presentation/`

And update headings like “Demo: MCP Tools” → “Walkthrough: MCP Tools”.

---

## 5) Docs consistency issues

These are presentation-footgun items (audience-facing confusion).

- web-app/README.md still refers to a `dealer-chat` repo and paths that don’t match this workspace layout.
- mcp-server/docs/mcp-demo/02-setup.md references `/Users/llucixxeu/git/dealer-chat/dealer-chat`.
- mcp-server/README.md includes conflicting port information (mentions both 3000 and 4000 patterns).

Recommendation: pick one canonical startup story for the talk:
- Start MCP server on 4000 and keep all clients pointing to 4000, OR
- Start MCP server on 3000 and update docs/env examples accordingly.

---

## 6) Polishing plan (no code changes yet)

### Phase 1 — Presentation correctness (highest priority)
1. Fix README and playbook paths/ports so all instructions match this repo layout.
2. Remove “demo” from:
   - comments (code)
   - user-facing descriptions/labels
   - documentation headings
3. Align tool descriptions with actual behavior (e.g., `list_cars` filtering).

### Phase 2 — MCP completeness improvements (optional, high teaching value)
4. Add a real `car://<id>` resource (or remove the URI from tool outputs).
5. Add one short “protocol lifecycle” section to the playbook (initialize → discover → invoke → session).

### Phase 3 — Code quality cleanup (optional)
6. Deduplicate shared helper functions between hooks (`collectAssistantTextFromResponse`).
7. Consider a more semantically correct tool-result format for the Responses loop (if supported by your SDK version).

---

## 7) Suggested talk track (simple, covers everything)

1) “MCP server = typed contract” → tools/resources/prompts.
2) “Clients discover capabilities” → listTools/listResources/listPrompts (Inspector + manual mode).
3) “Clients invoke” → callTool/readResource/getPrompt.
4) “Three integration levels”:
   - Agent runtime (server-side)
   - Browser MCP tool type (platform-managed)
   - Browser manual mapping (you manage the protocol glue)
5) “Security stance” → keys + auth.
