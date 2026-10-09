# @deango/hands — OpenClaw plugin binding the Hermes brain

The deepest *sanctioned* Hermes×OpenClaw connection: a native OpenClaw
plugin, built only on `openclaw/plugin-sdk` public barrels plus the ACP v1
protocol. No patching of either body, no internal imports — so either side
can update without breaking the organism (the only exception, by contract,
is an ACP protocol change itself).

## What it does

- Registers an ACP runtime backend with id **`hermes`** inside OpenClaw
  (`register.runtime.ts` → sdk `acp-runtime-backend` barrel; the backend
  proxy lazy-loads `src/service.ts`).
- The service spawns the brain (`hermes acp` by default), performs the ACP
  `initialize` handshake, and opens sessions with **resume reattach**
  (`session/load` + provenance `_meta`) so restarts continue conversations
  rather than forking new ones.
- Session bindings persist at
  `<openclaw-state-dir>/deango-hands/session-bindings.json`.

## Configuration (`configSchema` in `openclaw.plugin.json`)

| Key | Meaning | Default |
|---|---|---|
| `command` | brain launch command | `hermes acp` |
| `args` | extra args to command | `[]` |
| `env` | extra env vars | `{}` |
| `cwd` | working dir for the brain process | inherited |
| `timeoutSeconds` | ACP request timeout | `60` |
| `permissionMode` | `deny` / `allow-once` / `allow` | `deny` |
| `nonInteractivePermissions` | auto-non-interactive when approvals impossible | `true` |
| `sessionResume` | reattach via `session/load` | `true` |
| `provenance` | `_meta` provenance tag sent on open | deanGo organism tag |
| `mcpServers` | extra MCP servers to hand the brain | `[]` |

The manifest also declares `configContracts`, `backupResources` and a
`doctorContract`, letting OpenClaw validate, back up, and diagnose the
binding through its own plugin machinery.

## Update resilience

Pair this plugin with the DeanGo watchdog (`deango compat --heal`, Watchdog
tab in the console): version/location drift vs. the connection manifest is
detected after either body self-updates, the ACP spine is live-probed, and
the connection is re-rendered in place. See `bridge/docs/UPDATE-RESILIENCE.md`.
