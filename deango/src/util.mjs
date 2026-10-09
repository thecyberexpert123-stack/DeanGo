#!/usr/bin/env node
/**
 * util.mjs — shared primitives for DeanGo (zero-dependency, Node >= 18).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const HOME = os.homedir();
export const DEANGO_HOME = process.env.DEANGO_HOME || path.join(HOME, ".deango");

export function log(...a) { console.log("[deango]", ...a); }
export function warn(...a) { console.warn("[deango]", ...a); }

/** Filesystem existence */
export const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
export const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
export const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/** PATH lookup across platforms */
export function which(cmd) {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      if (isFile(p)) return p;
    }
  }
  return null;
}

/** Run a command with timeout; never throws. Returns {code, stdout, stderr, ms, error?} */
export function run(cmd, args = [], opts = {}) {
  const { timeoutMs = 8000, cwd, env } = opts;
  const started = Date.now();
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env });
    } catch (error) {
      return resolve({ code: -1, stdout: "", stderr: "", ms: 0, error: String(error) });
    }
    let stdout = "", stderr = "", done = false;
    const finish = (code) => { if (!done) { done = true; resolve({ code, stdout, stderr, ms: Date.now() - started }); } };
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} finish(-2); }, timeoutMs);
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (error) => { clearTimeout(timer); finish(-1); });
    child.on("close", (code) => { clearTimeout(timer); finish(code ?? 0); });
  });
}

/** Shallow+recursive merge for plain JSON objects (b wins; arrays/scalars replaced). */
export function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b) || typeof a !== "object" || typeof b !== "object" || !a || !b) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out;
}

export async function readJson(p) { try { return JSON.parse(await fsp.readFile(p, "utf8")); } catch { return null; } }
export async function writeJson(p, obj) { await fsp.mkdir(path.dirname(p), { recursive: true }); await fsp.writeFile(p, JSON.stringify(obj, null, 2) + "\n"); }

/** Idempotent managed-block upsert for text configs (yaml and friends). */
export function upsertManagedBlock(text, marker, block) {
  const begin = `# >>> deango:${marker} >>>`;
  const end = `# <<< deango:${marker} <<<`;
  const wrapped = `${begin}\n${block.replace(/\n$/, "")}\n${end}`;
  const re = new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  return re.test(text) ? text.replace(re, wrapped) : (text.replace(/\n?$/, "\n\n") + wrapped + "\n");
}

/** Walk a dir with hard caps; returns relative entries. */
export function walk(root, { maxDepth = 3, maxEntries = 400 } = {}) {
  const out = [];
  const stack = [{ p: root, d: 0 }];
  while (stack.length && out.length < maxEntries) {
    const { p, d } = stack.pop();
    let ents = [];
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (out.length >= maxEntries) break;
      const full = path.join(p, e.name);
      const rel = path.relative(root, full);
      if (e.name === "node_modules" || e.name === ".git") continue;
      let size = 0; try { size = fs.statSync(full).size; } catch {}
      out.push({ path: rel, dir: e.isDirectory(), size });
      if (e.isDirectory() && d + 1 < maxDepth) stack.push({ p: full, d: d + 1 });
    }
  }
  return out;
}

/** First N KB of a text file, or null. */
export function headText(p, kb = 8) {
  try { return fs.readFileSync(p).subarray(0, kb * 1024).toString("utf8"); } catch { return null; }
}

/** Count files matching a predicate under root (with caps for safety). */
export function countMatching(root, predicate, cap = 20000) {
  let n = 0;
  const stack = [root];
  while (stack.length) {
    const p = stack.pop();
    let ents = [];
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") stack.push(full); }
      else if (predicate(full)) { n++; if (n >= cap) return n; }
    }
  }
  return n;
}
