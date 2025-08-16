// src/app/api/mcp/route.ts
import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";

/**
 * WooCommerce Store API base URL (no Redis)
 * Examples used below:
 *  - GET  /products?search=term
 *  - GET  /products?page=1&per_page=10
 *  - GET  /products/{id}
 *  - GET  /cart
 *  - POST /cart/add-item
 *  - POST /cart/remove-item/{key}
 *  - DELETE /cart/items
 */
const WC_BASE = "https://www.testylconsulting.com/wp-json/wc/store";

// ---- Helpers ---------------------------------------------------------------

// ---- Helpers ---------------------------------------------------------------

function isWooErrorBody(
  obj: unknown
): obj is { message?: string; code?: string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    ("message" in obj || "code" in obj)
  );
}

async function wcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${WC_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore parse error; non-JSON responses are rare but possible
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    if (isWooErrorBody(body)) {
      if (typeof body.message === "string") {
        message = body.message;
      } else if (typeof body.code === "string") {
        message = body.code;
      }
    }
    throw new Error(`WooCommerce API error: ${message}`);
  }

  return body as T;
}

// ---- Types matching common Store API shapes (minimal) ----------------------

type WCImage = { id: number; src: string; alt?: string };
type WCCategory = { id: number; name: string };

interface WCProduct {
  id: number;
  name: string;
  description?: string;
  short_description?: string;
  price?: string; // Store API often returns stringified price
  prices?: {
    price: string;
    regular_price: string;
    sale_price: string;
    currency_code: string;
  };
  categories?: WCCategory[];
  images?: WCImage[];
}

interface WCCart {
  items: Array<{
    key: string; // cart item key required for remove
    quantity: number;
    id: number; // product id
    name: string;
    totals?: {
      line_total: string;
    };
    images?: WCImage[];
  }>;
  totals?: {
    total_items: string;
    total_price: string;
    currency_code?: string;
  };
}

// ---- MCP Handler -----------------------------------------------------------

const handler = createMcpHandler(
  (server) => {
    // 1) Search products by keyword
    server.tool(
      "searchProducts",
      "Search WooCommerce products by keyword",
      {
        query: z.string().describe("Keyword to search for"),
        page: z.number().int().positive().default(1),
        per_page: z.number().int().positive().max(100).default(10),
      },
      async ({ query, page, per_page }) => {
        const products = await wcFetch<WCProduct[]>(
          `/products?search=${encodeURIComponent(
            query
          )}&page=${page}&per_page=${per_page}`
        );

        return {
          content: [
            {
              type: "text",
              text:
                products.length === 0
                  ? `No products found for "${query}".`
                  : products
                      .map(
                        (p) =>
                          `• ${p.name} (ID: ${p.id})` +
                          (p.prices?.price ? ` — ${p.prices.price}` : "")
                      )
                      .join("\n"),
            },
          ],
        };
      }
    );

    // 2) Get product details by ID
    server.tool(
      "getProductDetails",
      "Get detailed info about a product by ID",
      {
        productId: z.number().describe("WooCommerce product ID"),
      },
      async ({ productId }) => {
        const p = await wcFetch<WCProduct>(`/products/${productId}`);

        const cats = p.categories?.map((c) => c.name).join(", ") || "—";
        const price =
          p.prices?.price ??
          p.price ??
          (p.prices ? JSON.stringify(p.prices) : "—");
        const images = p.images?.map((i) => i.src).join("\n") || "—";

        return {
          content: [
            {
              type: "text",
              text: [
                `🛍️ ${p.name} (ID: ${p.id})`,
                `💵 Price: ${price}`,
                `🏷️ Categories: ${cats}`,
                `📝 ${p.short_description || "No short description."}`,
                `🖼️ Images:\n${images}`,
              ].join("\n"),
            },
          ],
        };
      }
    );

    // 3) List products (paginated)
    server.tool(
      "listProducts",
      "List products with pagination",
      {
        page: z.number().int().positive().default(1),
        per_page: z.number().int().positive().max(100).default(10),
      },
      async ({ page, per_page }) => {
        const products = await wcFetch<WCProduct[]>(
          `/products?page=${page}&per_page=${per_page}`
        );

        return {
          content: [
            {
              type: "text",
              text:
                products.length === 0
                  ? "No products."
                  : products
                      .map(
                        (p) =>
                          `• ${p.name} (ID: ${p.id})` +
                          (p.prices?.price ? ` — ${p.prices.price}` : "")
                      )
                      .join("\n"),
            },
          ],
        };
      }
    );

    // 4) Add product to cart
    server.tool(
      "addToCart",
      "Add a product to the WooCommerce cart",
      {
        productId: z.number().describe("WooCommerce product ID"),
        quantity: z.number().int().positive().default(1),
      },
      async ({ productId, quantity }) => {
        const cart = await wcFetch<WCCart>(`/cart/add-item`, {
          method: "POST",
          body: JSON.stringify({ id: productId, quantity }),
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Added product ${productId} (x${quantity}) to cart.\nItems in cart: ${cart.items.length}`,
            },
          ],
        };
      }
    );

    // 5) View cart
    server.tool("viewCart", "View current WooCommerce cart", {}, async () => {
      const cart = await wcFetch<WCCart>(`/cart`);
      const lines =
        cart.items.length === 0
          ? "🛒 Cart is empty."
          : cart.items
              .map(
                (it, idx) =>
                  `${idx + 1}. ${it.name} (ID: ${it.id}) x${
                    it.quantity
                  } — key: ${it.key}`
              )
              .join("\n");

      const total =
        cart.totals?.total_price ??
        (cart.totals ? JSON.stringify(cart.totals) : "—");

      return {
        content: [
          {
            type: "text",
            text: `${lines}\n\nTotal: ${total}`,
          },
        ],
      };
    });

    // 6) Remove a single item from cart (requires cart item key)
    server.tool(
      "removeFromCart",
      "Remove a specific item from WooCommerce cart (use item key from viewCart)",
      {
        itemKey: z.string().describe("Cart item key (see viewCart output)"),
      },
      async ({ itemKey }) => {
        const cart = await wcFetch<WCCart>(
          `/cart/remove-item/${encodeURIComponent(itemKey)}`,
          {
            method: "POST",
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `🗑️ Removed item ${itemKey}. Items in cart: ${cart.items.length}`,
            },
          ],
        };
      }
    );

    // 7) Clear entire cart
    server.tool(
      "clearCart",
      "Clear all items from WooCommerce cart",
      {},
      async () => {
        const cart = await wcFetch<WCCart>(`/cart/items`, { method: "DELETE" });

        return {
          content: [
            {
              type: "text",
              text: `🧹 Cart cleared. Items in cart: ${cart.items.length}`,
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        searchProducts: { description: "Search products by keyword" },
        getProductDetails: { description: "Get product details by ID" },
        listProducts: { description: "List products (paginated)" },
        addToCart: { description: "Add product to WooCommerce cart" },
        viewCart: { description: "View current WooCommerce cart" },
        removeFromCart: {
          description: "Remove item from WooCommerce cart by key",
        },
        clearCart: { description: "Clear all WooCommerce cart items" },
      },
    },
  },
  {
    // No Redis, no redisUrl
    sseEndpoint: "/sse",
    streamableHttpEndpoint: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
