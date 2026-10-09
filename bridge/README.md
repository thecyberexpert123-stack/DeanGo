# 🧠⚡🦞 The Bridge — Hermes inside OpenClaw

> **Hermes is the body and the brain. OpenClaw is the hands and the legs.**
> This bridge wires the two into one organism over the Agent Client Protocol (ACP).
>
> Source trees studied: `sources/hermes-agent@908e4a4b` and `sources/openclaw@608134ea`.
> Full component map of each project: [`../Agent-Experience.md`](../Agent-Experience.md).

---

## 0. TL;DR

```
        ┌─────────────────────────  THE ORGANISM  ──────────────────────────┐
        │                                                                   │
 LEGS   │  OpenClaw channels: WhatsApp · Telegram · Slack · Discord ·       │
 (move) │  iMessage · Signal · Teams · Matrix · Zalo · SMS · voice-call …   │
        │              │              ▲                                     │
        │              ▼              │                                     │
 NERVES │  OpenClaw Gateway (src/gateway/*)  — sessions, pairing,           │
        │  artifacts custody, approval custody/audience, delivery           │
        │              │              ▲                                     │
        │      ACP stdio JSON-RPC     │  ACP session/update stream          │
 SPINE  │  (extensions/acpx, agents.hermes) — the spinal cord ──────────────│
        │              │              ▲                                     │
        │              ▼              │                                     │
 BRAIN  │  Hermes acp_adapter (acp_adapter/server.py)                       │
        │  → AIAgent turn loop (agent/conversation_loop.py + turn_*.py)     │
        │              │              ▲                                     │
        │              ▼              │                                     │
 BODY   │  Hermes state: hermes_state_*.py (SQLite WAL + FTS5), memory      │
        │  plugins, 212 skills that self-improve, Honcho user model,        │
        │  sessions that fork/resume, trajectories                          │
        │              │                                                    │
        │              ▼  (hands reach back up)                             │
 HANDS  │  acpx MCP bridges: openClawToolsMcpBridge + pluginToolsMcpBridge  │
 (act)  │  → Hermes calls OpenClaw core/plugin tools (cron, node actions,   │
        │    browser, canvas…) as MCP tools, mid-turn                       │
        └───────────────────────────────────────────────────────────────────┘
```

