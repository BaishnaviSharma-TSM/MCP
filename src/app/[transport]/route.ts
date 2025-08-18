// src/app/api/mcp/route.ts
import { z } from "zod";
// You can import from either package; both re-export the same API.
// Prefer "mcp-handler" per the README.
import { createMcpHandler } from "mcp-handler"; // or: "@vercel/mcp-adapter"

const WP_BASE = "https://www.testylconsulting.com/wp-json/tpi1-cart/v1";

// Infer the correct setup fn type from createMcpHandler to keep TS happy.
type Setup = Parameters<typeof createMcpHandler>[0];

const setup: Setup = (server) => {
  // --- addToCart tool ---
  server.tool(
    "addToCart",
    "Add a product to cart by product ID and optional name",
    {
      product_id: z.number(),
      name: z.string().optional(),
      quantity: z.number().default(1),
    },
    async ({ product_id, name, quantity }) => {
      const res = await fetch(`${WP_BASE}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id, name, quantity }),
      });
      const json = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(json) }] };
    }
  );

  // --- viewCart tool ---
  server.tool("viewCart", "View items in cart", {}, async () => {
    const res = await fetch(`${WP_BASE}/view`);
    const json = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(json) }] };
  });
};

const handler = createMcpHandler(
  setup,
  // (optional) server options
  {},
  // (optional) transport options; basePath should match your route location
  { basePath: "/api", verboseLogs: true }
);

// Next.js App Router needs GET and POST named exports
export { handler as GET, handler as POST };
