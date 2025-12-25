# 🚗 Dealer Chat - React UI for Car Dealership MCP

A modern React chat interface that connects to the Car Dealership MCP server using OpenAI.

## Architecture

```
User (Browser)
    ↓
React App (dealer-chat)
    ↓
OpenAI + MCP Client
    ↓
MCP Server (localhost:4000)
    ↓
Car Inventory Data
```

## Setup

### 1. Configure Environment

Edit `.env` and add your OpenAI API key:

```env
VITE_MCP_SERVER_URL=http://localhost:4000/mcp
VITE_OPENAI_API_KEY=sk-your-key-here
```

### 2. Start the MCP Server

In the main MCP project:

```bash
cd ../../mcp
npm run dev
```

This starts the MCP server at `http://localhost:3000`

Note: in the MCP server repo, `npm run dev` sets `PORT=4000`, so the endpoint is typically `http://localhost:4000/mcp`.

### 3. Start the React App

```bash
npm run dev
```

Open http://localhost:5173 (or the port Vite shows)

## Features

- ✅ ChatGPT-style interface
- ✅ Real-time communication with OpenAI
- ✅ Automatic tool calling via MCP
- ✅ MCP resources + prompts support (via `mcp_read_resource` / `mcp_get_prompt` bridge functions)
- ✅ Markdown formatting for responses
- ✅ Conversation history
- ✅ Loading states and error handling
- ✅ Suggestion chips for quick queries

## Usage

Ask questions like:
- "Show me all electric vehicles"
- "What Toyota cars do you have?"
- "Give me a quote for car c1 with 15% discount"
- "Create an order for car c5, customer John Smith, price €23000"

The model will automatically use the MCP tools to answer your questions naturally.
