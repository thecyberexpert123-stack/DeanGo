/**
 * inspect.mjs — given a DetectionReport, map the setups in depth:
 * files, locations, sizes, skills/plugins/extensions inventories, and current
 * bridge-related config state. Read-only; bounded walks; never follows
 * node_modules/.git.
 */
import path from "node:path";
import { walk, headText, isFile, countMatching, readJson } from "./util.mjs";

function summarizeTree(root) {
  if (!root) return null;
  const entries = walk(root, { maxDepth: 3, maxEntries: 400 });
  const dirs = entries.filter((e) => e.dir).map((e) => e.path);
  const files = entries.filter((e) => !e.dir);
  return {
    root,
    totalShown: entries.length,
    truncated: entries.length >= 400,
    topDirs: dirs.filter((d) => !d.includes(path.sep)).slice(0, 40),
    configFiles: files.filter((f) => /\.(json|yaml|yml|toml|env)$/.test(f.path)).slice(0, 60),
    stateLike: files.filter((f) => /\.(db|sqlite|sqlite3|wal)$|sessions|state/.test(f.path)).slice(0, 60),
    tree: entries.slice(0, 250),
  };
}

export async function inspectHermes(det) {
  const h = det.hermes;
  if (!h.installed) return { present: false, note: "hermes not detected" };
  const base = h.checkout || h.home;
  const out = { present: true, base: summarizeTree(base) };

  if (h.checkout) {
    out.skills = {
      builtin: countMatching(path.join(h.checkout, "skills"), (f) => f.endsWith("SKILL.md")),
      optional: countMatching(path.join(h.checkout, "optional-skills"), (f) => f.endsWith("SKILL.md")),
    };
    out.agentModules = countMatching(path.join(h.checkout, "agent"), (f) => f.endsWith(".py"));
    out.acpAdapterPresent = isFile(path.join(h.checkout, "acp_adapter", "server.py"));
    out.stateModules = countMatching(h.checkout, (f) => /hermes_state.*\.py$/.test(f));
  }
  if (h.home && h.home !== h.checkout) out.homeTree = summarizeTree(h.home);
  if (h.configFiles?.length) {
    out.config = {};
    for (const f of h.configFiles) out.config[f] = headText(f, 6);
  }
  return out;
}

export async function inspectOpenclaw(det) {
  const o2 = det.openclaw;
  if (!o2.installed) return { present: false, note: "openclaw not detected" };
  const base = o2.checkout || o2.npmGlobal || o2.home;
  const out = { present: true, base: summarizeTree(base) };

  if (o2.checkout) {
    out.extensions = countMatching(path.join(o2.checkout, "extensions"), (f) => f.endsWith("openclaw.plugin.json"));
    out.acpxPresent = isFile(path.join(o2.checkout, "extensions", "acpx", "openclaw.plugin.json"));
  }
  // Current bridge configuration state (if a JSON gateway config was found).
  for (const cfg of o2.configFiles || []) {
    if (cfg.endsWith(".json")) {
      const parsed = await readJson(cfg);
      if (parsed) {
        out.gatewayConfig = {
          path: cfg,
          hasPluginsKey: "plugins" in parsed,
          acpxConfigured: JSON.stringify(parsed).includes('"acpx"'),
          hermesAgentConfigured: JSON.stringify(parsed).includes('"hermes"'),
          head: headText(cfg, 4),
        };
        break;
      }
    } else {
      out.gatewayConfig = { path: cfg, format: "yaml", head: headText(cfg, 4) };
      break;
    }
  }
  return out;
}

export async function inspectAll(det) {
  return {
    scannedAt: new Date().toISOString(),
    hermes: await inspectHermes(det),
    openclaw: await inspectOpenclaw(det),
  };
}
