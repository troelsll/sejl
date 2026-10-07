import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allEvents,
  boatsForStart,
  createBoat,
  createEvent,
  createFinish,
  deleteEvent,
  finishNextBoat,
  finishRecordsForStart,
  getEvent,
  getSettings,
  getStart,
  initDb,
  logs,
  reorderQueue,
  seedIfEmpty,
  undoLastFinish,
  updateBoat,
  updateFinish,
  updateSettings,
  updateStart,
  updateStartCountdown
} from "./database.mjs";
import { lookupWebSejler } from "./websejlerAdapter.mjs";
import { buildResults } from "../shared/calculations.mjs";
import { getProcedure } from "../shared/startProcedure.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(rootDir, "client");
const port = Number(process.env.PORT ?? 4173);

initDb();
seedIfEmpty();

const server = createServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    json(response, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Kapsejladsapp kører på http://localhost:${port}`);
});

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const method = request.method ?? "GET";
  const body = ["POST", "PUT", "PATCH"].includes(method) ? await readJson(request) : {};

  if (method === "GET" && url.pathname === "/api/events") return json(response, 200, allEvents());
  if (method === "POST" && url.pathname === "/api/events") return json(response, 201, createEvent(body));

  const eventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (method === "GET" && eventMatch) {
    const event = getEvent(eventMatch[1]);
    return event ? json(response, 200, event) : json(response, 404, { error: "Event ikke fundet" });
  }
  if (method === "DELETE" && eventMatch) {
    const event = deleteEvent(eventMatch[1]);
    return event ? json(response, 200, event) : json(response, 404, { error: "Event ikke fundet" });
  }

  const startMatch = url.pathname.match(/^\/api\/starts\/([^/]+)$/);
  if (method === "PATCH" && startMatch) return json(response, 200, updateStart(startMatch[1], body));

  const countdownMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/countdown$/);
  if (method === "PATCH" && countdownMatch) return json(response, 200, updateStartCountdown(countdownMatch[1], body));

  const displayStateMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/display-state$/);
  if (method === "GET" && displayStateMatch) {
    const start = getStart(displayStateMatch[1]);
    if (!start) return json(response, 404, { error: "Start ikke fundet" });
    const event = getEvent(start.eventId);
    return json(response, 200, {
      serverTime: new Date().toISOString(),
      eventName: event?.name ?? "",
      start,
      procedure: getProcedure(start.procedureType),
      customWarningFlags: getSettings().customWarningFlags ?? []
    });
  }

  const boatsMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/boats$/);
  if (method === "GET" && boatsMatch) return json(response, 200, boatsForStart(boatsMatch[1]));
  if (method === "POST" && boatsMatch) return json(response, 201, createBoat(boatsMatch[1], body));

  const queueMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/queue$/);
  if (method === "PUT" && queueMatch) return json(response, 200, reorderQueue(queueMatch[1], body.boatIds ?? []));

  const boatMatch = url.pathname.match(/^\/api\/boats\/([^/]+)$/);
  if (method === "PATCH" && boatMatch) return json(response, 200, updateBoat(boatMatch[1], body));

  const finishNextMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/finish-next$/);
  if (method === "POST" && finishNextMatch) return json(response, 201, finishNextBoat(finishNextMatch[1], body.finishedAt));

  const finishesMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/finishes$/);
  if (method === "GET" && finishesMatch) return json(response, 200, finishRecordsForStart(finishesMatch[1]));
  if (method === "POST" && finishesMatch) return json(response, 201, createFinish(finishesMatch[1], body.boatId, body.finishedAt, body.method ?? "manual"));

  const undoMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/undo-finish$/);
  if (method === "POST" && undoMatch) return json(response, 200, undoLastFinish(undoMatch[1]));

  const finishMatch = url.pathname.match(/^\/api\/finishes\/([^/]+)$/);
  if (method === "PATCH" && finishMatch) return json(response, 200, updateFinish(finishMatch[1], body));

  const resultsMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/results$/);
  if (method === "GET" && resultsMatch) {
    const start = getStart(resultsMatch[1]);
    if (!start) return json(response, 404, { error: "Start ikke fundet" });
    return json(response, 200, buildResults(start, boatsForStart(start.id), finishRecordsForStart(start.id)));
  }

  if (method === "POST" && url.pathname === "/api/websejler/lookup") return json(response, 200, await lookupWebSejler(body));
  if (method === "GET" && url.pathname === "/api/settings") return json(response, 200, getSettings());
  if (method === "PATCH" && url.pathname === "/api/settings") return json(response, 200, updateSettings(body));
  if (method === "GET" && url.pathname === "/api/logs") return json(response, 200, logs(Number(url.searchParams.get("limit") ?? 100)));

  json(response, 404, { error: "Endpoint ikke fundet" });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  if (requestedPath.startsWith("/shared/")) {
    const sharedPath = join(rootDir, requestedPath);
    if (sharedPath.startsWith(join(rootDir, "shared")) && existsSync(sharedPath)) {
      const data = await readFile(sharedPath);
      response.writeHead(200, { "content-type": contentType(sharedPath) });
      response.end(data);
      return;
    }
  }
  const filePath = join(clientDir, requestedPath);
  if (!filePath.startsWith(clientDir) || !existsSync(filePath)) {
    response.writeHead(302, { location: "/" });
    response.end();
    return;
  }
  const data = await readFile(filePath);
  response.writeHead(200, { "content-type": contentType(filePath) });
  response.end(data);
}

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function contentType(filePath) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".json": "application/json; charset=utf-8"
  };
  return types[extname(filePath)] ?? "application/octet-stream";
}
