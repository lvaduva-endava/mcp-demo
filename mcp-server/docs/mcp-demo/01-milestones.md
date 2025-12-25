# MCP Demo: Milestones & Verification

This is the step-by-step plan we can track and verify.

## Milestone 1 — “Docs-first” demo playbook (server + client)
**Outcome:** A presenter can run the demo from docs without guessing.

**Actions**
- Write the playbook files in `docs/mcp-demo/`:
  - `02-setup.md`
  - `03-demo-resources.md`
  - `04-demo-tools.md`
  - `05-demo-prompts.md`
  - `06-end-to-end-script.md`
  - `90-troubleshooting.md`

**Verification**
- A fresh user can:
  - start the MCP server,
  - start the dealer-chat UI,
  - follow each scenario exactly,
  - and see the expected outcomes.

## Milestone 2 — Fix documentation drift
**Outcome:** README statements match how the code actually works.

**Actions**
- MCP server README: remove references to non-existent files/folders (e.g., `serverCore.ts`, `src/mcp/tools`) or implement that structure.
- Dealer-chat README/.env: align naming and provider (OpenAI vs Anthropic).

**Verification**
- Following README(s) results in a working run without “guessing env vars”.

## Milestone 3 — Make Resources + Prompts demonstrable from the chat UI (optional but recommended)
**Outcome:** In the chat UI, you can explicitly demonstrate:
- **Resource read** (authoritative info)
- **Prompt get** (reusable instruction template)

**Actions (client)**
- Add two declared functions (bridges) in dealer-chat:
  - `mcp_read_resource` → calls MCP client `readResource`
  - `mcp_get_prompt` → calls MCP client `getPrompt`
- Add a short section in the UI or logs clarifying which capability was used.

**Verification**
- Resource scenario triggers a resource read.
- Prompt scenario triggers prompt retrieval and the assistant uses the returned prompt.

## Milestone 4 — “Story-ready” end-to-end sales flow
**Outcome:** A single narrative demo that ties everything together.

**Actions**
- Script:
  1) introduce dealership info via **resource**,
  2) browse & filter inventory via **tools**,
  3) generate quote via **tool**,
  4) draft email via **prompt**,
  5) close the deal via **tool** (create order).

**Verification**
- Orders persist to `src/data/orders.json`.
- Car status updates in `src/data/cars.json`.
