/**
 * compat.mjs — the update watchdog. After EITHER body self-updates, verify the
 * organism still has a spine — and self-heal the connection if it doesn't.
 *
 * Drift checks (vs. the connection manifest recorded at `connect` time):
 *   1. version drift     hermes/openclaw --version changed
 *   2. location drift    home/checkout/config/bins moved or vanished
 *   3. spine health      live ACP handshake (the actual contract)
 *
 * Heal policy (heal:true): re-render connection files with fresh paths
 * (idempotent; merges reapplied only if they were applied before), re-probe.
 */
import path from "node:path";
import { DEANGO_HOME, readJson, writeJson } from "./util.mjs";
import { detectAll } from "./detect.mjs";
import { buildConnection } from "./connect.mjs";
import { probeAcp } from "./acp.mjs";

const healthPath = () => path.join(DEANGO_HOME, "connection", "health.json");

function snapshotVersions(det) {
  return {
    hermes: det.hermes.version || null,
    openclaw: det.openclaw.version || null,
    hermesHome: det.hermes.home || null,
    hermesCheckout: det.hermes.checkout || null,
    hermesBins: (det.hermes.bins || []).map((b) => b.name + "=" + b.path),
    openclawHome: det.openclaw.home || null,
    openclawNpmGlobal: det.openclaw.npmGlobal || null,
    openclawBin: det.openclaw.bins?.[0]?.path || null,
  };
}

function diffSnapshot(before, after) {
  const drift = [];
  if (!before) return drift;
  for (const k of Object.keys(after)) {
    const a = JSON.stringify(before[k] ?? null), b = JSON.stringify(after[k] ?? null);
    if (a !== b) drift.push({ field: k, was: before[k] ?? null, now: after[k] ?? null });
  }
  return drift;
}

export async function checkCompat({ heal = false, agentCmd = null, timeoutMs = 60000 } = {}) {
  const t0 = Date.now();
  const det = await detectAll();
  const manifest = await readJson(path.join(DEANGO_HOME, "connection", "manifest.json"));
  const before = manifest?.versions || null;
  const now = snapshotVersions(det);
  const drift = diffSnapshot(before, now);

  // The spine probe is the ground truth: even with zero drift, an update could
  // have broken the handshake; even WITH drift, the organism is fine if ACP lives.
  const brainCmd = async () => agentCmd ||
    (await readJson(path.join(DEANGO_HOME, "connection", "units.json")))?.units?.find((u) => u.id === "hermes-acp")?.cmd ||
    "hermes acp";
  let cmd = await brainCmd();
  const probe = await probeAcp(cmd, { timeoutMs }).catch((e) => ({ ok: false, error: String(e) }));

  const report = {
    checkedAt: new Date().toISOString(),
    versions: { atConnect: before, now },
    drift,
    driftCount: drift.length,
    probe: {
      cmd, ok: !!probe.ok, ms: Date.now() - t0,
      capabilities: probe.capabilities || null,
      error: probe.error || probe.promptError || null,
    },
    healed: false,
    healAvailable: true,
  };

  if (heal && (!probe.ok || drift.length > 0)) {
    const doApply = manifest?.apply === true; // never upgrade privileges silently
    const r = await buildConnection(det, { apply: doApply });
    // The heal may have rewritten units.json with a corrected brain path —
    // re-resolve the probe target unless the caller pinned one explicitly.
    cmd = await brainCmd();
    const re = await probeAcp(cmd, { timeoutMs }).catch((e) => ({ ok: false, error: String(e) }));
    report.healed = true;
    report.healActions = { written: r.written, merges: r.merges, reappliedMerges: doApply };
    report.probeAfterHeal = { cmd, ok: !!re.ok, error: re.error || null };
    report.healthy = !!re.ok;
  } else {
    report.healthy = probe.ok && drift.length === 0;
  }

  await writeJson(healthPath(), report);
  return report;
}
