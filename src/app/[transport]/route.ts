import { z } from "zod";
import { createMcpHandler } from "@vercel/mcp-adapter";

const handler = createMcpHandler(
  (server) => {
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
  },
  {
    capabilities: {
      tools: {
        searchProducts: {
          description: "Search for products by name",
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
