// public/index.js

const chat = document.getElementById("chat");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");

function addMessage(sender, text) {
  const p = document.createElement("p");
  p.className = sender === "user" ? "msg-user" : "msg-assistant";
  p.textContent = `${sender === "user" ? "You" : "Assistant"}: ${text}`;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
}

let ws;
const session = crypto.randomUUID();

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}/agents/${session}`;
  ws = new WebSocket(url);

  ws.addEventListener("close", () => addMessage("assistant", "Disconnected."));
  ws.addEventListener("error", (e) => {
    console.error("[ws] error", e);
    addMessage("assistant", "Connection error (see console).");
  });
  ws.addEventListener("message", (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "assistantReply") addMessage("assistant", data.content);
      else if (data.type === "chunk") addMessage("assistant", data.content);
      else if (data.type === "status") addMessage("assistant", data.content);
      else if (data.type === "error") addMessage("assistant", `Error: ${data.content}`);
    } catch {}
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  addMessage("user", text);
  input.value = "";
  ws.send(JSON.stringify({ type: "userMessage", content: text }));
});

connect();
