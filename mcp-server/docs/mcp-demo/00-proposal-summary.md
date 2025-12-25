# MCP Demo: Proposal Summary

## Goal
Create a crisp, presentation-friendly end-to-end workflow:
- **MCP Server (this repo)** exposes **Tools**, **Resources**, and **Prompts**.
- **Dealer Chat UI (dealer-chat repo)** connects to the MCP server and lets an LLM:
  - discover capabilities,
  - call tools for real operations,
  - read resources for authoritative info,
  - use prompts for consistent, reusable LLM behaviors.

The current setup already works. The objective is to make it **clear, readable, and demo-ready**, with **repeatable scenarios** and **predictable outcomes**.

## What we’ll improve (high value, low risk)
1. **Documentation + demo playbook**
   - Step-by-step scripts for **Resources**, **Tools**, **Prompts**, and an end-to-end flow.
   - Exact user utterances to type in the chat.
   - “What you should see” verification notes.

2. **Docs ↔ code alignment (both repos)**
   - Fix small drift (e.g., client docs mention Anthropic/Claude while the code uses OpenAI).
   - Ensure tool/resource/prompt descriptions match the actual behavior.

3. **(Optional) Dealer chat explicitly supports Resources + Prompts**
   - Today the UI only exposes MCP *tools* to the LLM.
   - To demo MCP **resources** and **prompts** clearly, we’ll optionally add two “bridge functions” in the client:
     - `mcp_read_resource(uri)` → calls MCP `readResource`
     - `mcp_get_prompt(name, args)` → calls MCP `getPrompt`
   - This keeps the server “pure MCP” and still makes resources/prompts visible to the LLM in a chat context.

## Principles (to keep the demo tight)
- **One feature at a time**: Resource demo ≠ Tools demo ≠ Prompt demo.
- **Short scenarios**: each feature demo should be 60–120 seconds.
- **Deterministic outputs**: always include concrete IDs (like `c1`) and known inputs.
- **No magic**: call out when the LLM is *reading a resource* vs *calling a tool*.
