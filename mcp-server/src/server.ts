import "dotenv/config";
import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { cars, findCar, updateCarStatus } from "./data/cars.js";
import { createOrder, orders } from "./data/orders.js";

// Initialize MCP Server
const server = new McpServer({
  name: "car-retail-mcp",
  version: "0.1.0",
});

// Express app + HTTP transport
const app = express();
app.use(express.json());

// Enable CORS for React app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, mcp-protocol-version');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, _res, next) => {
  if (req.path === "/mcp") {
    console.log(`[MCP] ${req.method} /mcp`);
  }
  next();
});

async function handleMcpHttp(req: express.Request, res: express.Response) {
  // The Streamable HTTP transport expects clients to accept both JSON and SSE.
  // Even in JSON response mode, the SDK may enforce this and otherwise return 406.
  const accept = req.headers.accept;
  if (!accept) {
    req.headers.accept = 'application/json, text/event-stream';
  } else {
    const hasJson = accept.includes('application/json');
    const hasSse = accept.includes('text/event-stream');
    if (!hasJson || !hasSse) {
      const parts = [accept];
      if (!hasJson) parts.push('application/json');
      if (!hasSse) parts.push('text/event-stream');
      req.headers.accept = parts.join(', ');
    }
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => transport.close());
  await server.connect(transport);
  // GET requests do not have a body; POST requests do.
  await transport.handleRequest(req, res, (req as any).body);
}

app.get("/mcp", async (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/event-stream")) {
    // JSON-only mode: we do not support a GET SSE stream.
    // Streamable HTTP clients MUST tolerate 405 here.
    res.status(405).set('Allow', 'POST').send('Method Not Allowed');
    return;
  }

  // Otherwise behave like a simple health/info endpoint.
  res.status(200).json({
    ok: true,
    name: "car-retail-mcp",
    version: "0.1.0",
    protocol: "2025-03-26",
  });
});

app.post("/mcp", async (req, res) => {
  await handleMcpHttp(req, res);
});

const port = parseInt(process.env.PORT || "3000", 10);

app.listen(port, () => {
  console.log(`Car Retail MCP Server running at http://localhost:${port}/mcp`);
}).on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});


