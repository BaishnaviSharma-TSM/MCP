import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";
import fs from "node:fs/promises";

interface Product {
  name: string;
  price: number;
  description?: string;
  category?: string;
  id: number;
}

const handler = createMcpHandler(
  (server) => {
    //tool1-search product
    server.tool(
      "searchProducts",
      "search product by name",
      {
        name: z.string(),
      },
      async ({ name }) => {
        return {
          content: [
            {
              type: "text",
              text: `Searching for products with name: ${name}`,
            },
          ],
        };
      }
    );
    //tool2- find product
    server.tool(
      "findProducts",
      "find for a product by name from the product database",
      {
        name: z.string(), // User input for the product name
      },
      {
        title: "find Product",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      async ({ name }) => {
        try {
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default);

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
          return {
            content: [{ type: "text", text: "Error searching for product" }],
          };
        }
      }
    );
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
        const products = await import("../../data/product.json", {
          with: { type: "json" },
        }).then((m) => m.default);

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
              text: `🛍️ ${product.name}\n💵 $${product.price}\n📝 ${product.description}`,
            },
          ],
        };
      }
    );
    // Get products by category tool
    server.tool(
      "getProductsByCategory",
      "Get products by category",
      {
        category: z.string().describe("Exact name of the product"),
      },
      {
        title: "Get Products by Category",
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      async ({ category }) => {
        const products = await import("../../data/product.json", {
          with: { type: "json" },
        }).then((m) => m.default);

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
      }
    );

    // Add to cart tool
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
          // Load products
          const products = await import("../../data/product.json", {
            with: { type: "json" },
          }).then((m) => m.default);

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

          // Load existing cart or initialize empty
          // const cartFilePath = "./src/data/cart.json";
          let cart: Product[] = [];

          try {
            // cart = await import(cartFilePath, { with: { type: "json" } }).then(
            //   (m) => m.default
            // );

           cart = await import("../../data/product.json", {
              with: { type: "json" },
            }).then((m) => m.default);
          } catch {
            // If file does not exist or fails, initialize empty
            cart = [];
          }

          // Add product to cart
          cart.push(product);
console.log("Product added to cart:", product);
          console.log("Current cart contents:", cart);
          // Save cart
          // await fs.writeFile(
          //   cartFilePath,
          //   JSON.stringify(cart, null, 2),
          //   "utf-8"
          // );

       return {
         content: [
           {
             type: "text",
             text: `✅ "${product.name}" has been added to your cart. Cart now has ${cart.length} item(s).`,
           },
         ],
       };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: "❌ Error adding product to cart.",
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
        // searchProducts: {
        //   description: "Search for products by name",
        // },
        findProducts: {
          description: "find for a product by name from the product database",
        },
      },
    },
  },
  {
    redisUrl: process.env.REDIS_URL,
    sseEndpoint: "/sse",
    streamableHttpEndpoint: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
