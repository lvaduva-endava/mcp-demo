# Demo: MCP Resources

## What this demonstrates
- A **Resource** is *authoritative data* exposed by the MCP server.
- It’s not a “tool action”; it’s a **read** of a known URI.

In this server, the key resource is:
- `dealer://info` — dealership contact details and hours

## Scenario (best for the stage)
**User intent:** “I need official dealership contact info.”

### Scripted user message (in dealer-chat)
Type:
> Tell me about your dealership: address, hours, and contact.

### What should happen
- The assistant should call `mcp_read_resource` for `dealer://info` and return dealership details.

### Notes
- Dealer-chat now supports resources via the `mcp_read_resource(uri)` bridge function.

## How to demo resources today (no client changes)
Use the MCP Inspector:
1. Start MCP server
2. Run `npm run mcp`
3. In Inspector:
   - list resources
   - read `dealer://info`

## Success criteria
- You can clearly say: “This is a resource read, not a tool call.”
- The output is stable and comes from the server.
