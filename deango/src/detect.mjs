/**
 * detect.mjs — find the limbs and the brain on this machine.
 *
 * Produces a DetectionReport: for each component (hermes, openclaw, node, pm)
 * — installed?, binaries (+versions), home/state dirs, config file candidates,
 * source checkouts. Never mutates anything; safe to run anytime.
 */
import os from "node:os";
import path from "node:path";
import { HOME, which, run, exists, isDir, isFile, headText } from "./util.mjs";

const CANDIDATES = {
  hermesDirs: [
    ".hermes", ".local/share/hermes", ".config/hermes",
    "src/hermes-agent", "code/hermes-agent", "hermes-agent", "opt/hermes-agent",
  ],
  openclawDirs: [
    ".openclaw", ".config/openclaw", ".local/share/openclaw",
    ".local/state/openclaw", "src/openclaw", "code/openclaw", "openclaw",
  ],
};

function firstExisting(homeRooted) {
  const found = [];
  for (const rel of homeRooted) {
    const p = path.isAbsolute(rel) ? rel : path.join(HOME, rel);
    if (exists(p)) found.push(p);
  }
  return found;
}

async function probeVersion(bin, args = ["--version"], timeoutMs = 6000) {
  if (!bin) return null;
  const r = await run(bin, args, { timeoutMs });
  if (r.code !== 0 && r.code !== -2) return null;
  return (r.stdout || r.stderr).trim().split("\n")[0]?.slice(0, 200) || null;
}

async function detectNode() {
  const bin = which("node");
  const version = bin ? (await probeVersion(bin)).replace(/^v/, "") : null;
  const npmBin = which("npm");
  let npmRoot = null;
  if (npmBin) {
    const r = await run(npmBin, ["root", "-g"], { timeoutMs: 8000 });
    if (r.code === 0) npmRoot = r.stdout.trim() || null;
  }
  return { installed: !!bin, bin, version, npm: { bin: npmBin, globalRoot: npmRoot } };
}

async function detectHermes(nodeReport) {
  const bins = ["hermes", "hermes-acp", "hermes-agent"]
    .map((n) => ({ name: n, path: which(n) })).filter((b) => b.path);
  const version = bins[0] ? await probeVersion(bins[0].path, ["--version"]) : null;

  const dirs = firstExisting(CANDIDATES.hermesDirs);
  const home = dirs.find((d) => isDir(d)) || null;

  // A source checkout has pyproject.toml with name = "hermes-agent".
  let checkout = null;
  for (const d of dirs) {
    const marker = path.join(d, "pyproject.toml");
    if (isFile(marker) && (headText(marker) || "").includes('name = "hermes-agent"')) { checkout = d; break; }
  }

  // Config candidates (hermes home is ~/.hermes; config name cli-config.yaml).
  const candidates = home ? [
    path.join(home, "cli-config.yaml"),
    path.join(home, "config.yaml"),
    path.join(home, ".env"),
  ] : [path.join(HOME, ".hermes", "cli-config.yaml")];
  const configFiles = candidates.filter((p) => isFile(p));

  // pip/extra marker (informational): agent-client-protocol on the brain's acp extra.
  const acpHint = bins.some((b) => b.name === "hermes-acp") ? "hermes-acp console script present"
    : "install extra: pip install 'hermes-agent[acp]'";

  return {
    installed: bins.length > 0 || !!checkout,
    bins, version: version || (checkout ? "dev-checkout" : null),
    home, checkout, configFiles, acpHint,
    pip: which("pip") || which("pip3") || which("uv") || null,
  };
}

async function detectOpenclaw(nodeReport) {
  const bins = ["openclaw"].map((n) => ({ name: n, path: which(n) })).filter((b) => b.path);
  const version = bins[0] ? await probeVersion(bins[0].path, ["--version"]) : null;

  const dirs = firstExisting(CANDIDATES.openclawDirs);
  const home = dirs.find((d) => isDir(d)) || null;

  let npmGlobal = null;
  if (nodeReport.npm?.globalRoot) {
    const p = path.join(nodeReport.npm.globalRoot, "openclaw");
    if (isDir(p)) npmGlobal = p;
  }

  // Config candidates; the gateway config is JSON or YAML depending on install vintage.
  const stem = home || path.join(HOME, ".openclaw");
  const candidates = ["openclaw.json", "config.json", "openclaw.yaml", "config.yaml"]
    .map((n) => path.join(stem, n));
  const configFiles = candidates.filter((p) => isFile(p));

  const checkout = dirs.find((d) => isFile(path.join(d, "openclaw.mjs"))) || null;

  return {
    installed: bins.length > 0 || !!npmGlobal || !!checkout,
    bins, version, home, npmGlobal, checkout, configFiles,
  };
}

/** Full machine scan. Pure read-only. */
export async function detectAll() {
  const node = await detectNode();
  const hermes = await detectHermes(node);
  const openclaw = await detectOpenclaw(node);
  return {
    scannedAt: new Date().toISOString(),
    system: { platform: os.platform(), arch: os.arch(), home: HOME, deangoHome: process.env.DEANGO_HOME || null },
    node,
    hermes,
    openclaw,
    complete: hermes.installed && openclaw.installed,
  };
}
