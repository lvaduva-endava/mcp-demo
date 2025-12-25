# Demo: MCP Prompts

## What this demonstrates
- A **Prompt** is a reusable template that returns structured messages for an LLM.
- Prompts are great for consistent “assistant behavior” across clients.

This server exposes:
- `sales-quotation`

## Scenario (best paired with the quotation tool)
**Narrative:** After we compute a quote, we want a polished customer email.

### Step 1 — Generate a quotation (tool)
Type:
> Quote car c2 with 7% discount.

Expected:
- tool `generate_quotation`

### Step 2 — Generate the sales email using the server prompt
Type:
> Draft a short sales email for Alex Popescu about car c2 with 7% discount.

Expected (ideal demo behavior):
- the client retrieves the MCP prompt `sales-quotation` with `{ carId: "c2", customerName: "Alex Popescu", discountPct: "7" }`
- the assistant uses the returned prompt messages as input to produce the final email

### Notes
- Dealer-chat now supports prompts via the `mcp_get_prompt(name, arguments)` bridge function.

## How to demo prompts today (no client changes)
Use MCP Inspector to:
- list prompts
- fetch `sales-quotation`
- show the returned “messages” payload

Then (optionally) paste that prompt into your LLM client to show how it guides output.

## Success criteria
- You can clearly differentiate:
  - tool: computes facts / executes operations
  - prompt: standardizes instruction for high-quality text output
