#!/usr/bin/env python3
"""mock_acp_agent.py — a minimal ACP v1 stdio agent for offline testing.

Implements just enough of the Agent Client Protocol to prove the
handshake-check client plumbing without a live Hermes install:

  initialize      → capabilities mirroring hermes acp_adapter's shape
  session/new     → fake session with model + mode state
  session/list    → the fake registry
  session/prompt  → echoes the prompt as streamed agent_message_chunk updates,
                    then "ends turn" with stopReason=end_turn

Run against it:

  python3 bridge/bin/handshake-check.py \
      --agent-cmd "python3 bridge/tests/mock_acp_agent.py" \
      --probe-prompt "hello" --list-sessions
"""

import json
import sys

PROTOCOL_VERSION = 1


def send(msg: dict) -> None:
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def result(rid, value):
    send({"jsonrpc": "2.0", "id": rid, "result": value})


def main() -> None:
    registry: list[dict] = []
    counter = 0
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        method, rid, params = msg.get("method"), msg.get("id"), msg.get("params", {})

        if method == "initialize":
            result(rid, {
                "protocolVersion": PROTOCOL_VERSION,
                "agentCapabilities": {
                    "loadSession": True,
                    "promptCapabilities": {"image": True, "audio": False, "embeddedContext": True},
                    "mcpCapabilities": {"http": True, "sse": True},
                    "sessionCapabilities": {"list": {}, "resume": {}, "fork": {}},
                },
                "agentInfo": {"name": "mock-acp-agent", "version": "0.0.1"},
                "authMethods": [{"id": "terminal-setup", "name": "Mock auth"}],
            })
        elif method == "session/new":
            counter += 1
            sid = f"mock-session-{counter:03d}"
            registry.append({"sessionId": sid, "cwd": params.get("cwd"), "title": "Mock session"})
            result(rid, {
                "sessionId": sid,
                "models": {
                    "currentModelId": "mock-model",
                    "availableModels": [{"modelId": "mock-model", "name": "Mock Model"}],
                },
                "modes": {
                    "currentModeId": "default",
                    "availableModes": [
                        {"id": "default", "name": "Default", "description": "Ask before edits."}
                    ],
                },
            })
        elif method == "session/list":
            result(rid, {"sessions": registry, "nextCursor": None})
        elif method == "session/load" or method == "session/resume":
            result(rid, {})
        elif method == "session/prompt":
            sid = params.get("sessionId")
            text = " ".join(
                b.get("text", "") for b in params.get("prompt", []) if b.get("type") == "text"
            )
            for chunk in (f"I heard: {text} ", "— the spinal cord works. "):
                send({"jsonrpc": "2.0", "method": "session/update", "params": {
                    "sessionId": sid,
                    "update": {"sessionUpdate": "agent_message_chunk",
                               "content": {"type": "text", "text": chunk}},
                }})
            result(rid, {"stopReason": "end_turn"})
        elif rid is not None:
            send({"jsonrpc": "2.0", "id": rid,
                  "error": {"code": -32601, "message": f"unknown method: {method}"}})


if __name__ == "__main__":
    main()
