# Agent-Experience.md

> **An extreme deep dive into two open-source AI agent codebases — OpenClaw and Hermes Agent.**
> File-to-file, code-to-code: how each system boots, thinks, acts, remembers, heals, and talks.
> Written 2026-10-09 from the source trees mirrored in `sources/`.

---

## 0. What was analyzed

| | **OpenClaw** 🦞 | **Hermes Agent** ☤ |
|---|---|---|
| Upstream | `openclaw/openclaw` (Foundation, 501c3) | `NousResearch/hermes-agent` |
| Commit studied | `608134ea54c3f3ecd08473a5b906d66872666573` (main, 2026-10-09) | `908e4a4b44480912ae3571833492c1aeac2d0eda` (main, 2026-10-09) |
| Local mirror | `sources/openclaw/` | `sources/hermes-agent/` |
| Annotated version | `2026.9.9` (calver) | `0.0.0` (uv-managed, live-checkout) |
| Language / runtime | TypeScript on Node 24.16+/26 (+ Rust crates) | Python 3.14 (supports `>=3.11,<3.15`) |
| Package mgmt | pnpm workspace | uv + PM (their own dep manager) |
| License | MIT | MIT |
| Source files | ~21,293 `*.ts` (non-test) + Rust | 8,357 `*.py` |
| Test files | ~15,150 `*.test.ts` (0.71 tests per source file!) | 5,860 test files |
| Docs pages | 1,334 markdown pages in `docs/` | 746 pages in `website/` |
| Size on disk | 735 MB / 52,590 files | 237 MB / 17,949 files |
| Tagline | *"Your assistant, on your devices, in your chats"* | *"The agent that grows with you"* |
| Ancestry | Warelay → Clawdbot → Moltbot → OpenClaw | Hermes lineage of Nous models → agent harness |

---

## 1. TL;DR — the one-paragraph truth

**OpenClaw is an I/O and trust company wearing an agent costume; Hermes is a cognition company
wearing a gateway costume.** OpenClaw's engineering mass concentrates on the *Gateway* — a trusted
local control plane that brokers channels, sessions, approvals, artifacts, updates, and dozens of
extension processes, with the agent runtime as one (replaceable) tenant. Hermes' mass concentrates
on the *agent itself* — a meticulously decomposed synchronous turn loop, a fine-grained state
layer (WAL SQLite + FTS5), a learning loop (skills that write themselves), and a gateway that
exists mostly to feed the agent users from 20+ platforms. If you are building an agent product,
OpenClaw teaches you **operations and trust boundaries**; Hermes teaches you **the turn loop and
self-improvement**.

---

## 2. Identity & philosophy — `VISION.md` vs `SOUL.md`

**OpenClaw — `VISION.md`:**
- *"The AI that actually does things. It runs on your devices, in your channels, with your rules."*
- One Gateway can be a personal assistant on a laptop **or** a shared team deployment — config is the
  only difference. Dogfooded at `team.openclaw.ai`.
- Explicit priority list: (1) security & safe defaults, (2) stability, (3) first-run UX — *then*
  more providers/channels. Contribution rule: **one PR = one issue**.
- Privacy stance in README: state/memory/credentials live on your hardware; phones home only for a
  daily version check; opt-in stats; `update.checkOnStart: false` kills both.

**Hermes — `SOUL.md`** (a behavioral spec *for the model itself*):
- *"Match the length of your reply to the weight of the ask… No filler, no restating the request,
  no narrating tool calls the user can see. Agree because it's right, not because the user said it.
  Depth is earned."* — Personality is treated as **versioned source code**, not vibes.
- README's core claim: *the only agent with a built-in learning loop* — creates skills from
  experience, improves them during use, nudges itself to persist knowledge, searches its own past
  conversations, builds a model of who you are (Honcho dialectic user modeling).
- Deployment stance: *"not tied to your laptop"* — $5 VPS to GPU cluster; serverless backends
  (Modal, Daytona, Vercel Sandbox) hibernate when idle.

**Insight:** OpenClaw versions its *policy* (`update.checkOnStart`, pairing defaults) the way Hermes
versions its *persona* (`SOUL.md`). Both treat non-code artifacts as first-class, reviewed source.

---

## 3. OpenClaw — architecture, layer by layer

### 3.1 Boot chain (`openclaw.mjs` → `src/entry.ts`)

The binary is a thin wrapper (`ENTRY_WRAPPER_PAIRS` in `src/entry.ts`) around `src/entry.ts`, which
is a masterclass in **defensive CLI startup**:

