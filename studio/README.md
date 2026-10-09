# Neon OS × DeanGo — the organism's HUD

This is the **Neon OS** JARVIS-style interface (originally from
[Anish932-hash/studio](https://github.com/Anish932-hash/studio)) fused with the
**DeanGo** organism console: the same neon cyan aesthetic, now driving the
bridged Hermes×OpenClaw organism.

Two processes, one picture:

| Process | What it is | Command |
|---|---|---|
| **Engine** | DeanGo console API (Go core if built, else Node) | `npm run engine` → `node ../deango/bin/deango.mjs gui --port 7788` |
| **GUI** | This Next.js app | `npm run dev` → http://localhost:3000 |

Set `DEANGO_API=http://host:7788` before `npm run dev` if the engine lives
elsewhere. The browser never talks to the engine directly — every call goes
through the Next.js proxy at `/api/deango/*` (see
`src/app/api/deango/[...parts]/route.ts`), so the engine can stay bound to
localhost.

## What's inside

**Original Neon OS (kept intact):** boot animation, JARVIS HUD with real
system gauges, Genkit AI chat (`AI CHAT` mode), voice HUD, boost button,
system-analysis panel.

**DeanGo integration (new):**

- **`/deango` — Organism Console.** A live neon organ map
  (brain=Hermes ⇄ spine=ACP/v1 ⇄ nerves=OpenClaw gateway → hands=MCP bridges,
  legs=channels) with per-organ status glow, plus panels for:
  - **Spine Console** — send prompts straight into the Hermes brain over a
    live ACP handshake (`initialize → session/new → session/prompt`).
  - **Processes** — start/stop organism units, tail their logs.
  - **Update Watchdog** — `deango compat`: drift diff vs the connection
    manifest + spine probe, with one-click **check** / **check + heal**.
  - **Connection & Organism** — render/build/merge connection files; the
    organism.json role assignment table.
  - **Detection & Setup** — rescan both bodies, deep inspection, and the
    official install command plan for whatever is missing.
- **HUD button** — the brain icon in the main HUD header jumps to `/deango`.
- **Brain Link in chat** — the brain icon in AI Chat reroutes the conversation
  through the organism (Hermes over ACP) instead of Genkit. Off = J.A.R.V.I.S.
  (Genkit, needs a Google API key), on = the organism (needs the engine +
  Hermes). Messages indicate which one answered.

## Offline behavior

If the engine isn't running, `/deango` renders the console in an explicit
*ENGINE OFFLINE* state with the exact command to start it — nothing else in
Neon OS breaks.

## Deploy notes

`apphosting.yaml` still applies for Firebase App Hosting (GUI only — the
engine is a machine-local process: run it wherever the bodies live).
