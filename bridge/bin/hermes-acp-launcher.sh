#!/usr/bin/env bash
# hermes-acp-launcher.sh — the process OpenClaw spawns to reach the Hermes brain.
#
# OpenClaw's acpx plugin starts one of these per agent definition (see
# bridge/openclaw/acpx.hermes.config.json → agents.hermes.command). ACP is spoken
# on stdio as newline-delimited JSON-RPC; ANYTHING this script writes to stdout
# before `exec` would corrupt the protocol — all diagnostics go to stderr.
set -euo pipefail

log() { printf '[hermes-acp-launcher] %s\n' "$*" >&2; }

# --- 0. Locate the brain -----------------------------------------------------
# Prefer an explicit override; then a Hermes checkout (dev); then PATH (pip install).
HERMES_HOME_DIR="${HERMES_HOME:-$HOME/.hermes}"
HERMES_CHECKOUT="${HERMES_CHECKOUT:-}"

if [[ -n "$HERMES_CHECKOUT" && -d "$HERMES_CHECKOUT/acp_adapter" ]]; then
  export PYTHONPATH="${HERMES_CHECKOUT}${PYTHONPATH:+:$PYTHONPATH}"
  LAUNCH=( python -m acp_adapter )
  log "using dev checkout at $HERMES_CHECKOUT"
elif command -v hermes-acp >/dev/null 2>&1; then
  LAUNCH=( hermes-acp )
elif command -v hermes >/dev/null 2>&1; then
  LAUNCH=( hermes acp )
else
  log "FATAL: no hermes found. Set HERMES_CHECKOUT=/path/to/hermes-agent or install hermes."
  exit 127
fi

# --- 1. Workspace discipline -------------------------------------------------
# The brain thinks about one workspace at a time. acpx passes the session cwd
# through ACP session/new; this default only matters for pre-session work.
export HERMES_WORKSPACE_ROOT="${HERMES_WORKSPACE_ROOT:-$PWD}"

# --- 2. Env hygiene ----------------------------------------------------------
# Never let a stray proxy or TTY assumption from the host gateway leak into the
# brain. Preserve provider API keys; drop everything interactive.
mkdir -p "$HERMES_HOME_DIR"
export HERMES_HOME="$HERMES_HOME_DIR"
export PYTHONUNBUFFERED=1            # no stdio buffering between brain and cord
export PYTHONIOENCODING=utf-8
export TERM=dumb                     # the brain must never draw a TUI on stdio
export NO_COLOR=1
export HERMES_NON_INTERACTIVE=1      # approvals flow over ACP, not the console
export HERMES_ACP_STDIO=1

# --- 3. Optional: pin the provider route the body should default to ----------
# acpx can carry model selection through ACP session/set_model; this is only the
# fallback when the OpenClaw side does not choose.
# export HERMES_DEFAULT_MODEL="${HERMES_DEFAULT_MODEL:-nous/hermes-4-405b}"

log "exec: ${LAUNCH[*]}  (cwd=$PWD, HERMES_HOME=$HERMES_HOME)"
exec "${LAUNCH[@]}"
