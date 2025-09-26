// src/index.ts

// Export the Durable Object class by the exact name Wrangler binds:
export { default as PersonalAssistantAgentSqliteA } from "./PersonalAssistantAgent";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket endpoint: /agents/<session>
    if (url.pathname.startsWith("/agents/")) {
      const parts = url.pathname.split("/").filter(Boolean); // ["agents", "<session>"]
      const session = parts[1] || "anonymous";

      if (!env.PERSONAL_AGENT) {
        return new Response("DO binding PERSONAL_AGENT is missing.", { status: 500 });
      }

      // Forward the same request to the DO instance keyed by session
      const id = env.PERSONAL_AGENT.idFromName(session);
      const stub = env.PERSONAL_AGENT.get(id);
      return stub.fetch(request);
    }

    // Static files
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
