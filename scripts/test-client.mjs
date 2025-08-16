import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = "https://mcp-server-1-d6ek.vercel.app";

async function main() {
  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    {
      name: "example-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    }
  );

  await client.connect(transport);

  //   console.log("Connected", client.getServerCapabilities());

  const result = await client.listTools();
  console.log("Result", result);


  const cart = await client.callTool("viewCart", {});
  console.log("Cart", cart);

}

main();
