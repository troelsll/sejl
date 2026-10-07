import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "./db-node.mjs";
import { initDb, seedIfEmpty } from "./database.mjs";
import { handleApi } from "./api.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(rootDir, "client");
const port = Number(process.env.PORT ?? 4173);

initDb();
seedIfEmpty();

const server = createServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/")) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const method = request.method ?? "GET";
      const body = ["POST", "PUT", "PATCH"].includes(method) ? await readJson(request) : {};
      const { status, payload } = await handleApi(method, url, body);
      json(response, status, payload);
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
