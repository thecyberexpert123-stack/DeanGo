/**
 * gui.mjs — DeanGo web console: JSON API + static dashboard, one process,
 * zero dependencies. Binds 0.0.0.0 so Arena/cloud previews work.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectAll, inspectAll, planConnection, buildConnection, planSetup, runStep,
         listUnits, startUnit, stopUnit, tailLog, probeAcp, coreInfo, checkCompat } from "./gocore.mjs";
import { readJson, DEANGO_HOME, log } from "./util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, "..", "web");

// In-memory caches (guis are allowed a little state).
let cache = { det: null, insp: null };

async function fullScan() {
  cache.det = await detectAll();
  cache.insp = await inspectAll(cache.det);
  return cache;
}

const routes = {
  "GET /api/core": async () => await coreInfo(),
  "GET /api/status": async () => {
    const units = await listUnits().catch(() => []);
    const manifest = await readJson(path.join(DEANGO_HOME, "connection", "manifest.json"));
    const engine = await coreInfo().catch(() => ({ mode: "unknown" }));
    return { det: cache.det, complete: !!cache.det?.complete, units, manifest, deangoHome: DEANGO_HOME, engine };
  },
  "POST /api/scan": async () => await fullScan(),
  "GET /api/report": async () => (cache.det ? cache : await fullScan()),
  "POST /api/connection/plan": async () => {
    const { det } = cache.det ? cache : await fullScan();
    return planConnection(det);
  },
  "POST /api/connection/build": async (body) => {
    const { det } = cache.det ? cache : await fullScan();
    return await buildConnection(det, { apply: !!body.apply });
  },
  "POST /api/setup/plan": async () => {
    const { det } = cache.det ? cache : await fullScan();
    return planSetup(det);
  },
  "POST /api/setup/run": async (body) => {
    const { det } = cache.det ? cache : await fullScan();
    return await runStep(planSetup(det), body.step, { confirm: body.confirm === true });
  },
  "GET /api/units": async () => await listUnits(),
  "POST /api/unit/start": async (body) => await startUnit(body.id),
  "POST /api/unit/stop": async (body) => await stopUnit(body.id),
  "GET /api/unit/log": async (body, query) => ({ log: tailLog(query.id, Number(query.lines || 200)) }),
  "GET /api/health": async () => await readJson(path.join(DEANGO_HOME, "connection", "health.json")),
  "POST /api/compat": async (body) =>
    await checkCompat({ heal: body.heal === true, agentCmd: body.cmd || null, timeoutMs: Number(body.timeoutMs || 60000) }),
  "POST /api/acp/probe": async (body) => {
    const cmd = body.cmd || "hermes acp";
    return await probeAcp(cmd, {
      prompt: body.prompt || null,
      listSessions: !!body.listSessions,
      permissionPolicy: body.permissionPolicy || "deny",
      timeoutMs: Math.min(Number(body.timeoutMs || 90000), 300000),
    });
  },
};

function json(res, code, obj) {
  const data = JSON.stringify(obj, null, 2);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(data);
}

export function startGui({ port = 7788, host = "0.0.0.0" } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const key = `${req.method} ${url.pathname}`;
      const route = routes[key];
      if (route) {
        const body = await new Promise((resolve) => {
          if (req.method !== "POST") return resolve({});
          let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { resolve(JSON.parse(s || "{}")); } catch { resolve({}); } });
        });
        const query = Object.fromEntries(url.searchParams.entries());
        return json(res, 200, await route(body, query));
      }
      // static
      let file = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
      const full = path.join(WEB_DIR, path.normalize(file));
      if (!full.startsWith(WEB_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return json(res, 404, { error: "not found" });
      }
      const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/plain";
      res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
      fs.createReadStream(full).pipe(res);
    } catch (e) {
      json(res, 500, { error: String(e && e.stack || e) });
    }
  });
  server.listen(port, host, () => {
    log(`GUI → http://${host}:${port}`);
  });
  // warm the cache so the first paint is instant
  fullScan().catch(() => {});
  return server;
}
