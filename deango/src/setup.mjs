/**
 * setup.mjs — installation planner for the two bodies.
 * Default: dry-run (returns the exact commands). Only executes when
 * `confirm: true` is passed explicitly (GUI button / CLI --yes).
 */
import { run } from "./util.mjs";

const STEPS = {
  "install-hermes": {
    label: "Install Hermes Agent",
    when: (det) => !det.hermes.installed,
    commands: {
      posix: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
      win32: "powershell -c \"iex (irm https://hermes-agent.nousresearch.com/install.ps1)\"",
    },
    verify: { cmd: "hermes", args: ["--version"] },
  },
  "install-openclaw": {
    label: "Install OpenClaw",
    when: (det) => !det.openclaw.installed,
    commands: {
      posix: "curl -fsSL https://openclaw.ai/install.sh | bash",
      npm: "npm install -g openclaw@latest --allow-scripts=openclaw",
    },
    choose: (det) => (det.node.installed && det.node.npm?.bin ? "npm" : "posix"),
    verify: { cmd: "openclaw", args: ["--version"] },
  },
  "enable-hermes-acp": {
    label: "Ensure Hermes ACP extra (the brain's voice)",
    when: (det) => det.hermes.installed && !det.hermes.bins.some((b) => b.name === "hermes-acp"),
    commands: { posix: "pip install 'agent-client-protocol==0.9.0'  # or: hermes pm repair acp" },
    verify: { cmd: "hermes-acp", args: ["--version"] },
  },
  "auth-hermes": {
    label: "Authenticate Hermes with a model provider (interactive)",
    when: (det) => det.hermes.installed,
    interactive: true,
    commands: { posix: "hermes auth login" },
  },
};

export function planSetup(det) {
  const steps = [];
  for (const [id, s] of Object.entries(STEPS)) {
    if (!s.when(det)) continue;
    const key = s.choose ? s.choose(det) : (process.platform === "win32" ? "win32" : "posix");
    steps.push({
      id, label: s.label, interactive: !!s.interactive,
      command: s.commands[key] || s.commands.posix,
      verify: s.verify || null,
    });
  }
  return {
    platform: process.platform,
    ready: steps.length === 0 || steps.every((s) => !s.command),
    steps,
  };
}

/** Execute one planned step. Requires confirm=true. Streams output to console. */
export async function runStep(plan, stepId, { confirm = false } = {}) {
  const step = plan.steps.find((s) => s.id === stepId);
  if (!step) return { ok: false, error: `unknown step: ${stepId}` };
  if (!confirm) return { ok: false, dryRun: true, command: step.command, note: "pass confirm=true to execute" };
  if (step.interactive) return { ok: false, note: "interactive step: run this yourself in a terminal", command: step.command };
  const shell = process.platform === "win32" ? "powershell" : "bash";
  const args = process.platform === "win32" ? ["-c", step.command] : ["-c", step.command];
  const r = await run(shell, args, { timeoutMs: 20 * 60 * 1000 });
  let verified = null;
  if (step.verify) {
    const v = await run(step.verify.cmd, step.verify.args, { timeoutMs: 10000 });
    verified = { ok: v.code === 0, out: (v.stdout || v.stderr).trim().slice(0, 200) };
  }
  return { ok: r.code === 0, exit: r.code, tail: (r.stdout + r.stderr).slice(-2000), verified };
}
