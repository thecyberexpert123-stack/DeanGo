#!/usr/bin/env node
/**
 * DeanGo — the organism's operator console.
 * NOT an agent: the brain is Hermes, the limbs are OpenClaw, DeanGo runs them.
 *
 * Usage:
 *   deango detect                 scan this machine for hermes/openclaw/node
 *   deango inspect                deep-map the detected setups
 *   deango connect [--apply]      render connection files (+ optionally merge)
 *   deango setup [--yes] [step]   plan (or run) the automated install
 *   deango up|down|status [unit]  supervise the organism's processes
 *   deango logs <unit> [lines]
 *   deango probe [--cmd X] [--prompt "..."] [--list] [--allow-once]
 *                                 live ACP handshake with the brain
 *   deango gui [--port 7788]      web console (default command)
 *   deango doctor                 detect → inspect → connect(plan) → report
 */
import { detectAll } from "../src/detect.mjs";
import { inspectAll } from "../src/inspect.mjs";
import { planConnection, buildConnection } from "../src/connect.mjs";
import { planSetup, runStep } from "../src/setup.mjs";
import { listUnits, startUnit, stopUnit, statusUnit, tailLog } from "../src/supervisor.mjs";
import { probeAcp } from "../src/acp.mjs";
import { startGui } from "../src/gui.mjs";
import { log } from "../src/util.mjs";

const args = process.argv.slice(2);
const cmd = args[0] || "gui";
const flag = (name) => args.includes(name);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const out = (obj) => console.log(JSON.stringify(obj, null, 2));

async function main() {
  switch (cmd) {
    case "detect":
      out(await detectAll()); break;
    case "inspect": {
      const det = await detectAll();
      out(await inspectAll(det)); break;
    }
    case "connect": {
      const det = await detectAll();
      const apply = flag("--apply");
      const r = await buildConnection(det, { apply });
      log(r.merges.length ? `applied ${r.merges.length} merge(s)` : "dry-write to $DEANGO_HOME only (pass --apply to merge into live configs)");
      out({ written: r.written, merges: r.merges, warnings: r.plan.warnings }); break;
    }
    case "setup": {
      const det = await detectAll();
      const plan = planSetup(det);
      const step = args.find((a, i) => i > 0 && !a.startsWith("--"));
      if (!step) { out(plan); break; }
      out(await runStep(plan, step, { confirm: flag("--yes") })); break;
    }
    case "up": {
      const id = args[1];
      const units = await listUnits();
      const targets = id ? [id] : units.filter((u) => u.autostart && !u.status.running).map((u) => u.id);
      for (const t of targets) console.log(t, await startUnit(t));
      break;
    }
    case "down": {
      const id = args[1];
      const units = await listUnits();
      const targets = id ? [id] : units.map((u) => u.id);
      for (const t of targets) console.log(t, await stopUnit(t));
      break;
    }
    case "status": out(await listUnits()); break;
    case "logs": console.log(tailLog(args[1] || "openclaw-gateway", Number(args[2] || 200))); break;
    case "probe": {
      const r = await probeAcp(opt("--cmd", "hermes acp"), {
        prompt: opt("--prompt", null),
        listSessions: flag("--list"),
        permissionPolicy: flag("--allow-once") ? "allow-once" : "deny",
        timeoutMs: Number(opt("--timeout", "90000")),
      });
      out(r); break;
    }
    case "doctor": {
      const det = await detectAll();
      const insp = await inspectAll(det);
      const conn = planConnection(det);
      const setup = planSetup(det);
      out({
        organismReady: det.complete && conn.warnings.length === 0,
        hermes: { installed: det.hermes.installed, home: det.hermes.home, checkout: det.hermes.checkout, version: det.hermes.version },
        openclaw: { installed: det.openclaw.installed, home: det.openclaw.home, version: det.openclaw.version },
        bridgeAlreadyConfigured: insp.openclaw?.gatewayConfig?.hermesAgentConfigured ?? false,
        connectionWarnings: conn.warnings,
        setupStepsRemaining: setup.steps.map((s) => s.label),
      }); break;
    }
    case "gui":
    case "serve":
      startGui({ port: Number(opt("--port", "7788")) });
      setInterval(() => {}, 1 << 30); // keep alive
      break;
    default:
      console.log("unknown command:", cmd, "\n\nSee header of this file for usage.");
      process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
