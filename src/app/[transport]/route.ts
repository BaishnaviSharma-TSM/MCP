import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";
import Redis from "ioredis";

interface Product {
  name: string;
  price: number;
  description?: string;
  category?: string;
  id: number;
}

// Initialize Redis connection with proper error handling
const redis = new Redis({
  host: "34.45.44.8",
  port: 6379,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  lazyConnect: true,
  keepAlive: 30000,
});

// Add Redis connection event handlers
redis.on("connect", () => {
  console.log("✅ Connected to Redis server");
});

redis.on("ready", () => {
  console.log("🚀 Redis is ready to accept commands");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

redis.on("close", () => {
  console.log("📴 Redis connection closed");
});

redis.on("reconnecting", () => {
  console.log("🔄 Reconnecting to Redis...");
});

const handler = createMcpHandler(
  (server) => {
    // Tool 1 - Search product
    server.tool(
      "searchProducts",
      "search product by name",
      {
        name: z.string().describe("Product name to search for"),
      },
      async ({ name }) => {
        try {
          return {
            content: [
              {
                type: "text",
                text: `Searching for products with name: ${name}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error searching for products: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 2 - Find product
    server.tool(
      "findProducts",
      "find for a product by name from the product database",
      {
        name: z.string().describe("User input for the product name"),
      },
      {
        title: "Find Product",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      async ({ name }) => {
        try {
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default as Product[]);

          const result = products.filter((product: Product) =>
            product.name.toLowerCase().includes(name.toLowerCase())
          );

          if (result.length === 0) {
            return {
              content: [
                { type: "text", text: `No products found for "${name}"` },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `Found ${result.length} product(s):\n\n` +
                  result
                    .map((p: Product) => `- ${p.name} (Price: $${p.price})`)
                    .join("\n"),
              },
            ],
          };
        } catch (err) {
          console.error("Error in findProducts:", err);
          return {
            content: [
              {
                type: "text",
                text: `Error searching for product: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 3 - Get product details
    server.tool(
      "getProductDetails",
      "Get detailed info about a product from the product database",
      {
        name: z.string().describe("Exact name of the product"),
      },
      {
        title: "Get Product Details",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        destructiveHint: false,
      },
      async ({ name }) => {
        try {
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default as Product[]);

          const product = products.find(
            (p: Product) => p.name.toLowerCase() === name.toLowerCase()
          );

          if (!product) {
            return {
              content: [
                { type: "text", text: `No product found with name "${name}"` },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `🛍️ ${product.name}\n💵 $${product.price}\n📝 ${
                  product.description || "No description available"
                }`,
              },
            ],
          };
        } catch (err) {
          console.error("Error in getProductDetails:", err);
          return {
            content: [
              {
                type: "text",
                text: `Error getting product details: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 4 - Get products by category
    server.tool(
      "getProductsByCategory",
      "Get products by category",
      {
        category: z.string().describe("Category name to filter by"),
      },
      {
        title: "Get Products by Category",
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      async ({ category }) => {
        try {
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default as Product[]);

          const filtered = products.filter(
            (p: Product) => p.category?.toLowerCase() === category.toLowerCase()
          );

          if (filtered.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No products found in category '${category}'.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `📦 Products in '${category}':\n\n` +
                  filtered
                    .map((p: Product) => `- ${p.name} ($${p.price})`)
                    .join("\n"),
              },
            ],
          };
        } catch (err) {
          console.error("Error in getProductsByCategory:", err);
          return {
            content: [
              {
                type: "text",
                text: `Error getting products by category: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 5 - Add to cart (with Redis integration)
    server.tool(
      "addToCart",
      "Add a product to the cart by name",
      {
        name: z.string().describe("Name of the product to add to the cart"),
      },
      {
        title: "Add to Cart",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      async ({ name }) => {
        try {
          // Check Redis connection
          if (redis.status !== "ready") {
            await redis.connect();
          }

          // Load products
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default as Product[]);

          const product = products.find(
            (p: Product) => p.name.toLowerCase() === name.toLowerCase()
          );

          if (!product) {
            return {
              content: [
                {
                  type: "text",
                  text: `Product "${name}" not found in database.`,
                },
              ],
            };
          }

          // Redis cart key (simplified without userId)
          const cartKey = "cart";

          // Get existing cart from Redis
          let cart: Product[] = [];
          try {
            const existingCart = await redis.get(cartKey);
            if (existingCart) {
              cart = JSON.parse(existingCart);
            }
          } catch (parseError) {
            console.warn(
              "Error parsing existing cart, starting fresh:",
              parseError
            );
            cart = [];
          }

          // Add product to cart
          cart.push(product);

          // Save cart to Redis with expiration (24 hours = 86400 seconds)
          await redis.setex(cartKey, 86400, JSON.stringify(cart));

          // Also save individual cart item with timestamp for tracking
          const cartItemKey = `cart:item:${Date.now()}`;
          await redis.setex(
            cartItemKey,
            86400,
            JSON.stringify({
              ...product,
              addedAt: new Date().toISOString(),
            })
          );

          // Increment cart count
          await redis.incr("cart:count");
          await redis.expire("cart:count", 86400);

          console.log("✅ Product added to Redis cart:", product.name);
          console.log("📍 Cart key:", cartKey);
          console.log("📊 Current cart size:", cart.length);

          return {
            content: [
              {
                type: "text",
                text: `✅ "${product.name}" has been added to your cart in Redis. Cart now has ${cart.length} item(s). Cart Key: ${cartKey}`,
              },
            ],
          };
        } catch (err) {
          console.error("❌ Redis error in addToCart:", err);
          return {
            content: [
              {
                type: "text",
                text: `❌ Error adding product to cart: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 6 - View cart
    server.tool(
      "viewCart",
      "View current cart contents from Redis",
      {},
      {
        title: "View Cart",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      async () => {
        try {
          // Check Redis connection
          if (redis.status !== "ready") {
            await redis.connect();
          }

          const cartKey = "cart";
          const cartData = await redis.get(cartKey);

          if (!cartData) {
            return {
              content: [
                {
                  type: "text",
                  text: `🛒 Your cart is empty. Cart Key: ${cartKey}`,
                },
              ],
            };
          }

          const cart: Product[] = JSON.parse(cartData);
          const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

          return {
            content: [
              {
                type: "text",
                text:
                  `🛒 Your Cart (${cart.length} items):\n\n` +
                  cart
                    .map(
                      (item, index) =>
                        `${index + 1}. ${item.name} - $${item.price}`
                    )
                    .join("\n") +
                  `\n\n💰 Total: $${totalPrice.toFixed(
                    2
                  )}\n📍 Redis Key: ${cartKey}`,
              },
            ],
          };
        } catch (err) {
          console.error("❌ Error in viewCart:", err);
          return {
            content: [
              {
                type: "text",
                text: `❌ Error retrieving cart: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 7 - Clear cart
    server.tool(
      "clearCart",
      "Clear cart contents from Redis",
      {},
      {
        title: "Clear Cart",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      async () => {
        try {
          // Check Redis connection
          if (redis.status !== "ready") {
            await redis.connect();
          }

          const cartKey = "cart";
          const countKey = "cart:count";

          // Delete main cart and count
          const deletedMain = await redis.del(cartKey);
          const deletedCount = await redis.del(countKey);

          // Also clear individual cart items
          const itemKeys = await redis.keys("cart:item:*");
          let deletedItems = 0;
          if (itemKeys.length > 0) {
            deletedItems = await redis.del(...itemKeys);
          }

          console.log(
            `🗑️ Cleared cart - Main: ${deletedMain}, Count: ${deletedCount}, Items: ${deletedItems}`
          );

          return {
            content: [
              {
                type: "text",
                text: `🗑️ Cart cleared successfully. Removed keys: ${cartKey} (${deletedMain}), ${countKey} (${deletedCount}), and ${deletedItems} item keys.`,
              },
            ],
          };
        } catch (err) {
          console.error("❌ Error in clearCart:", err);
          return {
            content: [
              {
                type: "text",
                text: `❌ Error clearing cart: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 8 - Add To whishlist
    server.tool(
      "addToWishlist",
      "Add product to wishlist",
      {
        productName: z.string(),
        userEmail: z.string().email().default("default@user.com"),
      },
      {
        title: "Add to Wishlist",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      async ({ productName, userEmail }) => {
        try {
          if (redis.status !== "ready") await redis.connect();

          // Find product
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default as Product[]);

          const product = products.find(
            (p) => p.name.toLowerCase() === productName.toLowerCase()
          );
          if (!product) {
            return {
              content: [
                { type: "text", text: `❌ Product "${productName}" not found` },
              ],
            };
          }

          const wishlistKey = `wishlist:${userEmail}`;
          const existing = await redis.get(wishlistKey);
          const wishlist: Product[] = existing ? JSON.parse(existing) : [];

          if (
            wishlist.some(
              (item) => item.name.toLowerCase() === product.name.toLowerCase()
            )
          ) {
            return {
              content: [
                {
                  type: "text",
                  text: `💝 "${product.name}" already in wishlist!`,
                },
              ],
            };
          }

          wishlist.push(product);
          await redis.setex(wishlistKey, 86400 * 30, JSON.stringify(wishlist));

          return {
            content: [
              {
                type: "text",
                text: `💝 "${product.name}" added to wishlist! (${wishlist.length} items)`,
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Error: ${
                  err instanceof Error ? err.message : "Unknown"
                }`,
              },
            ],
          };
        }
      }
    );

    // Tool 9 - View Wishlist
    server.tool(
      "viewWishlist",
      "View wishlist contents",
      {
        userEmail: z.string().email().default("default@user.com"),
      },
      {
        title: "View Wishlist",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      async ({ userEmail }) => {
        try {
          if (redis.status !== "ready") await redis.connect();

          const wishlistData = await redis.get(`wishlist:${userEmail}`);
          if (!wishlistData) {
            return {
              content: [{ type: "text", text: "💝 Your wishlist is empty" }],
            };
          }

          const wishlist: Product[] = JSON.parse(wishlistData);
          const total = wishlist.reduce((sum, item) => sum + item.price, 0);

          return {
            content: [
              {
                type: "text",
                text:
                  `💝 Your Wishlist (${wishlist.length} items):\n\n` +
                  wishlist
                    .map((item, i) => `${i + 1}. ${item.name} - $${item.price}`)
                    .join("\n") +
                  `\n\n💰 Total Value: $${total.toFixed(2)}`,
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Error: ${
                  err instanceof Error ? err.message : "Unknown"
                }`,
              },
            ],
          };
        }
      }
    );
  },
  {
    capabilities: {
      tools: {
        searchProducts: {
          description: "Search for products by name",
        },
        findProducts: {
          description: "Find for a product by name from the product database",
        },
        getProductDetails: {
          description: "Get detailed info about a product",
        },
        getProductsByCategory: {
          description: "Get products by category",
        },
        addToCart: {
          description: "Add a product to the cart and save to Redis",
        },
        viewCart: {
          description: "View current cart contents from Redis",
        },
        clearCart: {
          description: "Clear cart contents from Redis",
        },
        addToWishlist: {
          description: "Add a product to the wishlist",
        },
        viewWishlist: {
          description: "View wishlist contents",
        },
      },
    },
  },
  {
    redisUrl: `redis://34.45.44.8:6379`,
    sseEndpoint: "/sse",
    streamableHttpEndpoint: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
  }
);

// Graceful shutdown with proper cleanup
process.on("SIGTERM", async () => {
  console.log("📴 Shutting down gracefully...");
  try {
    await redis.quit();
    console.log("✅ Redis connection closed");
  } catch (err) {
    console.error("❌ Error closing Redis:", err);
  }
});

process.on("SIGINT", async () => {
  console.log("📴 Received SIGINT, shutting down gracefully...");
  try {
    await redis.quit();
    console.log("✅ Redis connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error closing Redis:", err);
    process.exit(1);
  }
});

export { handler as GET, handler as POST, handler as DELETE };
