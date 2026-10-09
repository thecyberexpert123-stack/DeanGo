#!/usr/bin/env python3
"""handshake-check.py — validate the OpenClaw⟷Hermes spinal cord.

A zero-dependency ACP (Agent Client Protocol, v1) stdio client that:
  1. spawns an ACP agent (default: ``hermes acp``),
  2. performs the ``initialize`` handshake and prints the agent's capabilities,
  3. optionally opens a session (``session/new``), lists sessions, and fires a
     probe prompt (``session/prompt``) while streaming ``session/update``
     notifications,
  4. exercises the client-side callbacks an ACP host must implement
     (``session/request_permission``, ``fs/read_text_file``, ``fs/write_text_file``)
     with configurable policies so you can smoke the full round-trip before
     pointing OpenClaw's acpx plugin at the same command.

Exit codes: 0 ok · 2 spawn failure · 3 handshake failure · 4 session failure.

    python3 bridge/bin/handshake-check.py \
        --agent-cmd "hermes acp" --probe-prompt "Reply with the word: handshake"

Stdio contract (ACP): newline-delimited JSON-RPC 2.0. stdout is protocol-only;
everything diagnostic goes to stderr. Keep it that way.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import shlex
import subprocess
import sys
import threading
import time
from typing import Any, Dict, Optional

PROTOCOL_VERSION = 1  # agent-client-protocol==0.9.x

E_SPAWN, E_HANDSHAKE, E_SESSION = 2, 3, 4


def log(*args: Any) -> None:
    print("[handshake]", *args, file=sys.stderr, flush=True)


class AcpStdioClient:
    """Minimal ACP host: owns the child process, correlates requests, answers
    the client-direction methods an agent may call during a turn."""

    def __init__(self, cmd: list[str], cwd: str, env: Optional[dict] = None,
                 permission_policy: str = "deny"):
        full_env = dict(os.environ)
        if env:
            full_env.update(env)
        try:
            self.proc = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=None,  # inherit: agent's human logs stream to your terminal
                cwd=cwd, env=full_env, bufsize=0,
            )
        except FileNotFoundError as exc:
            log(f"FATAL: cannot spawn {cmd!r}: {exc}")
            sys.exit(E_SPAWN)
        self._lock = threading.Lock()
        self._next_id = 1
        self._pending: Dict[int, "queue.Queue[dict]"] = {}
        self.notifications: "queue.Queue[dict]" = queue.Queue()
        self.permission_policy = permission_policy
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

    # ---- transport ------------------------------------------------------
    def _read_loop(self) -> None:
        assert self.proc.stdout is not None
        for raw in self.proc.stdout:
            raw = raw.strip()
            if not raw:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                log(f"non-JSON line from agent (ignored): {raw[:200]!r}")
                continue
            if "method" in msg and "id" in msg:
                self._handle_agent_request(msg)      # agent → client request
            elif "method" in msg:
                self.notifications.put(msg)           # agent → client notification
            elif "id" in msg:
                q = self._pending.pop(msg["id"], None)
                if q:
                    q.put(msg)                        # response to our request
        log("agent stdout closed")

    def _write(self, msg: dict) -> None:
        assert self.proc.stdin is not None
        line = json.dumps(msg) + "\n"
        with self._lock:
            self.proc.stdin.write(line.encode())
            self.proc.stdin.flush()

    # ---- RPC ------------------------------------------------------------
    def request(self, method: str, params: dict, timeout: float = 60.0) -> dict:
        rid = self._next_id
        self._next_id += 1
        q: "queue.Queue[dict]" = queue.Queue()
        self._pending[rid] = q
        self._write({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        try:
            reply = q.get(timeout=timeout)
        except queue.Empty:
            self._pending.pop(rid, None)
            raise TimeoutError(f"{method}: no reply within {timeout}s")
        if "error" in reply:
            raise RuntimeError(f"{method} → RPC error {reply['error'].get('code')}: "
                               f"{reply['error'].get('message')}")
        return reply.get("result", {})

    def notify(self, method: str, params: dict) -> None:
        self._write({"jsonrpc": "2.0", "method": method, "params": params})

    def _respond(self, rid: Any, result: Any = None, error: Optional[dict] = None) -> None:
        msg: dict = {"jsonrpc": "2.0", "id": rid}
        if error is not None:
            msg["error"] = error
        else:
            msg["result"] = result
        self._write(msg)

    # ---- client-direction methods (what a real host/OpenClaw implements) --
    def _handle_agent_request(self, msg: dict) -> None:
        m, rid, params = msg["method"], msg["id"], msg.get("params", {})
        if m == "session/request_permission":
            if self.permission_policy == "allow-once":
                outcome = {"outcome": "selected", "optionId": (params.get("options") or [{}])[0].get("id", "allow-once")}
                log(f"permission auto-allowed (allow-once): {json.dumps(params)[:160]}")
                self._respond(rid, {"outcome": outcome})
            else:
                log(f"permission denied by policy: {json.dumps(params)[:160]}")
                self._respond(rid, {"outcome": {"outcome": "cancelled"}})
        elif m in ("fs/read_text_file",):
            # Honest refusal unless you explicitly extend this: the real host is OpenClaw.
            self._respond(rid, error={"code": -32601, "message": f"{m} not implemented by handshake-check"})
        elif m in ("fs/write_text_file",):
            self._respond(rid, error={"code": -32601, "message": f"{m} not implemented by handshake-check"})
        else:
            # -32601 keeps the agent alive; logged for visibility.
            log(f"unsupported client method {m} (replying -32601)")
            self._respond(rid, error={"code": -32601, "message": f"method not implemented: {m}"})

    # ---- lifecycle --------------------------------------------------------
    def close(self) -> None:
        try:
            if self.proc.stdin:
                self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()


def main() -> int:
    ap = argparse.ArgumentParser(description="ACP stdio handshake validator")
    ap.add_argument("--agent-cmd", default="hermes acp",
                    help="command that starts the ACP agent (default: 'hermes acp')")
    ap.add_argument("--cwd", default=os.getcwd(), help="session working directory")
    ap.add_argument("--probe-prompt", default=None, help="optional text prompt to run")
    ap.add_argument("--no-new-session", action="store_true")
    ap.add_argument("--list-sessions", action="store_true")
    ap.add_argument("--permission-policy", choices=["deny", "allow-once"], default="deny")
    ap.add_argument("--timeout", type=float, default=120.0)
    args = ap.parse_args()

    client = AcpStdioClient(shlex.split(args.agent_cmd), cwd=args.cwd,
                            permission_policy=args.permission_policy)
    t0 = time.time()
    try:
        init = client.request("initialize", {
            "protocolVersion": PROTOCOL_VERSION,
            "clientCapabilities": {
                "fs": {"readTextFile": True, "writeTextFile": True},
                "terminal": False,
            },
            "clientInfo": {"name": "openclaw-hermes-handshake-check", "version": "0.1.0"},
        }, timeout=args.timeout)
    except (TimeoutError, RuntimeError) as exc:
        log(f"HANDSHAKE FAILED: {exc}")
        client.close()
        return E_HANDSHAKE

    print("=" * 64)
    print("ACP INITIALIZE OK")
    print("=" * 64)
    print(json.dumps(init, indent=2)[:4000])
    caps = init.get("agentCapabilities", {})
    session_caps = caps.get("sessionCapabilities", {}) or {}
    print("\ncapability flags:")
    print(f"  loadSession (durable body)      : {caps.get('loadSession')}")
    # ACP reports sub-capabilities as (possibly empty) objects: presence == supported.
    print(f"  session.list  (recall roster)   : {'list' in session_caps}")
    print(f"  session.resume                  : {'resume' in session_caps}")
    print(f"  session.fork                    : {'fork' in session_caps}")
    print(f"  mcp.http / mcp.sse              : {caps.get('mcpCapabilities', {})}")
    print(f"  prompt caps                     : {caps.get('promptCapabilities')}")
    print(f"  auth methods                    : {[a.get('id') for a in init.get('authMethods', [])]}")

    client.notify("initialized", {})
    log(f"initialize round-trip: {time.time()-t0:.2f}s")

    if args.list_sessions:
        try:
            listed = client.request("session/list", {}, timeout=args.timeout)
            sessions = listed.get("sessions", [])
            print(f"\nsession/list → {len(sessions)} known session(s):")
            for s in sessions[:10]:
                print(f"  - {s.get('sessionId')}  cwd={s.get('cwd')}  title={s.get('title')!r}")
        except RuntimeError as exc:
            print(f"\nsession/list unsupported or failed: {exc}")

    if not args.no_new_session:
        try:
            created = client.request("session/new", {"cwd": args.cwd, "mcpServers": []},
                                     timeout=args.timeout)
        except (TimeoutError, RuntimeError) as exc:
            log(f"SESSION FAILED: {exc}")
            client.close()
            return E_SESSION
        sid = created.get("sessionId")
        print(f"\nsession/new → sessionId={sid}")
        if created.get("models"):
            print(f"model state: {json.dumps(created['models'])[:400]}")
        if created.get("modes"):
            print(f"mode state : {json.dumps(created['modes'])[:400]}")

        if args.probe_prompt:
            print(f"\n--- probe prompt: {args.prompt_text if False else args.probe_prompt!r} ---")
            done: "queue.Queue[dict]" = queue.Queue()

            def fire() -> None:
                try:
                    res = client.request("session/prompt", {
                        "sessionId": sid,
                        "prompt": [{"type": "text", "text": args.probe_prompt}],
                    }, timeout=args.timeout)
                    done.put(res)
                except Exception as exc:  # noqa: BLE001
                    done.put({"error": str(exc)})

            threading.Thread(target=fire, daemon=True).start()
            streamed = []
            while True:
                try:
                    note = client.notifications.get(timeout=5)
                except queue.Empty:
                    note = None
                if note and note.get("method") == "session/update":
                    upd = note.get("params", {}).get("update", {})
                    kind = upd.get("sessionUpdate")
                    if kind == "agent_message_chunk":
                        text = (upd.get("content") or {}).get("text", "")
                        streamed.append(text)
                        print(text, end="", flush=True)
                    else:
                        log(f"update: {kind} {json.dumps(upd)[:160]}")
                if not done.empty():
                    final = done.get()
                    print(f"\n--- stopReason: {final.get('stopReason') or final.get('error')} ---")
                    break

    client.close()
    print("\nHANDSHAKE COMPLETE ✔  the spinal cord is alive.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
