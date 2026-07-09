# Prompt History

Per the assignment note ("AI-assisted coding is encouraged, but you have to submit prompt history"), this file logs the prompts used to build this application with Claude.

## Origin

This app is a Cloudflare port of a personal email assistant I built first — a Node.js/Express backend that polls my AT&T IMAP inbox, filters bulk mail, drafts replies with the Anthropic API, and saves them to my Drafts folder. That project was itself built through AI-assisted sessions covering IMAP connection management, prompt design for clean plain-text output, credential handling, and mail filtering. The lessons from it (no-markdown output rules, placeholder elimination via profile injection, provider abstraction) carried directly into this build.

## Session log

### Session 1 — scoping (evening before build)
- Asked whether the existing add-in would qualify against the assignment's four components; identified the gaps (not on Cloudflare, no chat input).
- Prompted for a full scope: Cloudflare-native architecture, component mapping, day-by-day build plan, hour estimate.
- Prompted for a head-start scaffold: Worker code, chat UI, wrangler config, README, and this log.

### Session 2 — Day 1 (deploy)
- Walked account setup, wrangler install/login, KV namespace creation, and first deploy step-by-step with screenshot checkpoints.
- Debugged two deploy blockers live: email verification requirement, and a KV id that had been written into a comment line instead of the id line.
- Registered the mtjarvis.workers.dev subdomain and verified the app live: profile save (KV), first draft (Llama 3.3), and a refine turn that revised the same draft (conversation memory).

### Session 3 — Day 2 (memory + refine loop verification)
- (log prompts here as we go)

<!-- Add each substantive prompt as a bullet under the session it belongs to.
     Keep it honest and representative rather than exhaustive — reviewers want
     to see how you direct an AI collaborator, not a transcript dump. -->
