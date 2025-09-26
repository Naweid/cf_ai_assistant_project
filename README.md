# Cloudflare Assistant – AI-Powered Application

## Overview
This project is an **AI-powered personal assistant** built using **Cloudflare Workers + Agents SDK**.  
It demonstrates **real-time AI chat with memory**, backed by **Durable Objects**, **Vectorize Index**, and **Workers AI (Llama 3.3)**. The assistant allows users to chat through a browser interface, retrieves context from memory, and responds intelligently.

## Features
- **LLM Integration** – Cloudflare Workers AI (`@cf/meta/llama-3.3-instruct`)  
- **Workflow & Coordination** – Durable Object (`PersonalAssistantAgent.ts`) for multi-user sessions  
- **User Input via Chat UI** – Browser-based WebSocket chat interface  
- **Memory & State** – Persistent memory using **Vectorize Index** (semantic) + **SQLite Durable Object*(structured)  

## Tech Stack
- **Frontend**: HTML + JavaScript (served via Cloudflare Pages)  
- **Backend**: Cloudflare Worker (`src/index.ts`)  
- **Realtime**: WebSockets (client ↔ Worker communication)  
- **Stateful Coordination**: Durable Objects  
- **Memory**: Vectorize Index + SQLite Durable Object  

## Project Structure
```text
cloudflare-assistant-project/
├── public/                # Static frontend (chat UI)
│   ├── index.html
│   └── index.js
├── src/                   # Worker & Agent code
│   ├── index.ts
│   └── PersonalAssistantAgent.ts
├── PROMPTS.md             # System prompts for AI
├── README.md              # Documentation
├── wrangler.toml          # Cloudflare config
├── package.json
└── tsconfig.json
```


## Getting Started:

```bash
1️⃣ Install Dependencies
npm install

2️⃣ Run locally
npx wrangler dev --local
Visit: http://localhost:8787

3️⃣ Deploy to Cloudflare
npx wrangler deploy
`````

## Configuration:

wrangler.toml includes required bindings:
toml

[vars]
AI = "remote"

[[vectorize]]
binding = "VECTOR_DB"
index_name = "assistant-memory"
remote = true

[[migrations]]
tag = "v1"
new_sqlite_classes = ["PersonalAssistantAgentSqliteA"]


Prompts:
All system prompts are defined in PROMPTS.md. Example:

## System Prompt
You are a helpful Cloudflare personal assistant.
Use retrieved memory when relevant. Be concise, accurate, and cite context inline.
If you do not know, say so clearly.


✅ Assignment Checklist
LLM → Uses Cloudflare Workers AI (Llama 3.3)

Workflow / Coordination → Durable Objects for session handling

User Input → Chat UI via WebSockets

Memory / State → Vectorize Index + SQLite Durable Object


Notes:
Local AI calls always use Cloudflare Workers AI endpoints.
Vectorize local bindings are not supported in --local mode but work in deployed environments.
