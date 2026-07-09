// Candidate Reply Copilot — Cloudflare Worker
// Components: LLM (Workers AI Llama 3.3, or Claude via secret) · Workflow (this
// Worker orchestrates draft/refine) · Chat input (static UI in /public) ·
// Memory (Workers KV: profile + conversation history).

const LLAMA_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// ---------- system prompt (lessons ported from the AT&T assistant build) ----
function systemPrompt(profile) {
  const p = profile || {};
  const name = p.name || "the user";
  const title = p.title ? `, ${p.title}` : "";
  const tone = p.tone || "warm, professional, concise";
  const signature = p.signature
    ? `End every reply with exactly this signature block:\n${p.signature}`
    : `End with a simple sign-off using the name ${name}.`;

  return [
    `You draft email replies on behalf of ${name}${title}, a talent-acquisition leader.`,
    `The user pastes an email they received (from a candidate, hiring manager, or recruiter) and you write the reply ${name} would send.`,
    `Tone: ${tone}.`,
    `Rules:`,
    `- Write plain text only. Never use markdown syntax (no asterisks, hashes, or bullet characters).`,
    `- Never invent facts, dates, or commitments. If information is missing, phrase around it naturally instead of inserting bracketed placeholders like [date] or [phone number].`,
    `- Answer every question the incoming email asks.`,
    `- Keep it as short as a competent human would.`,
    `- When the user asks for a revision, revise the previous draft rather than starting over, and output only the full revised reply.`,
    signature,
  ].join("\n");
}

// ---------- LLM call: Claude if secret present, else Workers AI -------------
async function callLLM(env, messages, profile) {
  const sys = systemPrompt(profile);

  if (env.CLAUDE_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL || "claude-sonnet-4-6",
        max_tokens: 1024,
        system: sys,
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Claude API error");
    return {
      text: (data.content || []).map((b) => b.text || "").join(""),
      model: "Claude (" + (env.CLAUDE_MODEL || "claude-sonnet-4-6") + ")",
    };
  }

  const result = await env.AI.run(LLAMA_MODEL, {
    messages: [{ role: "system", content: sys }, ...messages],
    max_tokens: 1024,
  });
  return { text: result.response || "", model: "Workers AI (Llama 3.3 70B)" };
}

// ---------- helpers ---------------------------------------------------------
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

function convKey(id) {
  return "conv:" + String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

// ---------- Worker entry -----------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- profile memory (KV) ---
    if (url.pathname === "/api/profile") {
      if (request.method === "GET") {
        const raw = await env.COPILOT_KV.get("profile");
        return json(raw ? JSON.parse(raw) : {});
      }
      if (request.method === "PUT") {
        const body = await request.json();
        const profile = {
          name: String(body.name || "").slice(0, 100),
          title: String(body.title || "").slice(0, 100),
          tone: String(body.tone || "").slice(0, 200),
          signature: String(body.signature || "").slice(0, 500),
        };
        await env.COPILOT_KV.put("profile", JSON.stringify(profile));
        return json({ ok: true });
      }
      return json({ error: "method not allowed" }, 405);
    }

    // --- chat: draft or refine a reply ---
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const sessionId = body.sessionId || crypto.randomUUID();
        const userText = String(body.message || "").slice(0, 20000);
        if (!userText.trim()) return json({ error: "empty message" }, 400);

        // load conversation memory from KV
        const key = convKey(sessionId);
        const stored = await env.COPILOT_KV.get(key);
        const history = stored ? JSON.parse(stored) : [];

        const profileRaw = await env.COPILOT_KV.get("profile");
        const profile = profileRaw ? JSON.parse(profileRaw) : {};

        const messages = [...history, { role: "user", content: userText }];
        const { text, model } = await callLLM(env, messages, profile);

        // persist updated memory (cap history to last 20 turns)
        const updated = [...messages, { role: "assistant", content: text }].slice(-20);
        await env.COPILOT_KV.put(key, JSON.stringify(updated), {
          expirationTtl: 60 * 60 * 24 * 7, // one week
        });

        return json({ reply: text, model, sessionId });
      } catch (e) {
        return json({ error: e.message || "server error" }, 500);
      }
    }

    // --- reset a conversation ---
    if (url.pathname === "/api/reset" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (body.sessionId) await env.COPILOT_KV.delete(convKey(body.sessionId));
      return json({ ok: true });
    }

    // anything else under /api is unknown; static assets handle the rest
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
