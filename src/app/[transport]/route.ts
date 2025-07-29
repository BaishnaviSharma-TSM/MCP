import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";

interface Product {
  name: string;
  price: number;
  description?: string;
  category?: string;
  id:number
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
              ]
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
