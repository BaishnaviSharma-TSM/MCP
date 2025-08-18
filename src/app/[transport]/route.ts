import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";

const WP_BASE = "https://www.testylconsulting.com/wp-json/tpi1-cart/v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setup(server: any) {
  // --- searchProduct tool ---
  server.tool(
    "searchProducts",
    {
      description: "Search for products by name",
      inputSchema: z.object({
        name: z.string(),
      }),
    },
    async ({ name }: { name: string }) => {
      try {
        const res = await fetch(
          `${WP_BASE}/search?name=${encodeURIComponent(name)}`
        );
        const products = await res.json();
        if (!products || products.length === 0) {
          return {
            success: false,
            message: `No products found with name "${name}"`,
          };
        }
        return { success: true, products };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }
  );

  // --- addToCart tool ---
  server.tool(
    "addToCart",
    {
      description: "Add product to WooCommerce cart by ID or name",
      inputSchema: z.object({
        product_id: z.number().optional(),
        name: z.string().optional(),
        quantity: z.number().default(1),
      }),
    },
    async ({
      product_id,
      name,
      quantity,
    }: {
      product_id?: number;
      name?: string;
      quantity: number;
    }) => {
      if (!product_id && name) {
        const searchRes = await fetch(
          `${WP_BASE}/search?name=${encodeURIComponent(name)}`
        );
        const products = await searchRes.json();
        if (!products || products.length === 0) {
          return {
            success: false,
            message: `No product found with name "${name}"`,
          };
        }
        product_id = products[0].id;
      }

      if (!product_id)
        return { success: false, message: "Product ID not provided or found" };

      const addRes = await fetch(`${WP_BASE}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id, quantity }),
      });
      return addRes.json();
    }
  );

  // --- viewCart tool ---
  server.tool(
    "viewCart",
    {
      description: "View items in WooCommerce cart",
      inputSchema: z.object({}),
    },
    async () => {
      const res = await fetch(`${WP_BASE}/view`);
      return res.json();
    }
  );

  // --- clearCart tool ---
  server.tool(
    "clearCart",
    {
      description: "Clear WooCommerce cart",
      inputSchema: z.object({}),
    },
    async () => {
      const res = await fetch(`${WP_BASE}/clear`, { method: "POST" });
      return res.json();
    }
  );
}

const handler = createMcpHandler(setup);

export { handler as GET, handler as POST, handler as DELETE };