- `normalizeWindowsArgv`, `parseCliProfileArgs`, container-target parsing, native-relay detection.
- **Fast paths before anything heavy**: `entry.version-fast-path.ts`, `isRootHelpInvocation`,
  precomputed help — avoid module-load cost for `--version`.
- **Compile cache**: `entry.compile-cache.ts` enables Node's compile cache and *respawns without it*
  if it corrupted.
- **Respawn plans**: `entry.respawn.ts` builds a `CliRespawnPlan` (runtime env repair,
  `node-runtime-recovery.ts`) — a crashed/old Node is swapped out by re-exec.
- **Update admission**: `run-main-update-admission.ts` decides update work *before* the CLI even
  parses your command.
- Lazy `await import()` everywhere — the CLI only pays module-load cost for the command you ran.

**Pattern worth stealing:** *startup as a pipeline of pure predicates + respawn plans*, with every
heavyweight subsystem lazily imported.

### 3.2 The Gateway (`src/gateway/`) — the trusted control plane

OpenClaw's README: the Gateway is *"the local control plane for sessions, tools, events, and
channel connections."* The directory is enormous and ruthlessly one-file-per-concern:

- **Approvals**: `approval-channel-custody.ts`, `approval-session-audience.ts`,
  `approval-web-push.ts` — approval *ownership*, *visibility*, and *delivery* are three separate
  facts.
- **Artifacts**: `artifact-downloads.ts`, `artifact-download-grants.ts`,
  `artifact-download-projection.ts` — grants vs projections vs the download itself.
- **Session drain**: `active-sessions-shutdown-drain.ts` + `...-tracker.ts` — graceful shutdown is
  a tracked lifecycle, not a `SIGTERM` prayer.
- **Assistant identity**: `assistant-avatar-cache.ts`, `assistant-identity*.ts` — even cosmetics
  get cache + runtime separation.

### 3.3 The agent-turn pipeline (`src/gateway/agent-turn/`)

A single user message is processed as a **job with phases**, each phase its own module:

```
agent-request-preflight   →  agent-run-admission-(model|phase|revalidation)
→ agent-run-dispatch      →  agent-run-execution-phase
→ agent-delivery-phase    →  agent-session-persist
```

With orthogonal concerns as siblings: `agent-dedupe*.ts`, `agent-wait*.ts`,
`agent-run-subagent.ts`, `agent-run-media-custody.ts`, `agent-restart-recovery-context.ts`,
`agent-runtime-identity-token.ts`. Tests mirror every behavioral file (`*.test.ts`).

**Pattern worth stealing:** *name files after the phase they implement*; the directory becomes the
state machine diagram.

### 3.4 Agent runtime (`src/agents/` + `packages/agent-core`)

Per `docs/agent-runtime-architecture.md`, OpenClaw **owns its built-in runtime** (no external agent
frameworks remain):

- `src/agents/embedded-agent-runner/` — the built-in attempt loop. `run.ts` is one line re-exporting
  `run-orchestrator.js`; the substance lives in per-concern modules: a huge `compact.*` family
  (compaction is split into ~30 files: `compact.queued.ts`, `compact.foreground-work.ts`,
  `compact.delegate.ts`, `compact.summary-fallback.ts`, …), `cache-ttl*.ts`,
  `cli-backend-dispatch*.ts`, `active-run-projections.ts`.
- `packages/agent-core` (`@openclaw/agent-core`) — the reusable core: `agent-loop.ts`,
  `agent-loop-steering.ts` (mid-turn steering), `stream-steering.ts`, `reasoning.ts`,
  `tool-batch-admission.ts` / `tool-batch-completion.ts` (parallel tool calls are admitted and
  settled as batches), `turn-interruption.ts`, `turn-taint.ts`, `retention-runtime.ts`
  (context retention = compaction policy), `harness/` types.
- `src/agents/sessions/` — session persistence (`session-manager.ts`), resource discovery
  (`package-manager.ts`, `resource-loader.ts`), in-session extensions, prompt templates, skills,
  themes, TUI tool renderers.
- `src/agents/harness/` — **harness registry**: selection policy + lifecycle for built-in and
  plugin-registered harnesses. Runtime id `openclaw` is built-in; `pi` aliases to it;
  `codex-app-server` → `codex`. Policy is model/provider-scoped `agentRuntime.id`; `auto` picks a
  registered plugin harness matching the provider route, else built-in. **OpenAI implicitly selects
  `codex`** *only* on exact official HTTPS Responses routes with no request overrides; plaintext
  official HTTP is rejected outright.
- `src/llm/` — model registry, provider transports (`providers/`), `stream.ts`,
  `tool-result-redaction.ts` (scrub secrets from tool outputs before the model sees them).

