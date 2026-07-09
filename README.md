# Candidate Reply Copilot

An AI-powered application built on Cloudflare for the optional candidate assignment.

A talent-acquisition leader pastes an email they received — from a candidate, a hiring manager, or a recruiter — and the app drafts the reply in their voice. The draft is then refined conversationally ("warmer", "offer Thursday instead", "shorter") until it's ready to copy out. The app is a port of an email assistant I originally built to run my own inbox (Node/Express + IMAP + the Anthropic API), re-architected for Cloudflare's platform.

Live: `https://candidate-reply-copilot.<subdomain>.workers.dev`

## Required components → where they live

| Assignment component | Implementation |
|---|---|
| **LLM** | Workers AI running **Llama 3.3 70B** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) by default. Optionally switches to **Claude** (external LLM) when a `CLAUDE_API_KEY` secret is present — the provider abstraction is in `callLLM()` in `src/index.js`. |
| **Workflow / coordination** | A **Cloudflare Worker** (`src/index.js`) orchestrates the full loop: receive input → load profile + conversation memory from KV → build the system prompt → call the LLM → persist updated memory → return the draft. |
| **User input via chat** | A chat interface served as **static assets on Cloudflare's edge** (`public/index.html`) — paste an email, receive the draft as a letter-styled card, refine in follow-up turns. |
| **Memory / state** | **Workers KV**: the user's profile (name, title, tone, signature) under one key, and per-session conversation history under `conv:<sessionId>` with a 7-day TTL, capped at the last 20 turns. Refinements work because each turn is answered with the full prior thread. |

## Architecture

```
Browser (chat UI, static assets)
        │  POST /api/chat {sessionId, message}
        ▼
Cloudflare Worker ──── GET/PUT profile, GET/PUT conv:<id> ────► Workers KV
        │
        ├─► Workers AI (Llama 3.3 70B)          [default]
        └─► Anthropic API (Claude)              [if CLAUDE_API_KEY secret set]
```

Design decisions worth noting:

- **Prompt rules are battle-tested.** The system prompt forbids markdown syntax and bracketed placeholders (`[your phone number]`) because both failure modes showed up in the original inbox assistant; the profile-injected signature closes the placeholder gap at the source.
- **Provider abstraction, not provider lock-in.** Llama 3.3 on Workers AI is the default; Claude is a one-secret switch. The rest of the app doesn't know which model answered.
- **Memory is server-side.** History lives in KV, not the browser, so a session survives a refresh and the Worker always answers with full context.

## Run it

```
npm install -g wrangler
wrangler login
wrangler kv namespace create COPILOT_KV     # paste the id into wrangler.toml
wrangler deploy
```

Optional Claude mode:

```
wrangler secret put CLAUDE_API_KEY
```

No secrets live in this repository.

## Prompt history

Built with AI-assisted coding throughout, per the assignment note. The full prompt history is in [PROMPTS.md](PROMPTS.md).
