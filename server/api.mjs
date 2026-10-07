// Fælles API-router: bruges af Node-serveren og af den browser-baserede GitHub Pages-version.
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
  logs,
  reorderQueue,
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


const json = (status, payload) => ({ status, payload });

export async function handleApi(method, url, body = {}) {

  if (method === "GET" && url.pathname === "/api/events") return json(200, allEvents());
  if (method === "POST" && url.pathname === "/api/events") return json(201, createEvent(body));

  const eventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (method === "GET" && eventMatch) {
    const event = getEvent(eventMatch[1]);
    return event ? json(200, event) : json(404, { error: "Event ikke fundet" });
  }
  if (method === "DELETE" && eventMatch) {
    const event = deleteEvent(eventMatch[1]);
    return event ? json(200, event) : json(404, { error: "Event ikke fundet" });
  }

  const startMatch = url.pathname.match(/^\/api\/starts\/([^/]+)$/);
  if (method === "PATCH" && startMatch) return json(200, updateStart(startMatch[1], body));

  const countdownMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/countdown$/);
  if (method === "PATCH" && countdownMatch) return json(200, updateStartCountdown(countdownMatch[1], body));

  const displayStateMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/display-state$/);
  if (method === "GET" && displayStateMatch) {
    const start = getStart(displayStateMatch[1]);
    if (!start) return json(404, { error: "Start ikke fundet" });
    const event = getEvent(start.eventId);
    return json(200, {
      serverTime: new Date().toISOString(),
      eventName: event?.name ?? "",
      start,
      procedure: getProcedure(start.procedureType),
      customWarningFlags: getSettings().customWarningFlags ?? []
    });
  }

  const boatsMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/boats$/);
  if (method === "GET" && boatsMatch) return json(200, boatsForStart(boatsMatch[1]));
  if (method === "POST" && boatsMatch) return json(201, createBoat(boatsMatch[1], body));

  const queueMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/queue$/);
  if (method === "PUT" && queueMatch) return json(200, reorderQueue(queueMatch[1], body.boatIds ?? []));

  const boatMatch = url.pathname.match(/^\/api\/boats\/([^/]+)$/);
  if (method === "PATCH" && boatMatch) return json(200, updateBoat(boatMatch[1], body));

  const finishNextMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/finish-next$/);
  if (method === "POST" && finishNextMatch) return json(201, finishNextBoat(finishNextMatch[1], body.finishedAt));

  const finishesMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/finishes$/);
  if (method === "GET" && finishesMatch) return json(200, finishRecordsForStart(finishesMatch[1]));
  if (method === "POST" && finishesMatch) return json(201, createFinish(finishesMatch[1], body.boatId, body.finishedAt, body.method ?? "manual"));

  const undoMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/undo-finish$/);
  if (method === "POST" && undoMatch) return json(200, undoLastFinish(undoMatch[1]));

  const finishMatch = url.pathname.match(/^\/api\/finishes\/([^/]+)$/);
  if (method === "PATCH" && finishMatch) return json(200, updateFinish(finishMatch[1], body));

  const resultsMatch = url.pathname.match(/^\/api\/starts\/([^/]+)\/results$/);
  if (method === "GET" && resultsMatch) {
    const start = getStart(resultsMatch[1]);
    if (!start) return json(404, { error: "Start ikke fundet" });
    return json(200, buildResults(start, boatsForStart(start.id), finishRecordsForStart(start.id)));
  }

  if (method === "POST" && url.pathname === "/api/websejler/lookup") return json(200, await lookupWebSejler(body));
  if (method === "GET" && url.pathname === "/api/settings") return json(200, getSettings());
  if (method === "PATCH" && url.pathname === "/api/settings") return json(200, updateSettings(body));
  if (method === "GET" && url.pathname === "/api/logs") return json(200, logs(Number(url.searchParams.get("limit") ?? 100)));

  return json(404, { error: "Endpoint ikke fundet" });
}