// Tool 1: List all cars
// Example: Use this to see the entire inventory at a glance
// Response includes: count, array of cars with id/make/model/year/engine/trim/basePrice/status/uri
server.tool(
  "list_cars",
  "Returns the full inventory of cars (no filtering). Perfect for browsing all available vehicles. Shows both available and sold cars with their status.",
  {
    showSold: z.boolean().optional().describe("Include sold cars in results (defaults to false, only available)"),
  },
  {
    title: "List All Cars in Inventory",
    readOnlyHint: true, // Safe to call - doesn't modify data
  },
  async ({ showSold = false }) => {
    const filtered = showSold ? cars : cars.filter(c => c.status === "available");
    const enriched = filtered.map((c) => ({ ...c, uri: `car://${c.id}` }));
    const result = { count: enriched.length, cars: enriched };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// Tool 2: Check car configuration with filters
// Example: Find all Toyota hybrids → { make: "Toyota", engine: "hybrid" }
// All filters are optional - combine them to narrow down results
server.tool(
  "check_car_configuration",
  "Find cars matching specific criteria. All filters are optional and can be combined (make, model, year, engine type, trim level, status). By default shows only available cars.",
  {
    make: z.string().optional().describe("Car manufacturer (e.g., 'Toyota', 'VW')"),
    model: z.string().optional().describe("Car model name (e.g., 'Corolla', 'RAV4')"),
    year: z.number().int().optional().describe("Manufacturing year (e.g., 2024, 2025)"),
    engine: z.enum(["petrol", "diesel", "hybrid", "ev"]).optional().describe("Engine/powertrain type"),
    trim: z.string().optional().describe("Trim level (e.g., 'Comfort', 'Active', 'Pro')"),
    status: z.enum(["available", "sold"]).optional().describe("Car availability status (defaults to 'available')"),
  },
  {
    title: "Search & Filter Car Inventory",
    readOnlyHint: true, // Safe to call - doesn't modify data
  },
  async (args) => {
    const filtered = cars.filter((c) =>
      (args.make ? c.make.toLowerCase() === args.make.toLowerCase() : true) &&
      (args.model ? c.model.toLowerCase() === args.model.toLowerCase() : true) &&
      (args.year ? c.year === args.year : true) &&
      (args.engine ? c.engine === args.engine : true) &&
      (args.trim ? (c.trim?.toLowerCase() === args.trim.toLowerCase()) : true) &&
      (args.status ? c.status === args.status : c.status === "available")
    );
    const matches = filtered.map((c) => ({ ...c, uri: `car://${c.id}` }));
    const result = { count: matches.length, matches };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// Tool 3: Generate quotation
// Example: Get quote for car c3 with 15% discount → { carId: "c3", discountPct: 15 }
// Returns base price, discount %, final price, and currency
server.tool(
  "generate_quotation",
  "Create a detailed price quote for a specific car with optional discount. Returns base price, discount percentage, final price in EUR. Max discount: 30%.",
  {
    carId: z.string().describe("Car ID from inventory (e.g., 'c1', 'c2', 'c3')"),
    discountPct: z.number().min(0).max(30).optional().describe("Discount percentage between 0-30% (defaults to 0)"),
  },
  {
    title: "Generate Price Quotation",
    readOnlyHint: true, // Safe to call - doesn't modify data
    idempotentHint: true, // Same inputs = same output
  },
  async ({ carId, discountPct = 0 }) => {
    const car = cars.find((c) => c.id === carId);
    if (!car) throw new Error("Car not found");

    const finalPrice = Math.round(car.basePrice * (1 - discountPct / 100));
    const result = {
      carId,
      basePrice: car.basePrice,
      discountPct,
      finalPrice,
      currency: "EUR" as const,
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// Tool 4: Create order
// Example: Create order → { carId: "c1", customerName: "Maria Ionescu", agreedPrice: 22325 }
// This CREATES an order - use after generating and confirming quotation
server.tool(
  "create_order",
  "Creates an order for a selected car and customer. This is a transactional operation that generates a unique order ID and marks the car as sold. Use after confirming quotation with customer.",
  {
    carId: z.string().describe("Car ID from inventory (e.g., 'c1', 'c2', 'c3')"),
    customerName: z.string().describe("Customer's full name (e.g., 'Maria Ionescu')"),
    agreedPrice: z.number().min(1).describe("Final agreed price in EUR (from quotation)"),
  },
  {
    title: "Create Customer Order",
    destructiveHint: true, // This creates data/has side effects
  },
  async ({ carId, customerName, agreedPrice }) => {
    const car = findCar(carId);
    if (!car) throw new Error("Invalid carId - car not found");
    if (car.status === "sold") throw new Error("Car is already sold");

    const orderId = `ord_${Date.now().toString(36)}`;

    // Create order record
    const order = createOrder({
      orderId,
      carId,
      customerName,
      agreedPrice,
      status: "created" as const,
    });

    // Update car status to sold
    updateCarStatus(carId, "sold");

    console.log(`Order ${orderId} for ${customerName} on ${carId} at €${agreedPrice}`);

    const result = {
      orderId: order.orderId,
      carId: order.carId,
      customerName: order.customerName,
      agreedPrice: order.agreedPrice,
      createdAt: order.createdAt,
      status: order.status,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// Tool 5: List all orders
// Example: View all orders placed
// Response includes: count, array of orders with orderId/carId/customerName/agreedPrice/status/createdAt
server.tool(
  "list_orders",
  "Returns all orders from the system. Shows order details including customer name, car ID, agreed price, status, and creation date.",
  {
    status: z.enum(["created", "confirmed", "cancelled"]).optional().describe("Filter by order status (optional)"),
  },
  {
    title: "List All Orders",
    readOnlyHint: true, // Safe to call - doesn't modify data
  },
  async ({ status }) => {
    const filtered = status ? orders.filter(o => o.status === status) : orders;
    const result = { count: filtered.length, orders: filtered };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// Resource: Dealership info
// Static resource containing dealership contact information
// URI: dealer://info - can be referenced in prompts or combined with quotations
server.resource(
  "dealership-info",
  "dealer://info",
  {
    title: "Dealership Contact Information",
    description: "Static contact details & address for Endava Auto Retail dealership in Bucharest. Use this to provide customers with contact information.",
    mimeType: "application/json",
  },
  async () => {
    const payload = {
      name: "Endava Auto Retail – Bucharest",
      address: "Bd. Unirii 10, Bucharest",
      phone: "+40 21 000 0000",
      hours: "Mon–Fri 9–18",
      supportEmail: "sales@endava-auto.example",
    };
    return {
      contents: [
        {
          uri: "dealer://info",
          text: JSON.stringify(payload, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  }
);

// Prompt: Sales quotation message
// Example: Generate email → { carId: "c2", customerName: "Alex Popescu", discountPct: "7" }
// Creates a structured prompt for the LLM to generate a customer-facing sales email
server.prompt(
  "sales-quotation",
  "Generate a customer-facing quotation message/email for a selected car and discount. Returns a structured prompt that guides the LLM to create a professional, friendly sales email with pricing details and call-to-action.",
  {
    carId: z.string().describe("Car ID from inventory (e.g., 'c1', 'c2', 'c3')"),
    customerName: z.string().describe("Customer's full name for personalization"),
    discountPct: z.string().optional().describe("Discount percentage as string (0-30, defaults to '0')"),
  },
  ({ carId, customerName, discountPct = "0" }) => {
    const car = cars.find((c) => c.id === carId);
    const parsedDiscount = (() => {
      const n = Number(discountPct);
      return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 0;
    })();
    const base = car?.basePrice;
    const final = car && Math.round(car.basePrice * (1 - parsedDiscount / 100));

    const lines = [
      `Please draft a concise, friendly email to customer "${customerName}".`,
      car
        ? `Car: ${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""} (${car.engine}).`
        : `Car: UNKNOWN.`,
      base !== undefined && final !== undefined
        ? `Pricing: base €${base}, discount ${parsedDiscount}%, final €${final}.`
        : `Pricing: unknown due to missing car.`,
      `Include a short call to action and dealership contact details.`,
      `Keep it under 120 words.`,
    ];

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: lines.join("\n") },
        },
      ],
    };
  }
);

