# Update-Resilient Hermes × OpenClaw Connection

Why: both bodies self-update. Hermes ships new releases, OpenClaw ships new
releases, and either update can silently move a binary, rename a home dir, or
change CLI defaults. The connection must survive every update **except** a
breaking ACP protocol change (explicitly out of scope — ACP is the spine
contract; if the spine's grammar itself changes, adapters must follow).

## Design rule

DeanGo only ever hooks **sanctioned surfaces**:

| Surface | Owner | Why it survives updates |
|---|---|---|
| `openclaw/plugin-sdk` barrels + `openclaw.plugin.json` | OpenClaw | The plugin API is OpenClaw's public contract for extensions; plugins are exactly how OpenClaw expects to be extended, so this surface is maintained across releases. |
| ACP v1 (`initialize`/`session_*` over stdio JSON-RPC) | Both | The declared interop protocol; versioned at handshake time via `protocolVersion`. |
| Managed config blocks (`# >>> deango:* >>>`) and merge-with-backup | DeanGo | Idempotent upserts into each body's own config, always recomputable. |

DeanGo owns a **thin, versioned adapter layer** (`bridge/`, `packages/openclaw-plugin-hands/`)
between the public contracts. When either body updates, only the adapter may
need a touch — never the bodies, and never DeanGo's core.

## The watchdog — `deango compat`

```
deango compat [--heal] [--cmd X] [--timeout 60s]     # CLI
POST /api/compat {heal:true|false}                   # console API
Watchdog tab in the web console                      # click-button version
```

One pass does three checks against `~/.deango/connection/manifest.json`
(recorded at connect time):

1. **Version drift** — `hermes --version` / `openclaw --version` changed.
2. **Location drift** — home dir, checkout, config paths, binary paths moved
   or vanished.
3. **Spine health** — a live ACP handshake against the `hermes-acp` unit
   (the ground truth: zero drift with a dead spine is still broken; drift
   with a live spine might be cosmetic).

Every pass writes `~/.deango/connection/health.json` (served at `GET /api/health`).

### Heal semantics (`--heal`)

- Re-renders **all** connection files against freshly-detected installs
  (paths recompute, bindings resnap).
- **Never upgrades privileges silently**: config-file merges are reapplied
  only if `manifest.apply` was true at connect time.
- Re-resolves the brain command after healing (units.json may have been
  rewritten with a corrected path), then re-probes the spine.
- Reports `probeAfterHeal.ok` — if that's false, the spine is genuinely
  broken (i.e. an ACP protocol change), and that's a human's ticket.

## Organism assignment — `organism.json`

Declarative role map written at connect time (single source of truth the
watchdog re-renders on heal):

- **brain** — Hermes: turn loop, memory, 212 skills, learning, SOUL/persona.
- **limbs** — OpenClaw: channels, devices, approvals, artifacts, ledger.
- **hands** — acpx MCP bridges (`openClawToolsMcpBridge`, `pluginToolsMcpBridge`).
- **legs** — channels (whatsapp/telegram/slack/…), noted, not reassigned.
- **spine contract** — `acp/v1`.

## The plugin — `@deango/hands` (`packages/openclaw-plugin-hands/`)

A native OpenClaw plugin built **only** on the plugin-sdk surface:

- Manifest `openclaw.plugin.json` declares id `deango-hands`, runtime kind
  `agent-runtimes`, plus `configSchema`, `configContracts`,
  `backupResources` and a `doctorContract` — so OpenClaw itself owns
  validation, backup and diagnostics of the binding.
- `register.runtime.ts` registers a backend with id `hermes` via the sdk's
  `acp-runtime-backend` barrel; the proxy lazy-loads `src/service.ts`.
- `src/service.ts` spawns the brain from config (`hermes acp` by default),
  runs `initialize`, opens sessions with `session/load` reattach +
  provenance `_meta`, and persists session bindings at
  `<stateDir>/deango-hands/session-bindings.json` — so restarts resume
  conversations instead of forking them.

Install into an OpenClaw state dir, point `command` at your Hermes binary;
the watchdog will keep the rest aligned across updates.
