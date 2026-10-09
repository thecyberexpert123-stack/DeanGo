/**
 * gocore.mjs — engine facade. Prefers the Go core binary; falls back to the
 * Node engine implementation when the binary is absent (e.g. pre-build).
 *
 * Resolution order:
 *   1. $DEANGO_CORE_BIN
 *   2. <repo>/deango-go/deango (build with: cd deango-go && go build -o deango ./cmd/deango)
 *
 * The Go CLI speaks JSON on stdout, so every call here is a thin shell-out with
 * the exact same signatures as the Node engine modules.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, DEANGO_HOME } from "./util.mjs";

// Node engine (fallback) — kept intact and used automatically.
import { detectAll as nDetectAll } from "./detect.mjs";
import { inspectAll as nInspectAll } from "./inspect.mjs";
import { planConnection as nPlanConnection, buildConnection as nBuildConnection } from "./connect.mjs";
import { planSetup as nPlanSetup, runStep as nRunStep } from "./setup.mjs";
import { listUnits as nListUnits, startUnit as nStartUnit, stopUnit as nStopUnit, tailLog as nTailLog } from "./supervisor.mjs";
import { probeAcp as nProbeAcp } from "./acp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let core = null; // { mode: 'go'|'node-fallback', bin }

export function resolveCore() {
  if (core) return core;
  const candidates = [
    process.env.DEANGO_CORE_BIN,
    path.join(__dirname, "..", "..", "deango-go", "deango"),
    path.join(__dirname, "..", "..", "deango-go", "deango.exe"),
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) { core = { mode: "go", bin }; return core; }
  }
  core = { mode: "node-fallback", bin: null };
  return core;
}

export async function coreInfo() {
  const c = resolveCore();
  if (c.mode === "go") {
    const v = await run(c.bin, ["version"], { timeoutMs: 5000 });
    return { ...c, raw: v.stdout.trim() };
  }
  return c;
}

async function go(args, { timeoutMs = 120000 } = {}) {
  const { bin } = resolveCore();
  const r = await run(bin, args, { timeoutMs });
  if (r.code !== 0 && !r.stdout.trim()) {
    throw new Error(`go core ${args[0]} failed: ${(r.stderr || r.error || "exit " + r.code).slice(0, 400)}`);
  }
  try { return JSON.parse(r.stdout); } catch {
    throw new Error(`go core ${args[0]} returned non-JSON: ${r.stdout.slice(0, 300)}`);
  }
}

const useGo = () => resolveCore().mode === "go";

// ---- engine facade (identical signatures to the Node engine) ---------------

export async function detectAll() {
  return useGo() ? (await go(["detect"])) : nDetectAll();
}
export async function inspectAll(det) {
  return useGo() ? (await go(["inspect"])) : nInspectAll(det || (await nDetectAll()));
}
export async function planConnection(det) {
  return useGo() ? (await go(["connect-plan"])) : nPlanConnection(det || (await nDetectAll()));
}
export async function buildConnection(det, { apply = false } = {}) {
  if (useGo()) return await go(["connect", ...(apply ? ["--apply"] : [])]);
  return nBuildConnection(det || (await nDetectAll()), { apply });
}
export async function planSetup(det) {
  return useGo() ? (await go(["setup"])) : nPlanSetup(det || (await nDetectAll()));
}
export async function runStep(plan, stepId, { confirm = false } = {}) {
  if (useGo()) return await go(["setup", stepId, ...(confirm ? ["--confirm"] : [])], { timeoutMs: 20 * 60 * 1000 });
  return nRunStep(plan || nPlanSetup(await nDetectAll()), stepId, { confirm });
}
export async function listUnits() {
  return useGo() ? (await go(["status"])) : nListUnits();
}
export async function startUnit(id) {
  if (useGo()) return (await go(["up", id]))[id];
  return nStartUnit(id);
}
export async function stopUnit(id) {
  if (useGo()) return (await go(["down", id]))[id];
  return nStopUnit(id);
}
export async function tailLog(id, lines = 200) {
  if (useGo()) return (await go(["logs", id, "--lines", String(lines)])).log;
  return nTailLog(id, lines);
}
export async function probeAcp(agentCmd, { prompt = null, listSessions = false, permissionPolicy = "deny", timeoutMs = 90000 } = {}) {
  if (useGo()) {
    const args = ["probe", "--cmd", agentCmd, "--timeout", `${Math.round(timeoutMs / 1000)}s`];
    if (prompt) args.push("--prompt", prompt);
    if (listSessions) args.push("--list");
    if (permissionPolicy === "allow-once") args.push("--allow-once");
    return await go(args, { timeoutMs: timeoutMs + 15000 });
  }
  return nProbeAcp(agentCmd, { prompt, listSessions, permissionPolicy, timeoutMs });
}
export { DEANGO_HOME };
