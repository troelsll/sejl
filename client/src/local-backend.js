// Browser-backend til GitHub Pages: kører samme API/SQLite-kode som serveren (sql.js = SQLite i WebAssembly)
// og gemmer databasen i localStorage, så data overlever reload og deles mellem faner (fx ekstern startskærm).
import { setDb, initDb, seedIfEmpty } from "../server/database.mjs";
import { handleApi } from "../server/api.mjs";

const STORE_KEY = "kapsejlads-db";
const VERSION_KEY = "kapsejlads-db-version";

if (new URLSearchParams(location.search).has("reset")) {
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(VERSION_KEY); } catch {}
}

let SQL;
let sqlDb;
let loadedVersion = null;

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function normalize(params) {
  return params.map((value) => (value === undefined ? null : typeof value === "boolean" ? Number(value) : value));
}

// Minimal DatabaseSync-kompatibel wrapper om sql.js
function wrap(raw) {
  return {
    exec: (sql) => raw.exec(sql),
    prepare: (sql) => ({
      run: (...params) => { raw.run(sql, normalize(params)); },
      get: (...params) => {
        const stmt = raw.prepare(sql);
        try {
          stmt.bind(normalize(params));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally { stmt.free(); }
      },
      all: (...params) => {
        const stmt = raw.prepare(sql);
        const rows = [];
        try {
          stmt.bind(normalize(params));
          while (stmt.step()) rows.push(stmt.getAsObject());
        } finally { stmt.free(); }
        return rows;
      }
    })
  };
}

function open() {
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch {}
  sqlDb = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
  loadedVersion = safeGet(VERSION_KEY);
  setDb(wrap(sqlDb));
  initDb();
  seedIfEmpty();
  if (!saved) persist();
}

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, toBase64(sqlDb.export()));
    loadedVersion = String(Date.now()) + Math.random();
    localStorage.setItem(VERSION_KEY, loadedVersion);
  } catch (error) {
    console.warn("Kunne ikke gemme data i browseren", error);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Kunne ikke hente ${src}`));
    document.head.append(script);
  });
}

const ready = (async () => {
  await loadScript(new URL("../vendor/sql-wasm.js", import.meta.url).href);
  SQL = await globalThis.initSqlJs({ locateFile: (file) => new URL(`../vendor/${file}`, import.meta.url).href });
  open();
})();

const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  const apiIndex = url.pathname.indexOf("/api/");
  if (apiIndex === -1) return nativeFetch(input, init);
  await ready;
  // Hvis en anden fane har ændret data, så indlæs den nyeste version først
  if (safeGet(VERSION_KEY) !== loadedVersion) open();
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : {};
  const apiUrl = new URL(url.pathname.slice(apiIndex) + url.search, "http://local");
  let result;
  try {
    result = await handleApi(method, apiUrl, body);
  } catch (error) {
    result = { status: 500, payload: { error: error.message } };
  }
  if (method !== "GET") persist();
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
};
