import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
// import { createSmitheryUrl } from "@smithery/sdk";  // Commented out due to build error - package not found
import { getMem0ApiKey, getSmitheryApiKey } from "../utils/env";

/**
 * Centralized service for connecting to the Mem0 MCP server via Smithery.
 *
 * This wraps the MCP client lifecycle so the rest of the application can
 * simply call `await mcpService.getClient()` to obtain a ready-to-use client.
 */
export class MCPService {
  private static instance: MCPService;

  private client: Client | null = null;
  private isConnected = false;

  private constructor() {}

  /**
   * Returns a singleton instance of the service.
   */
  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Lazily initialises and returns an MCP client connected to the Mem0 server.
   */
  public async getClient(): Promise<Client> {
    if (this.client && this.isConnected) return this.client;

    const mem0ApiKey = getMem0ApiKey();
    const smitheryApiKey = getSmitheryApiKey();

    if (!mem0ApiKey || !smitheryApiKey) {
      throw new Error(
        "Missing MCP configuration. Ensure MEM0_API_KEY and SMITHERY_API_KEY are set."
      );
    }

    // Build the Smithery gateway URL for the Mem0 server
    // const serverUrl = createSmitheryUrl(
    //   "https://server.smithery.ai/@mem0ai/mem0-memory-mcp", 
    //   {
    //     config: { mem0ApiKey },
    //     apiKey: smitheryApiKey,
    //   }
    // );
    
    // Temporary fallback URL until @smithery/sdk issue is resolved
    const serverUrl = new URL("https://server.smithery.ai/@mem0ai/mem0-memory-mcp");

    // Create transport and client
    const transport = new StreamableHTTPClientTransport(serverUrl);
    const client = new Client({ name: "QuiC MCP Client", version: "1.0.0" });

    // Establish the connection
    await client.connect(transport);
    this.client = client;
    this.isConnected = true;

    return client;
  }

  /**
   * Convenience helper that lists available tools exposed by the server.
   */
  public async listTools() {
    const client = await this.getClient();
    return client.listTools();
  }
}

// Export a ready-to-use singleton so consumers can simply import and use.
export const mcpService = MCPService.getInstance(); 