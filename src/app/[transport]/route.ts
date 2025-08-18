// src/app/api/mcp/route.ts
import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";

const WP_BASE = "https://www.testylconsulting.com/wp-json/tpi1-cart/v1";


function setup(server: any) {
  // --- addToCart tool ---
  server.tool(
    "addToCart",
    {
      description: "Add a product to cart by product ID and optional name",
      inputSchema: z.object({
        product_id: z.number(),
        name: z.string().optional(),
        quantity: z.number().default(1),
      }),
    },
    async ({
      product_id,
      name,
      quantity,
    }: {
      product_id: number;
      name?: string;
      quantity: number;
    }) => {
      const res = await fetch(`${WP_BASE}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id, name, quantity }),
      });
      return await res.json();
    }
  );

  // --- viewCart tool ---
  server.tool(
    "viewCart",
    {
      description: "View items in cart",
      inputSchema: z.object({}),
    },
    async () => {
      const res = await fetch(`${WP_BASE}/view`);
      return await res.json();
    }
  );
}

const handler = createMcpHandler(setup);
export default handler;
