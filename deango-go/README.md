# DeanGo Core (Go) 🧠⚡🦞

The organism's engine as **one static binary** — stdlib-only Go, no `go get` needed.

DeanGo is **not an agent**. The brain is Hermes, the limbs are OpenClaw; this core
detects, inspects, connects, supervises, and probes them. The Node app in
[`../deango`](../deango) is the UI/console layer and drives this binary automatically.

## Build

```bash
cd deango-go
go build -o deango ./cmd/deango    # produces ./deango (static, ~10 MB)
```

The Node console auto-detects the binary at `deango-go/deango` (override with
`DEANGO_CORE_BIN=/path/to/deango`) and switches its engine badge to **go**.
Without the binary it runs its built-in Node engine as a fallback.

## Commands (all print JSON on stdout)

| Command | What it does |
|---|---|
| `deango detect` | Scan machine: hermes/openclaw/node bins, versions, homes, checkouts, config candidates |
| `deango inspect` | Deep-map both setups (skills/plugins/extensions inventories, config/state) |
| `deango doctor` | One-shot readiness report |
| `deango connect [--apply]` | Render connection files to `~/.deango` (+ merge into live configs with timestamped backups) |
| `deango connect-plan` | Show the render without writing |
| `deango setup [--confirm] [step]` | Automated-install plan; executes only with `--confirm` |
| `deango up / down / status / logs` | Supervise organism process units |
| `deango probe [--cmd X] [--prompt ...] [--list] [--allow-once]` | Live ACP v1 handshake with the brain |
| `deango version` | Core version info |

## Layout

```
cmd/deango/main.go          CLI router (stdout JSON contract)
internal/detect             machine scan
internal/inspect            setup deep-map
internal/connect            connection file render + live merge
internal/setup              install planner (confirm-gated)
internal/supervisor         process units (unix+windows split: proc_*.go)
internal/acp                ACP v1 stdio client + probe (fail-fast dead-brain)
internal/util               subprocess/walk/merge/managed-block helpers
internal/model              wire shapes (mirrors the Node engine)
```

Wire contract note: every JSON shape mirrors the previous Node engine 1:1, so the
GUI and any scripts that consumed `deango <cmd> --json`-style output are unchanged
whichever core serves them.
