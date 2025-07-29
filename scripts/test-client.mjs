import { createMCPHandler } from "@vercel/mcp-adapter";
import { type } from "os";
const handler = createMCPHandler(
  (server) => {
    server.tools(
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
    redisURL: process.env.REDIS_URL,
    sseEndoint: "/sse",
    streamableHttpEndpoint: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
  }
);

export { handler  as GET, handler as POST, handler as DELETE};