**Model runtime generations** (a beautiful idea): gateway/config/plugin/auth events build **one
atomic snapshot** — auth template + model registry + projected catalog — per configured agent. Runs
*fork* mutable stores from that snapshot. *"A failed or stale generation is never served alongside a
newer partial generation."* Status/TUI/browse paths read the published catalog instead of repeating
filesystem discovery.

### 3.5 Compute workers (`packages/worker-runtime`)

Code-mode execution, compaction planning, file-tool planning run in a `WorkerTaskPool`:

- CPU admission limit `max(1, availableParallelism() - 1)` — always reserve a core for the Gateway.
- Separate caps per pool type: readers ≤2 (replicated caches don't help short queues), compute ≤4,
  writers/singletons serial.
- Backpressure with real numbers: 128 pending tasks, 256 MiB producer-reported retained input;
  overflow fails fast with `WorkerTaskError.code = "overloaded"` (no unbounded queues).
- Result, execution settlement, and resource release are **recorded as separate facts** — a retained
  task can return while its owner still holds worker + input charge.
- Observability via `node:diagnostics_channel` topic `openclaw.worker.task` — queue time, wall time,
  transfer time; never task inputs.

### 3.6 Plugins, extensions, manifests

- `openclaw/plugin-sdk/*` barrels are the **only** legal import surface for plugins —
  `docs/agent-runtime-architecture.md` states: *"Plugins use documented entrypoints and do not
  import `src/**` internals."* Enforced by tsconfig package boundaries
  (`extensions/tsconfig.package-boundary.*.json`).
- **166 extension directories** under `extensions/` — providers (anthropic, azure, bedrock, qwen,
  xai, zai, vllm, sglang…), channels (telegram, whatsapp, signal, slack, zalo, twitch, x, sms,
  voice-call…), tools (browser, searxng, tavily, brave), infrastructure (vault, net-policy, raft,
  typesafe, qa-channel…).
- **Resource manifests in `package.json`** under the `"openclaw"` key declare `extensions`,
  `skills`, `prompts`, `themes` as globs; anything not declared falls back to conventional directory
  discovery (`skills/*.md`, …). Third-party distribution via **ClawHub** (clawhub.ai).

### 3.7 Channels, nodes, apps

- Channels per `docs/channels/`: WhatsApp, Telegram, Discord (incl. activities), Slack (+huddles),
  Google Chat, Signal, iMessage (+BlueBubbles path), Matrix, Mattermost, MS Teams, Nextcloud Talk,
  Nostr, IRC, LINE, Feishu, and more — each with a dedicated doc page and pairing flow.
- **DM security default**: unknown senders get a *pairing request*; humans approve via
  `openclaw pairing approve <channel> <code>`. Inbound messages are treated as untrusted input.
- **Nodes & companion apps**: macOS/iOS/Android (incl. Android Wear!)/Windows/Linux add voice,
  Canvas, camera, screen, device-local actions. Rust side: `crates/openclaw-node-host`,
  `crates/openclaw-gateway-client`.
- Surfaces: Control UI (`openclaw dashboard`), CLI, TUI (built on `@earendil-works/pi-tui` — the
  one acknowledged third-party UI dep).

### 3.8 Governance as architecture

501(c)(3) Foundation with donors who *fund but do not direct* (README lists OpenAI, Amazon, Red Hat…
and the lore: built for **Molty**, a space lobster, with a soul.md wink). Security posture docs:
`docs/gateway/security`, exposure runbook, sandboxing guide — with the honest warning that tools run
on-host for the main session unless you configure sandboxing.

---

## 4. Hermes Agent — architecture, layer by layer

### 4.1 Boot chain (`run_agent.py`, `cli.py`, `hermes_cli/`)

- `run_agent.py` must import `hermes_bootstrap` **first** (UTF-8 stdio on Windows). Then
  `_early_recovery.restore_interrupted_pull()` — if a `hermes update` was killed mid-`git write`,
  the checkout *repairs itself and relaunches before any other import*. Self-healing is startup step
  zero.
- `hermes_cli/` is a full command suite: auth flows per provider (`auth_codex.py`,
  `auth_openrouter.py`, `auth_qwen.py`, `auth_nous.py`, device flows, anonymous challenge),
  `_update_takeover.py`, `_startup_fast.py` (fast-path startup), observability, session mgmt.
- `cli.py` + `prompt_toolkit` power the interactive TUI (multiline editing, slash-command
  autocomplete, interrupt-and-redirect).

### 4.2 `AIAgent` — the mega-facade, honestly documented

`agent/AGENTS.md` is admirably blunt: `run_agent.py` is the public facade; **`AIAgent` is assembled
from mixins** (`turn_facade.py`, `client_lifecycle.py`, `stream_delivery.py`,
`session_persistence.py`, `compression_facade.py`, …). Construction runs `agent_init.py::init_agent`
with **~60 parameters** (they say so themselves). Defaults that matter: `max_iterations=500` (shared
with subagents), `api_mode` (`chat_completions`/`codex_responses`/…), `platform`
(`"cli"|"telegram"|…`), `skip_context_files`, `skip_memory`, `credential_pool`. `chat(msg) -> str`
is the simple interface; `run_conversation(...) -> dict` returns `final_response` + `messages`.

### 4.3 The turn loop (`agent/conversation_loop.py`, 1,859 lines + `agent/turn_*.py`)

The loop is **deliberately synchronous** — "with interrupt checks, budget tracking, and a one-turn
grace call":

```python
while (api_call_count < self.max_iterations and self.iteration_budget.remaining > 0) \
        or self._budget_grace_call:
    if self._interrupt_requested: break
    response = client.chat.completions.create(model=…, messages=…, tools=tool_schemas)
    if response.tool_calls: …  # → run_tool_round
```

But the loop body is factored into **single-purpose phase modules**, bound at import *"so a
source-tree swap cannot load a skewed phase mid-turn"*:

| Phase module | Responsibility |
|---|---|
| `turn_facade.py` + `turn_facade_lease.py` | Durable **cross-process session turn lease** + refresher thread + liveness watchdog around the whole turn |
| `turn_preflight*.py`, `turn_preflight_gate.py` | Compression preflight, gates before spending tokens |
| `turn_request_assembly.py`, `turn_api_request.py` | Build the exact wire request |
| `turn_api_call.py` | The API call itself + `nous_rate_limit_guard` + interrupt handling |
| `turn_response_check.py`, `turn_response_intake.py` | Validate, normalize model output |
| `turn_tool_round.py` | One round of tool execution |
| `turn_stop_gates.py`, `verification_stop.py` | When to stop; verification evidence |
| `turn_retry_state.py`, `turn_recovery*.py` | Retry machinery, auto-recovery |
| `turn_context_compaction.py` | Mid-loop compaction decisions |
| `turn_final_response.py`, `turn_finalizer.py` | Finish + persist the turn |

Embedded gems:

- **Run budget wrap-up notice** (`RUN_BUDGET_WRAPUP_NOTICE`): at 80% of `--run-budget` the agent is
  told, as a system notice, to *"stop new discovery work now; produce the final deliverable from
  state you already have."* The agent is *taught its own deadline*.
- **Repetition guard** (`agent/repetition_guard.py`) → `REPETITION_LOOP_INTERRUPTED` breaks runaway
  tool loops.
- **Prompt caching as a plan** (`agent/prompt_caching.py`): `build_prompt_cache_plan`,
  `strip_anthropic_cache_control` — cache breakpoints are computed per request, and metrics
  (`record_cache_break`, `record_prompt_rebuild`) are recorded in shared efficiency metrics.
- **Scripted preludes** (`turn_scripted_prelude.py`, `play_prelude`): deterministic scripted
  segments can replay before the live loop (resumable/automation flows).
- **Interrupt scaffolding**: user corrections mid-turn inject
  `[This response was interrupted by a user correction.]` ghosts so the model sees *why* history
  jumps; stale tool-call markers are filtered with a shared regex mirrored in `hermes_state.py`.
- Transcript hygiene: `_sanitize_surrogates`, `_repair_tool_call_arguments`,
  `transcript_repair.py`.

### 4.4 Tools (`tools/` — 274 modules) and toolsets (`toolsets.py`)

- Named tool groups resolved statically + via plugin registry. `_HERMES_CORE_TOOLS` (~60 tools) is
  the shared list for CLI *and* all messaging platforms — "edit once, all platforms follow."
- **Context-gated subsets**: `_HERMES_WEBHOOK_SAFE_TOOLS` = `web_search`, `web_extract`,
  `vision_analyze`, `clarify` — webhook payloads are untrusted, so no file/system execution, ever.
  Desktop affordances stay out of the core list; the GUI gateway enables them per desktop session.
  Convenience tools declare `check_fn` gating (`computer_use`, kanban, HA).
- **`execute_code` — the zero-context-cost superpower**: agent writes Python that calls tools via
  RPC (`tools/code_execution_rpc.py`, `code_kernel_remote.py`), collapsing multi-step pipelines into
  one turn. OpenClaw has the same idea (code-mode on `WorkerTaskPool`) via a different mechanism.
- Approvals (`tools/approval*.py`): a layered gate — `approval_detection` (dangerous patterns) →
  `approval_floors` (hard blocks/allowlists) → `approval_smart` (a *guardian LLM* reviews) →
  `approval_gateway_wait` (blocking round-trip to the messaging client) → `approval_human_wait`,
  plus `approval_yolo`, per-session state, and a **denial breaker** (don't re-ask loops). Prompt
  transports include CLI, plugin transports, and **MCP elicitation**.
- Read path: `firecrawl-anydoc` converts PDF/Office/EPUB→Markdown with a typed `NeedsOcrError` for
  scanned pages — bundled in core *"because PDF reads are a common first-session action."*
- `tool_search.py`: BM25 over tool schemas with Snowball stemming at index *and* query time, so
  "issues" matches `create_issue` — tools are discoverable at scale.

### 4.5 Providers & transports (`agent/*_adapter.py`, `agent/auxiliary_*.py`, `agent/transports/`)

- Adapters: Anthropic (incl. thinking policy + replay), Bedrock, Vertex, Azure identity,
  `codex_responses` (+ a devoted pydantic-core segfault workaround note in `pyproject.toml`).
- The **`auxiliary_client_*` family is Hermes' reliability moat**: fallback recovery, key rotation,
  health tracking, stream watchdog, reasoning floor, structured output, plugin OAuth, task config,
  accounting — auxiliary (cheap/backup) models handle summarization, titling, compression without
  polluting the main conversation.
- TTS/STT/web-search/image/video/browser providers all live behind `*_registry.py` patterns
  (`tts_registry.py`, `web_search_registry.py`, …) — uniform discovery/config across kinds.

### 4.6 State — `hermes_state_*.py` (the flat-file-module database)

Instead of a `db/` package, state is **one module per concern**, ~40 files: `hermes_state_wal.py`
(WAL mode), `hermes_state_fts.py` (FTS5 indices), `_sessions`, `_messages`, `_timeline`, `_titles`,
`_usage`, `_compression`, `_rewind`, `_registry`, `_readpool` (read connection pooling),
`_lockguard`/`_lockowners` (who holds what), `_repair`/`_profile_repair`, `_portability`
(moving state between machines), `_telegram`, `_tool_retries`… Cross-session memory search is the
`session_search` tool: FTS5 query → **LLM summarization** of past turns for recall at human level.

### 4.7 Gateway & platforms (`gateway/` — 129 modules; `plugins/platforms/` — 21 platforms)

- Platform bots: telegram, discord, slack, whatsapp, matrix, signal-family (simplex), teams, wecom,
  dingtalk, feishu, line, irc, email, sms, ntfy, google_chat, a2a, raft, photon, buzz.
- Delivery is **ledgered** (`delivery_ledger.py`) — sent/acked facts survive restarts; cron gets
  `cron_store_notices.py`; hosted multi-user rooms have `hosted_room_discussion.py` /
  `hosted_room_driver.py`; there are stream consumers per concern (`stream_consumer_fences.py`,
  `_think`, `_transport`), session stall detection, shutdown forensics, `systemd_notify.py`,
  and slash commands split by area (`slash_commands_{model,session,login,status,goals}`).
- Voice path: `agent/voice_turn_route.py`, streaming TTS consumer, transcription providers.
- `tui_gateway/` + `ui-tui/` serve the desktop TUI over the same gateway contract
  (`apps/shared/src/gateway-contract.openrpc.json` — an **OpenRPC contract** shared with desktop).

### 4.8 The learning loop (Hermes' crown jewel)

- **Skills** (`skills/`, 12 categories, loaded by default; `optional-skills/`, 13 categories,
  install via `hermes skills install official/<category>/<skill>`): SKILL.md packages following the
  **agentskills.io open standard** (212 SKILL.md files). Frontmatter: `name`, `description`,
  `version`, `platforms` (OS gate), `metadata.hermes.{tags,category,related_skills,config}`,
  `prerequisites.commands`.
- **Authoring standards are enforced by tests** (`tests/skills/test_authoring_standards.py`):
  description ≤60 chars, one sentence, no marketing words; prose must reference native tools in
  backticks (`search_files`, not `grep`); `platforms:` audited against actual imports (`/proc`,
  `fcntl` ⇒ not Windows). Docs culture as CI law.
- **Skill provenance & self-improvement**: `tools/skill_provenance.py::set_current_write_origin`
  tags writes; after complex tasks the agent *authors new skills* and improves existing ones during
  use (the README's "closed learning loop"), with a curator skill for review.
- **Memory**: agent-curated memory with periodic nudges + `plugins/memory/` backends (`byterover`,
  `holographic`, `retaindb`, `query_rewrite`) + Honcho dialectic user modeling.

### 4.9 Supply-chain & dependency posture (`pyproject.toml`, `pm/`)

- **Every direct dep is exact-pinned `==X.Y.Z` — no ranges**, by written policy, after the
  "Mini Shai-Hulud" worm hit `mistralai 2.4.6` on PyPI: a range would have auto-pulled the
  compromised release in the quarantine window. `hermes pm lock` regenerates transitive resolution.
- **Scope rule**: only packages used by *every* session are core deps; provider-specific SDKs are
  extras prepared by PM per chosen backend — *"smaller `dependencies` = smaller blast radius."*
- TLS trust from the **OS store** (`agent/ssl_verify.py` + `truststore`), so corporate roots "just
  work"; certifi pinned merely because httpx/requests/openai need it.
- `requests==2.33.0` pinned for a CVE; comments everywhere explain *why*, with dates and incident
  references. Dependency comments as institutional memory.

### 4.10 Research surfaces

`batch_runner.py` (batch trajectory generation), `trajectory_compressor.py` (compress trajectories
for training tool-calling models), `mini_swe_runner.py`, `evals/` — the agent is built to *manufacture
its own future training data*.

---

## 5. File-to-file map (component ↔ component)

| Concern | OpenClaw | Hermes Agent |
|---|---|---|
| Binary entry | `openclaw.mjs` → `src/entry.ts` | `run_agent.py` (+ `cli.py`, `hermes_cli/main`) |
| Boot recovery | `src/entry.respawn.ts`, `node-runtime-recovery.mjs` | `hermes_cli/_early_recovery.py` (restore interrupted pull → relaunch) |
| Update handling | `src/cli/run-main-update-admission.ts` | `hermes_cli/_update_takeover.py` |
| Main agent loop | `packages/agent-core/src/agent-loop.ts` | `agent/conversation_loop.py` |
| Turn phases | `src/gateway/agent-turn/*` | `agent/turn_*.py` |
| Facade construction | `src/index.ts`, `src/runtime.ts` (212/162 lines) | `run_agent.py` `AIAgent` mixin assembly (~60 ctor params) |
| Loop steering (mid-run) | `agent-core/agent-loop-steering.ts`, `stream-steering.ts` | `turn_facade` redirect + interrupt scope (`agent/interrupt_scope.py`) |
| Compaction | `embedded-agent-runner/compact.*` (~30 files), `agent-core/retention-runtime.ts` | `agent/turn_context_compaction.py`, `compression_facade.py`, `hermes_state_compression.py` |
| Tool batching | `agent-core/tool-batch-{admission,completion}.ts` | `tools/tool_executor.py`, `turn_tool_round.py` |
| Tool discovery at scale | model catalog projections (`model-catalog-core`) | `tools/tool_search.py` BM25 + stemming |
| LLM transports | `src/llm/providers/`, `src/llm/stream.ts` | `agent/*_adapter.py`, `agent/transports/*` |
| Fallback/rotation | model runtime generations (atomic snapshots) | `agent/auxiliary_{client,fallback_recovery,key_rotation,stream_watchdog}.py` |
| Prompt caching | `embedded-agent-runner/cache-ttl*.ts` | `agent/prompt_caching.py` (cache plans + cache-break metrics) |
| Approvals | `src/gateway/approval-*` (custody/audience/web-push) | `tools/approval*.py` (detection→floors→smart→gateway/human wait) |
| Code-mode execution | `packages/worker-runtime` WorkerTaskPool | `tools/code_execution_rpc.py` (`execute_code` RPC) |
| Subagents | `agent-turn/agent-run-subagent.ts` | `agent/subagent_lifecycle.py`, `delegate_task` tool |
| Cron | `src/cron/` | `gateway/cron_store_notices.py` + `croniter`, delivery to any platform |
| Sessions/state | `src/agents/sessions/session-manager.ts`, artifact projections | `hermes_state_*.py` (SQLite WAL + FTS5, per-concern modules) |
| Cross-session memory | sessions + prompts; skills | `session_search` (FTS5 + LLM summary), memory plugins, Honcho |
| Skills system | `skills/*.md` + manifest globs; ClawHub | `skills/`+`optional-skills/`, SKILL.md agentskills.io, curator |
| Plugins | `extensions/` (166 dirs) + `plugin-sdk` barrels | `plugins/` (loader, storage, catalog) |
| Channels | 20+ channel extensions + `docs/channels/` | `plugins/platforms/` (21) + `gateway/` delivery layer |
| CLI/TUI | Control UI + TUI (`pi-tui`) | `cli.py` TUI + `tui_gateway/` + desktop apps |
| Config | file + scopes model (`src/config/`) | `cli-config.yaml`, `gateway/config_loader.py`, per-skill config |
| Telemetry | opt-in stats + version check, off-switch | Nous Portal accounting where chosen; local-first state |
| Personality | docs/lore + `soul.md` homage | `SOUL.md` (shipped, versioned) |
| Research/training | — (product focus) | `batch_runner.py`, `trajectory_compressor.py`, `evals/` |

---

## 6. Code-to-code — the two loops, side by side

**Hermes (Python, synchronous, mixin-hosted):** `agent/conversation_loop.py`

```python
while (api_call_count < self.max_iterations and self.iteration_budget.remaining > 0) \
        or self._budget_grace_call:
    if self._interrupt_requested: break
    begin_iteration(...);  prepare_iteration(...)          # turn_iteration_prep.py
    run_preflight_gate(...)                                # compression/guards
    request = assemble_api_request(...)                    # exact wire shape
    response = perform_api_call(...)                       # nous_rate_limit_guard
    check_api_response(response); normalize_model_response(response)
    if response.tool_calls:
        run_tool_round(...)                                # execute → append → maybe compact
        continue
    return finish_text_response(...)                       # finalize_turn: persist, title, metrics
```

- Everything synchronous ⇒ trivially reasoned ordering; concurrency pushed to *edges* (lease
  refresher thread, watchdog, RPC kernel).
- Turn wrapped by a **durable cross-process lease** (`turn_facade_lease.py`): crash mid-turn ⇒ the
  lease proves abandonment; refresher thread keeps it alive while thinking.
- Budget treated as a first-class object (`iteration_budget`, plus wall-clock run-budget with the
  80% wrap-up system notice).

**OpenClaw (TypeScript, async, package-core):** `packages/agent-core/src/agent-loop.ts` +
`agent-turn/*` (gateway side)

```
preflight → admission → dispatch → execution → delivery → persist      (gateway job)
            └ embedded-agent-runner: attempt loop
              ├ agent-loop.ts           — iterate model↔tools
              ├ tool-batch-admission    — admit parallel tool calls as a batch
              ├ stream-steering         — inject mid-stream steering messages
              └ retention-runtime       — compaction of live context
            └ worker-runtime            — heavy/edit-planning offloaded to WorkerTaskPool
```

- Async/await everywhere; correctness is enforced by **admission controllers** and **settlement
  receipts** rather than by a single thread of control.
- Interrupts are *typed* (`turn-interruption.ts`, `turn-taint.ts` — a tainted turn's effects are
  tracked, not merely aborted).
- Heavy CPU work (edit diff planning, compaction planning) never runs on the Gateway isolate.

**The philosophical delta in one line:** Hermes makes the loop *simple* and the edges robust;
OpenClaw makes the loop *one phase in a job* and the boundaries explicit. Both reach the same
destination — no lost turns, no unbounded queues, compacted context, redacted tool outputs.

---

## 7. Patterns worth stealing (for our project)

1. **Phase-per-file turn pipelines.** Both repos make the state machine legible by naming files
   after phases (`turn_request_assembly.py` / `agent-run-admission-phase.ts`). Adopt: one file = one
   pipeline stage, test file beside it.
2. **Durable turn lease + watchdog** (Hermes `turn_facade_lease.py`). Any agent runner should be
   able to *prove* a turn is abandoned. Lease + refresher thread + liveness watchdog ≈ 3 files.
3. **Atomic config/runtime generations** (OpenClaw): snapshot {auth template, model registry,
   catalog} atomically; runs fork from the snapshot; never serve a partial new generation.
4. **Context-gated tool subsets** (Hermes): define `_WEBHOOK_SAFE_TOOLS`-style allowlists per trust
   domain; gate with `check_fn`s at resolve time, not inside each tool.
5. **Layered approval gate**: deterministic floors → guardian-LLM "smart" review → blocking human/
   gateway wait, with a denial breaker to stop re-ask loops. Works on CLI and chat transports.
6. **Code-mode execution with RPC** (`execute_code`): collapse multi-tool pipelines into one model
   turn; keep the mutation authority outside the planning worker (OpenClaw revalidates authority
   + cancellation *after* plan, *before* write).
7. **Backpressure with explicit caps**: 128 pending tasks / 256 MiB retained input, fail-fast
   `overloaded`; reserve ≥1 CPU for the control plane (`availableParallelism() - 1`).
8. **Prompt caching as a computed plan**: `build_prompt_cache_plan` per request; emit cache-break
   metrics; control cache TTLs like hermes' `effective_cache_ttl` / OpenClaw's `cache-ttl.ts`.
9. **Repetition guard + budgeted run**: kill runaway tool loops; at 80% wall-clock budget, inject a
   system notice demanding the final deliverable from existing state.
10. **Self-healing bootstrap**: update-takeover / interrupted-pull restore *before* any heavy import
    (Hermes); respawn plans + compile-cache quarantine (OpenClaw). Make startup repairable, not just
    fast.
11. **Redaction at the transport edge**: `tool-result-redaction.ts` scrubs secrets before tool
    output reaches the model ⟷ Hermes' message sanitization/repair family.
12. **Skills as markdown packages** (agentskills.io): name/description/version/platforms frontmatter;
    enforced authoring lint (≤60-char descriptions, backtick native tool names); optional/heavy
    skills install on demand; provenance tags on agent-written skills.
13. **Docs-as-code at every level**: AGENTS.md nested per directory (both repos), 1,334 / 746 doc
    pages, architecture docs that read like RFCs (`agent-runtime-architecture.md`) — the codebase is
    *taught*, not just written.
14. **Ledgered delivery + shutdown drain**: delivery facts (Hermes `delivery_ledger.py`) and
    graceful drain trackers (OpenClaw `active-sessions-shutdown-*`) make restarts boring.
15. **Pairing by default for DMs**: unknown sender ⇒ pairing code ⇒ human approval. Secure default,
    zero config.
16. **Exact-pinned deps + extras for provider SDKs** (Hermes): written rationale tied to a real
    supply-chain incident; core deps = "used by every session," nothing more.
17. **Interrupt scaffolding in transcripts**: when a user redirects mid-turn, inject an explicit
    interruption marker into history so the model understands the discontinuity (both repos do this).

## 8. Deliberate divergences (and why both are right)

| Decision | OpenClaw | Hermes | Reasoning |
|---|---|---|---|
| Loop concurrency | Async TS, admission/settlement receipts | Synchronous Python, threads only at edges | TS process hosts many tenants (gateway); Python loop hosts one mind |
| Trust boundary | Gateway trusted; execution untrusted; sandboxing optional but documented | Tools in-process; per-context tool allowlists; guardian-LLM approvals | Different threat priorities: multi-user gateway vs single-operator autonomy |
| Extension granularity | 166 extension dirs; per-provider packages; ClawHub | Adapters in `agent/`; plugin registries per kind (`*_registry.py`) | Marketplace ecosystem vs curated batteries |
| Learning | Static skills + prompts; focus = reliability/security | **Self-writing skills**, memory nudges, session search summaries, Honcho user model | Hermes' differentiator is compounding knowledge |
| State | Sessions/projections, artifacts custody | One `hermes_state_*` module per concern over SQLite WAL+FTS5 | TS object stores vs SQL-native recall |
| Versioning | Calver releases (`2026.9.9`), release trains, appcasts | Live checkout + PM-managed updates, fast-forward upgrades | Distribution channel shapes the versioning |
| Team mode | First-class: one Gateway, many humans, shared sessions | First-class differently: delegate to subagents, hosted rooms | Human-team vs agent-fleet |

## 9. Glossary

- **Harness** — an adapter that runs the agent loop for a specific agent product (OpenClaw built-in,
  Codex plugin, …). Registered by runtime id.
- **Turn lease** — a durable, cross-process ownership record for "this turn is running on behalf of
  session X."
- **Compaction / retention** — shrinking live context (summaries, pruning) while preserving task
  state; a first-class subsystem in both.
- **Auxiliary model** — cheap/secondary model used for titles, summaries, compression, guardian
  reviews; never pollutes the main transcript.
- **Code mode / RPC execution** — letting the model run code that calls tools programmatically to
  save round-trips.
- **Pairing** — DM onboarding handshake that gates unknown senders behind human approval.
- **Skill (agentskills.io)** — a portable markdown package of instructions + resources + config the
  agent can load, run, and (in Hermes) author.

## 10. Appendix — where to keep digging

- OpenClaw: `docs/agent-runtime-architecture.md`, `docs/openclaw-agent-runtime.md`,
  `src/gateway/agent-turn/`, `packages/agent-core/src/agent-loop.ts`,
  `packages/worker-runtime/README.md`, `extensions/`, `docs/channels/`.
- Hermes: root `AGENTS.md` + `agent/AGENTS.md` (excellent module maps), `agent/conversation_loop.py`,
  `agent/turn_*.py`, `tools/approval*.py`, `toolsets.py`, `skills/` + `optional-skills/`,
  `hermes_state_*.py`, `website/docs/developer-guide/creating-skills.md`.

---

*Compiled from direct source reads (README/VISION/SOUL/AGENTS files, entry chains, turn loops,
tool/gateway/state layers, pyproject/pnpm metadata). Every claim is anchored to a file path in the
mirrored trees under `sources/` — re-open any file to verify or go deeper.*
