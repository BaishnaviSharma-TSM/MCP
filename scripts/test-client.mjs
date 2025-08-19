import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin =
  // "https://mcp-server-1-d6ek-gon5k2dt8-riteshs-projects-28bd743d.vercel.app";
  "https://mcp-server-1-d6ek-lo9y6jofi-riteshs-projects-28bd743d.vercel.app";

async function main() {
  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    { name: "example-client", version: "1.0.0" },
    { capabilities: { prompts: {}, resources: {}, tools: {} } }
  );

  await client.connect(transport);

  // --- Example: Add Laptop to cart ---
  const addResult = await client.callTool("addToCart", {
    name: "Laptop",
    quantity: 1,
  });
  console.log("Add to Cart Result:", addResult);

  // --- View current cart ---
  const cart = await client.callTool("viewCart", {});
  console.log("Cart Contents:", cart);
}

main();
