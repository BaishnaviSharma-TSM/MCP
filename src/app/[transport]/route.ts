import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

// Setup WooCommerce API client
const api = new WooCommerceRestApi({
  url: process.env.WC_BASE_URL!, // e.g. https://www.testylconsulting.com
  consumerKey: process.env.WC_CONSUMER_KEY!,
  consumerSecret: process.env.WC_CONSUMER_SECRET!,
  version: "wc/v3",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setup(server: any) {
  // --- searchProducts tool ---
  server.tool(
    "searchProducts",
    {
      description: "Search for WooCommerce products by name",
      inputSchema: z.object({
        name: z.string(),
      }),
    },
    async ({ name }: { name: string }) => {
      try {
        const res = await api.get("products", { search: name });
        const products = res.data;
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
      description: "Add product to WooCommerce cart (requires product_id)",
      inputSchema: z.object({
        product_id: z.number(),
        quantity: z.number().default(1),
      }),
    },
    async ({
      product_id,
      quantity,
    }: {
      product_id: number;
      quantity: number;
    }) => {
      try {
        // You can't add to cart via native WooCommerce API,
        // so we create an Order with 'pending' status to simulate "cart".
        const res = await api.post("orders", {
          status: "pending",
          line_items: [{ product_id, quantity }],
        });

        return { success: true, order: res.data };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to add to cart",
        };
      }
    }
  );

  // --- viewCart tool ---
  server.tool(
    "viewCart",
    {
      description: "View current 'pending' WooCommerce orders (acting as cart)",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const res = await api.get("orders", { status: "pending" });
        return { success: true, cart: res.data };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to view cart",
        };
      }
    }
  );

  // --- clearCart tool ---
  server.tool(
    "clearCart",
    {
      description: "Clear WooCommerce cart by deleting all 'pending' orders",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const res = await api.get("orders", { status: "pending" });
        const pendingOrders = res.data;

        for (const order of pendingOrders) {
          await api.delete(`orders/${order.id}`, { force: true });
        }

        return { success: true, cleared: pendingOrders.length };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to clear cart",
        };
      }
    }
  );
}

const handler = createMcpHandler(setup);

export { handler as GET, handler as POST, handler as DELETE };
