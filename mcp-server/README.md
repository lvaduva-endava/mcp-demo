# 🚗 Car Dealership MCP Server

A Model Context Protocol (MCP) server for car dealership operations. Provides tools, resources, and prompts for car inventory management.

## Architecture

This is a **pure MCP server** that exposes:
- **Tools**: Car inventory operations (list, search, quote, order)
- **Resources**: Dealership information
- **Prompts**: Sales email templates

The server is designed to be consumed by MCP clients (like the separate `dealer-chat` React app).

## Setup

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

Dev server runs at: http://localhost:4000/mcp (because `npm run dev` sets `PORT=4000`).

You can override the port:
```bash
PORT=3000 npm run dev
```

## MCP Tools

### `list_cars`
Browse available car inventory with optional sold filter.

### `check_car_configuration`
Search cars by make, model, year, engine type, or status.

### `generate_quotation`
Create price quotations with custom discount percentages.

### `create_order`
Place customer orders - updates car status to sold and persists order data.

## MCP Resources

### `dealer://info`
Returns dealership contact information and operating hours.

## MCP Prompts

### `sales-quotation`
Generates LLM prompts for customer-facing sales emails with pricing details.

## Data Storage

- `src/data/cars.json` - 50 car inventory with status tracking
- `src/data/orders.json` - Order persistence with timestamps

## Development

```bash
# Run in dev mode (auto-reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Project Structure

```
src/
  server.ts          # MCP server + Express HTTP transport
  data/
    cars.ts          # Car data access layer
    cars.json        # Car inventory (50 cars)
    orders.ts        # Order management
    orders.json      # Order persistence
  types/
    car.ts           # Car & engine types
    order.ts         # Order type
```

## Client Integration

This server is designed to be consumed by MCP clients. See the separate `dealer-chat` React project for a reference implementation that:
- Connects to this MCP server
- Uses an LLM (OpenAI in the sample client) to interpret user requests
- Automatically calls the appropriate MCP tools
- Presents results in a chat interface

---

**Pure MCP Server** - No UI, just tools, resources, and prompts.

## Features
- Tools: configuration search, list inventory, generate quotations, create orders.
- Prompt: `sales-quotation` to seed an LLM conversation with pricing context.
- Resource: static dealership info available at `dealer://info`.
- Streamable HTTP transport with automatic Accept header patching for SSE capability.

## Development

Run in watch mode:
```bash
npm run dev
```

Build:
```bash
npm run build
```

Start compiled server:
```bash
npm start
```

Server endpoint:
```
http://localhost:3000/mcp
```

## Notes
- Tool/prompt/resource registration lives in `src/server.ts` in this repo (kept intentionally small for demo clarity).
- For persistence, replace `src/data/cars.ts` with a DB adapter layer.
