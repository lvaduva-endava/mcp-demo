# End-to-End Demo Script (5–8 minutes)

## Pre-demo reset (optional)
- Ensure some cars are `available`.
- Consider clearing `src/data/orders.json` for a clean run.

## Part 1 — Resources (30–60s)
Say: “Resources are authoritative, addressable info.”
- Show `dealer://info` via Inspector (or via chat UI once Milestone 3 is implemented).

## Part 2 — Tools (2–4 min)
1) Inventory discovery
- User: “Show me all available electric cars.”
- Expected: tool `check_car_configuration`

2) Quote (deterministic)
- User: “Give me a quote for car c1 with 10% discount.”
- Expected: tool `generate_quotation`

3) Transaction (side-effect)
- User: “Create an order for car c1, customer Maria Ionescu, agreed price 21150.”
- Expected: tool `create_order`

4) Verify
- User: “List all orders.”
- Expected: tool `list_orders`

## Part 3 — Prompts (1–2 min)
Say: “Prompts are reusable instruction templates.”
- User: “Draft a short sales email for Alex Popescu about car c2 with 7% discount.”
- Expected (ideal): client retrieves prompt `sales-quotation` and uses it.

## Closing line
“This is the value: the LLM is conversational, but it operates against a typed, inspectable contract (tools/resources/prompts) provided by the MCP server.”
