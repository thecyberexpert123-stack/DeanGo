/**
 * supervisor.mjs — DeanGo's process babysitter for the organism's units.
 * Units come from $DEANGO_HOME/connection/units.json (written by connect).
 * State: pid files + logs under $DEANGO_HOME/run/<unitId>/.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { DEANGO_HOME, readJson, isFile } from "./util.mjs";

const runDir = (id) => path.join(DEANGO_HOME, "run", id);
const pidPath = (id) => path.join(runDir(id), "unit.pid");
const logPath = (id) => path.join(runDir(id), "unit.log");

export async function listUnits() {
  const cfg = (await readJson(path.join(DEANGO_HOME, "connection", "units.json"))) || { units: [] };
  const out = [];
  for (const u of cfg.units) {
    const st = await statusUnit(u.id);
    out.push({ ...u, status: st });
  }
  return out;
}

export async function statusUnit(id) {
  const pf = pidPath(id);
  if (!isFile(pf)) return { running: false };
  const pid = Number(fs.readFileSync(pf, "utf8").trim());
  try { process.kill(pid, 0); return { running: true, pid }; }
  catch { return { running: false, stalePid: pid }; }
}

export async function startUnit(id) {
  const cfg = (await readJson(path.join(DEANGO_HOME, "connection", "units.json"))) || { units: [] };
  const u = cfg.units.find((x) => x.id === id);
  if (!u) return { ok: false, error: `unknown unit ${id}` };
  const st = await statusUnit(id);
  if (st.running) return { ok: true, already: true, pid: st.pid };

  await fsp.mkdir(runDir(id), { recursive: true });
  const logFd = fs.openSync(logPath(id), "a");
  const child = spawn(u.cmd, u.args || [], {
    cwd: u.cwd || DEANGO_HOME, env: { ...process.env, ...(u.env || {}) },
    detached: true, stdio: ["ignore", logFd, logFd],
  });
  child.on("error", (e) => {
    fs.appendFileSync(logPath(id), `\n[supervisor] spawn error: ${e}\n`);
  });
  child.unref();
  fs.writeFileSync(pidPath(id), String(child.pid));
  return { ok: true, pid: child.pid, log: logPath(id) };
}

export async function stopUnit(id) {
  const st = await statusUnit(id);
  if (!st.running) { try { fs.unlinkSync(pidPath(id)); } catch {} return { ok: true, was: "stopped" }; }
  try { process.kill(-st.pid, "SIGTERM"); } catch { try { process.kill(st.pid, "SIGTERM"); } catch (e) { return { ok: false, error: String(e) }; } }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const s = await statusUnit(id);
    if (!s.running) { try { fs.unlinkSync(pidPath(id)); } catch {} return { ok: true }; }
    await new Promise((r) => setTimeout(r, 200));
  }
  try { process.kill(-st.pid, "SIGKILL"); } catch { try { process.kill(st.pid, "SIGKILL"); } catch {} }
  try { fs.unlinkSync(pidPath(id)); } catch {}
  return { ok: true, forced: true };
}

export function tailLog(id, lines = 200) {
  try {
    const text = fs.readFileSync(logPath(id), "utf8");
    return text.split("\n").slice(-lines).join("\n");
  } catch { return ""; }
}
