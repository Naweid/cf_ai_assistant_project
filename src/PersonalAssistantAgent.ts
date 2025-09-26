// src/PersonalAssistantAgent.ts

type Vectorize = {
  query?: (args: any) => Promise<any>;
  upsert?: (docs: any[]) => Promise<any>;
};

interface Env {
  AI: {
    run: (model: string, input: any) => Promise<any>;
  };
  VECTOR_DB?: Vectorize;
}

type Turn = { role: "user" | "assistant"; content: string; ts: number };

const SYSTEM_PROMPT = `
You are a helpful Cloudflare personal assistant.
You run on Cloudflare Workers, with Durable Objects for coordination/state.
Use retrieved memory when relevant. Be concise and accurate.
If you don't know, say so clearly.
`.trim();

// Known-good Workers AI chat models (ordered by quality/cost)
const CHAT_MODELS = [
  "@cf/meta/llama-3.1-70b-instruct", // if your account has 70B
  "@cf/meta/llama-3.1-8b-instruct",  // widely available
  "@cf/mistral/mistral-7b-instruct-v0.2"
];

async function runChat(env: Env, messages: Array<{ role: string; content: string }>) {
  let lastErr: any;
  for (const model of CHAT_MODELS) {
    try {
      const res = await env.AI.run(model, { messages });
      const reply = res?.response ?? res?.output ?? "";
      if (typeof reply === "string" && reply.trim()) return reply;
    } catch (e) {
      lastErr = e;
      // Try next model on “no such model” errors
      const msg = String((e as any)?.message ?? e);
      if (!/no such model|5007/i.test(msg)) break; // if it's not a 5007, don't loop
    }
  }
  throw lastErr ?? new Error("Workers AI call failed");
}


export default class PersonalAssistantAgentSqliteA {
  private state: DurableObjectState;
  private env: Env;
  private history: Turn[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // DO entrypoint: accept WebSocket upgrade and hand off
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade at /agents/<session>", { status: 426 });
    }

    // Load history lazily on first connection
    if (this.history.length === 0) {
      const stored = await this.state.storage.get<Turn[]>("history");
      this.history = Array.isArray(stored) ? stored : [];
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();
    this.handleSocket(server).catch((e) => {
      try {
        server.send(JSON.stringify({ type: "error", content: String(e?.message ?? e) }));
      } catch {}
      server.close();
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // Core chat loop
  private async handleSocket(ws: WebSocket) {
    // greet
    ws.send(JSON.stringify({ type: "status", content: "Connected to Cloudflare Assistant ✅" }));

    ws.addEventListener("message", async (evt: MessageEvent) => {
      let data: any;
      try {
        data = typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;
      } catch {
        return;
      }
      if (!data || data.type !== "userMessage") return;

      const userText = String(data.content ?? "");
      await this.pushTurn({ role: "user", content: userText, ts: Date.now() });

      const memoryContext = await this.queryMemory(userText);
      const recent = this.history.slice(-6).map((t) => ({ role: t.role, content: t.content }));

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...(memoryContext ? [{ role: "system", content: `Context from memory:\n${memoryContext}` }] : []),
        ...recent,
        { role: "user", content: userText },
      ];

let reply = "Sorry, I couldn't generate a response.";
try {
  reply = await runChat(this.env, messages);
} catch (e: any) {
  reply = `Model error: ${e?.message ?? e}`;
}


      ws.send(JSON.stringify({ type: "assistantReply", content: reply }));
      await this.pushTurn({ role: "assistant", content: reply, ts: Date.now() });

      // best-effort long-term memory
      await this.saveTurnToMemory(userText, reply);
    });

    ws.addEventListener("close", () => {
      // no-op
    });
  }

  private async pushTurn(turn: Turn) {
    this.history.push(turn);
    // keep last 50 turns
    if (this.history.length > 50) this.history = this.history.slice(-50);
    await this.state.storage.put("history", this.history);
  }

  // === Vectorize RAG (best-effort in local dev) ===
  private async queryMemory(query: string): Promise<string> {
    try {
      if (!this.env.VECTOR_DB?.query) return "";
      const emb = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [query] });
      const vector = emb?.data?.[0];
      if (!vector) return "";

      const search = await this.env.VECTOR_DB.query({
        vector,
        topK: 5,
        returnMetadata: "all",
      });

      const parts: string[] = [];
      for (const m of search?.matches ?? []) {
        const text = m?.metadata?.content || m?.metadata?.text || "";
        if (text) parts.push(text);
      }
      return parts.join("\n");
    } catch {
      return "";
    }
  }

  private async saveTurnToMemory(user: string, assistant: string) {
    try {
      if (!this.env.VECTOR_DB?.upsert) return;
      const doc = `User: ${user}\nAssistant: ${assistant}`;
      const id = crypto.randomUUID();
      const emb = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [doc] });
      const vec = emb?.data?.[0];
      if (!vec) return;
      await this.env.VECTOR_DB.upsert([{ id, values: vec, metadata: { id, content: doc } }]);
    } catch {
      // swallow
    }
  }
}