One process pair: **OpenClaw Gateway** (the organism's periphery) spawns
**`hermes acp`** (the organism's mind) per the acpx `agents` map, and the two talk
ACP — newline-delimited JSON-RPC on stdio.

Division of labor is anatomical:

| Organ | Lives in | Owns |
|---|---|---|
| **Brain** 🧠 | Hermes | reasoning, turn loop, tool orchestration, planning, model choice |
| **Body** 🫀 | Hermes | persistent self: memory, skills, learning loop, session/trajectory store, identity (`SOUL.md`) |
| **Nerves** 🧵 | OpenClaw Gateway | transport of every signal in/out, delivery ledger, custody of artifacts |
| **Legs** 🦵 | OpenClaw extensions | presence/mobility on 20+ channels + companion apps (macOS/iOS/Android/Windows/Linux) |
| **Hands** ✋ | OpenClaw tools via MCP | world actuation surfaced by the periphery: cron, node/device actions, browser/canvas, plugin tools |
| **Immune system** 🛡 | both | OpenClaw perimeter (pairing, sandbox, policy) ⊃ Hermes approvals (detection→floors→guardian LLM) |

---

## 1. Why ACP is the spinal cord (and not REST/MCP/custom)

Both codebases independently converged on **ACP v1** as the host↔agent contract:

**OpenClaw side — it is an ACP *host*.**
- `extensions/acpx/` — *"OpenClaw ACP runtime backend with plugin-owned session and transport
  management"* (`extensions/acpx/package.json`). It already drives **claude-agent, codex,
  opencode, qwen, pi, kilocode, copilot** as external brains (`openclaw.plugin.json →
  nativeAgents` + activation `onAgentHarnesses`).
- `src/acp/*` — client, policy engine, **permission-relay**, event-ledger, persistent bindings,
  control-plane.
- `packages/acp-core/` — shared session/lineage/error types.
- The acpx config schema (`extensions/acpx/openclaw.plugin.json`) exposes **exactly** what we need:
  ```jsonc
  {
    "agents": { "<id>": { "command": "...", "args": [...] } },   // spawn any ACP agent
    "openClawToolsMcpBridge": true,    // inject OpenClaw CORE tools into ACP sessions via MCP
    "pluginToolsMcpBridge": true,      // inject PLUGIN tools likewise
    "probeAgent": "hermes",            // health-check agent id
    "permissionMode": "approve-reads"  // host-side policy for embedded sessions
  }
  ```

**Hermes side — it is an ACP *agent*.**
- `acp_adapter/server.py` — `HermesACPAgent(acp.Agent)`: `initialize`, `session/new`,
  `session/load`, `session/resume`, `session/fork`, `session/list`, `session/prompt`,
  `session/set_model`, `session/set_mode`, usage updates, thinking/tool/plan streaming.
- `acp_adapter/session.py` — `SessionManager` keeps one `AIAgent` per ACP `sessionId`.
- `acp_adapter/permissions.py` — `make_approval_callback` converts Hermes' approval gate into ACP
  `session/request_permission` round-trips to the host.
- `python -m acp_adapter` = `hermes acp` = `hermes-acp` (`pyproject.toml` console script; extra
  `acp = ["agent-client-protocol==0.9.0"]`).

So the bridge is **configuration + a disciplined launcher**, not protocol invention. The cord
already exists on both ends; we splice a dedicated `hermes` spine into acpx and harden the
operational envelope around it.

## 2. Anatomy, file to file

| Function | File (repo) | Role in the organism |
|---|---|---|
| Spine: spawn brain | `bridge/openclaw/acpx.hermes.config.json` → `agents.hermes.command` | acpx starts `hermes-acp-launcher.sh` |
| Spine: process hygiene | `bridge/bin/hermes-acp-launcher.sh` | stdio purity, env hygiene, `TERM=dumb`, `PYTHONUNBUFFERED` |
| Spine: validation | `bridge/bin/handshake-check.py` | speaks ACP v1 to any agent; probes initialize/session/prompt |
| Brain: turn loop | hermes `agent/conversation_loop.py` + `agent/turn_*.py` | think → act → observe cycles |
| Brain: ACP surface | hermes `acp_adapter/server.py` | sessions, streaming, models, modes |
| Body: persistent state | hermes `hermes_state_*.py` (WAL+FTS5) | memory of everything, searchable |
| Body: persona | hermes `SOUL.md` | who the organism *is* |
| Body: learning | hermes `skills/` + `tools/skill_provenance.py` + curator | skills written by experience |
| Body: user model | hermes Honcho integration + memory plugins | *knowing the human across sessions* |
| Nerves: gateway | openclaw `src/gateway/*` | sessions/approvals/artifacts/drain |
| Legs: channels | openclaw `extensions/{telegram,whatsapp,signal,…}` + `docs/channels/` | where messages walk in from |
| Hands: MCP bridges | openclaw acpx `openClawToolsMcpBridge`, `pluginToolsMcpBridge` | core + plugin tools injected into the brain's session |
| Hands: device reach | openclaw `crates/openclaw-node-host`, apps/* | camera/screen/voice/canvas on real devices |
| Immune: perimeter | openclaw pairing (`docs/channels/pairing.md`), sandboxing | strangers don't get neurons |
| Immune: conscience | hermes `tools/approval*.py` + `acp_adapter/permissions.py` | dangerous acts need consent |
| Grooming | hermes `_early_recovery.py`, openclaw `entry.respawn.ts` | both halves self-heal on startup |

## 3. Signal flows

### 3.1 Inbound: a WhatsApp message becomes a thought

```
human (WhatsApp)
  → extensions/whatsapp            [leg touches the world]
  → src/gateway sessions           [nerve: session key wa:+49… ↔ agent session]
  → agent-turn pipeline            [preflight→admission→dispatch]
  → acpx runtime backend           [agents.hermes]
      spawn bridge/bin/hermes-acp-launcher.sh  (first turn for this session)
      ACP: initialize → session/new {cwd, mcpServers:[OpenClaw MCP bridges]}
      + ACP: session/load (if the body remembers this conversation)
  → acp_adapter SessionManager     [binds AIAgent to this ACP sessionId]
  → agent/conversation_loop.py     [THINKING]
      ←⟂ session/update (agent_message_chunk / thinking / tool_call / plan)
  → nerve: delivery ledger         [reply walks back out the same leg]
```

### 3.2 Mid-turn: the brain uses the hands

During the turn, Hermes' toolset includes the MCP servers acpx injected:

```
conversation_loop → run_tool_round
  → MCP tool call: openclaw.cron.schedule / openclaw.<plugin>.<tool>
  → (MCP over the bridge) → OpenClaw core/plugin tool executes on host
  → result returns as a tool result inside the brain's own transcript
```

The hands never think; the brain never *is* a channel — but it can reach every tool the
periphery offers, with OpenClaw's custody/policy still governing execution.

### 3.3 Approval round-trip (conscience meets veto)

```
brain wants a dangerous act
  → hermes tools/approval gate (detection → floors → guardian-LLM "smart")
  → needs human consent → acp_adapter/permissions.make_approval_callback
  → ACP session/request_permission ───→ OpenClaw host
                                         acpx permissionMode + permission-relay
                                         → prompt on the SAME surface the human uses
                                         (Control UI / chat reply / push)
  ←── decision flows back the same path
```

This nests the two immune systems instead of replacing one: OpenClaw's perimeter policy
(`approve-reads`, `deny-all`) is the outer skin; Hermes' detector+guardian is the conscience.

### 3.4 The body outlives any single spine

- Hermes persists sessions itself (`hermes_state_*`, sqlite WAL). If the `hermes acp` process
  dies, acpx respawns it and issues `session/load`/`session/resume` — the **body** wakes
  intact; OpenClaw's acp-client persistent-bindings (`src/acp/persistent-bindings.*`) remember
  the mapping.
- `session/fork` exists on both sides: OpenClaw can branch a conversation and Hermes clones the
  *body-state* for the branch — two diverging memories from one past.
- If OpenClaw restarts, its sessions are gateway-side persistent too (`src/agents/sessions/` +
  artifact custody); the drain tracker (`active-sessions-shutdown-*`) makes the exit clean.

## 4. Boundaries — what deliberately does NOT cross the cord

| Stays in the body | Stays in the limbs |
|---|---|
| Long-term + curated memory, `session_search` (FTS5+LLM recall) | Per-channel delivery ledger/ledgered acks |
| Skills (creation, self-improvement, provenance) | Channel protocol quirks (stickers, threads, rate limits) |
| Model auth × provider adapters (anthropic/bedrock/vertex/codex…) | Device pairing, nodes, camera/screen/voice IO |
| Trajectories (`batch_runner.py`, `trajectory_compressor.py`) — the organism's dreams | Artifacts custody + download grants |
| Persona (`SOUL.md`) | Surfaces' identity cosmetics (avatars etc.) |

No duplicated brains: OpenClaw's embedded runtime is **not used** for bridged agents
(`nativeAgents` turned off in our config). No duplicated legs: Hermes' own `plugins/platforms/*`
are unnecessary in this topology (its gateway chats direct sessions only if you run it
standalone).

## 5. Deploy

### 5.1 Prereqs

- OpenClaw gateway running (Node 24.16+/26; `openclaw gateway status` healthy).
- Hermes installed: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`
  or a dev checkout; **auth configured** (`hermes auth login <provider>`) and
  `pip install 'hermes-agent[acp]'` equivalent present (`agent-client-protocol==0.9.0`).

### 5.2 Install the spine

```bash
# 1) Put the launcher on PATH-ish locations referenced by config
export HERMES_CHECKOUT=~/src/hermes-agent        # if using a dev checkout

# 2) Merge bridge/openclaw/acpx.hermes.config.json into your OpenClaw config
#    (its "agents.hermes.command" must point at this repo's launcher path)

# 3) Restart the gateway so acpx picks up the new agent definition
openclaw gateway restart   # or: openclaw gateway stop && openclaw gateway start
```

### 5.3 Prove the cord before trusting it

```bash
python3 bridge/bin/handshake-check.py --agent-cmd "bridge/bin/hermes-acp-launcher.sh" \
    --probe-prompt "Reply with exactly: the body is online." --list-sessions
```

Offline preview (no Hermes needed) — a mock agent proves the plumbing:

```bash
python3 bridge/bin/handshake-check.py \
    --agent-cmd "python3 bridge/tests/mock_acp_agent.py" \
    --probe-prompt "hello" --list-sessions
```

### 5.4 Use it

- Select agent runtime `acpx` / agent `hermes` for a session (Control UI picker or
  `agentRuntime` policy for the model/provider route — see
  `sources/openclaw/docs/agent-runtime-architecture.md` §Runtime Selection).
- Talk to the organism from any leg: WhatsApp a task, watch the thought stream in Control UI.

## 6. Failure semantics (tested design, not hope)

| Failure | Behavior |
|---|---|
| Hermes process crash mid-turn | acpx timeout/restart; OpenClaw marks the run failed; user-visible error on the surface; body state intact (WAL) → retry resumes |
| Gateway restart mid-turn | shutdown drain; ACP child terminated; on restart, session rebinds (`persistent-bindings`) and `session/load`s the body |
| Duplicate inbound (channel retry) | `agent-dedupe.ts` (OpenClaw) + durable turn lease (Hermes `turn_facade_lease.py`) — belt and suspenders |
| Hermes runaway tool loop | `agent/repetition_guard.py` interrupts; OpenClaw run timeout as outer guard |
| Context overflow | layered: hermes preflight compaction → mid-turn compaction → OpenClaw retention policy on its session view |
| Approval prompt on unattended channel | `nonInteractivePermissions: deny` (host) + hermes floors — fail closed |

## 7. Roadmap — from splice to symbiosis

1. **Reverse bridge (hands with reflexes):** expose *Hermes'* 274 internal tools to OpenClaw
   surfaces (Hermes already serves MCP: `agent/transports/hermes_tools_mcp_server.py`) — e.g. let
   Control UI call `session_search`.
2. **Per-human minds:** map OpenClaw peer identities (pairing records) into Hermes' Honcho user
   model so the organism knows each human across every leg.
3. **Leg-aware persona:** feed channel provenance (OpenClaw session meta) into Hermes
   `session_provenance_meta` so the brain modulates tone per surface (work Slack ≠ DMs).
4. **Dream cycles:** cron (an OpenClaw hand) triggers Hermes batch trajectory jobs at night —
   the organism trains its successors while idle.
5. **Shared approval vocabulary:** teach guardian-LLM `approval_smart` about OpenClaw's custody
   scopes so "edit in sandboxed node" vs "host file" price differently.

## 8. Repository layout

```
bridge/
├── README.md                        ← this document
├── bin/
│   ├── hermes-acp-launcher.sh       ← the spawned brain (stdio hygiene)
│   └── handshake-check.py           ← ACP v1 client: initialize/session/prompt probe
├── openclaw/
│   └── acpx.hermes.config.json      ← merge into OpenClaw config (agents.hermes + MCP bridges)
├── hermes/
│   └── cli-config.yaml              ← merge into ~/.hermes/cli-config.yaml
├── docs/
│   └── message-flow.md              ← extra sequence diagrams (as they grow)
└── tests/
    └── mock_acp_agent.py            ← offline ACP agent echo for plumbing tests
```

*Build order is intentional: cord first (works today with stock binaries), then surgery on either
side only where the anatomy demands it.*
