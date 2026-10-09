# DeanGo 🧠⚡🦞

**DeanGo is the operator console for a fused AI organism: Hermes as the body & brain,
OpenClaw as the hands & the legs.**

DeanGo is deliberately **not** an agent. It does not think, plan, or answer. The brain
lives in [Hermes Agent](https://github.com/NousResearch/hermes-agent); the surfaces
(channels, apps, devices) live in [OpenClaw](https://github.com/openclaw/openclaw).
DeanGo is the missing ops layer that stands that organism up and keeps it standing:

| DeanGo command | Job |
|---|---|
| `deango detect` | Find existing Hermes / OpenClaw / Node installs — binaries, versions, home dirs, checkouts |
| `deango inspect` | Deep-map both setups: config files, state dirs, skills/plugins/extensions inventories |
| `deango setup` | Plan the automated install of whatever is missing (official commands; runs only on explicit confirm) |
| `deango connect [--apply]` | Render DeanGo's connection files into `~/.deango` — launcher, acpx bridge config, Hermes config block, supervisor units — and optionally merge them into the live configs (timestamped backups) |
| `deango up / down / status / logs` | Supervise the organism's processes |
| `deango probe` | Live ACP v1 handshake with the brain (initialize → session/new → streamed prompt) |
| `deango gui` | Web console (default `:7788`) — everything above, in the browser |
| `deango doctor` | One-shot readiness report |

## Quickstart

```bash
cd deango
node bin/deango.mjs gui          # or: npm start
# open http://localhost:7788
```

No `npm install` step — DeanGo is pure Node stdlib (Node ≥ 18), so it runs offline
and can bootstrap a machine that has nothing yet.

## The organism DeanGo operates

```
legs : WhatsApp Telegram Slack Discord Signal iMessage Teams Matrix Zalo SMS … (OpenClaw)
nerves: OpenClaw Gateway — sessions, pairing, approvals relay, delivery ledger
spine : ACP stdio JSON-RPC — acpx “hermes” agent (bridge/openclaw/acpx.hermes.config.json)
brain : Hermes acp_adapter → AIAgent turn loop (agent/conversation_loop.py)
body  : hermes_state_* (SQLite WAL+FTS5) · memory · 212 self-improving skills · SOUL.md
hands : acpx MCP bridges — OpenClaw core+plugin tools callable by the brain
```

- Full bridge architecture: [`bridge/README.md`](bridge/README.md)
- Deep codebase analysis of both halves: [`Agent-Experience.md`](Agent-Experience.md)
- Mirrored source trees (for study): `sources/openclaw/`, `sources/hermes-agent/`

## What DeanGo writes, where

```
~/.deango/
├── bin/hermes-acp-launcher.sh        ← spawned by OpenClaw acpx (the brain's process)
├── openclaw/acpx.hermes.config.json  ← merge into OpenClaw config (agents.hermes + MCP bridges)
├── hermes/cli-config.deango.yaml     ← managed block for ~/.hermes/cli-config.yaml
├── connection/{units,manifest}.json  ← supervisor units + audit of everything DeanGo did
└── run/<unit>/{unit.pid,unit.log}    ← supervised process state
```

`--apply` additionally deep-merges the acpx snippet into the detected OpenClaw JSON
config and upserts a marked block into Hermes' `cli-config.yaml` — always with a
timestamped backup first. DeanGo never edits anything silently.

## Design rule

DeanGo configures, launches, observes, and probes. It never sits between a prompt
and a thought: OpenClaw's acpx spawns Hermes directly, they speak ACP 1:1, and DeanGo
watches from the side. If DeanGo dies, the organism keeps living.
