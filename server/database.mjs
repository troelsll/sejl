import { normalizePrepFlag } from "../shared/startProcedure.mjs";

// Database-laget er miljø-uafhængigt: db injiceres via setDb (node:sqlite på serveren, sql.js i browseren).
export let db;

export function setDb(database) {
  db = database;
}

const randomUUID = () => globalThis.crypto.randomUUID();

export function initDb() {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS race_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS race_starts (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      scheduled_start_time TEXT NOT NULL,
      actual_start_time TEXT,
      procedure_type TEXT NOT NULL,
      distance_nm REAL,
      status TEXT NOT NULL,
      countdown_target_time TEXT,
      countdown_running INTEGER NOT NULL DEFAULT 0,
      countdown_started_at TEXT,
      warning_flag_type TEXT NOT NULL DEFAULT 'class',
      warning_flag_number INTEGER,
      warning_flag_id TEXT NOT NULL DEFAULT 'class-a',
      manual_signal_flags_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (event_id) REFERENCES race_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS boats (
      id TEXT PRIMARY KEY,
      start_id TEXT NOT NULL,
      boat_name TEXT NOT NULL,
      sail_number TEXT NOT NULL,
      boat_type TEXT NOT NULL,
      skipper TEXT NOT NULL,
      club TEXT NOT NULL,
      handicap REAL,
      source TEXT NOT NULL,
      finish_queue_position INTEGER,
      FOREIGN KEY (start_id) REFERENCES race_starts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      boat_id TEXT NOT NULL UNIQUE,
      certificate_number TEXT,
      valid_until TEXT,
      gph REAL,
      tcc REAL,
      tacil REAL,
      tacim REAL,
      tacih REAL,
      taudl REAL,
      taudm REAL,
      taudh REAL,
      raw_json TEXT NOT NULL,
      source_url TEXT,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finish_records (
      id TEXT PRIMARY KEY,
      start_id TEXT NOT NULL,
      boat_id TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      method TEXT NOT NULL,
      notes TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (start_id) REFERENCES race_starts(id) ON DELETE CASCADE,
      FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      start_id TEXT,
      boat_id TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      signal_volume REAL NOT NULL,
      signal_sound TEXT NOT NULL DEFAULT 'electronic',
      party_mode_enabled INTEGER NOT NULL DEFAULT 1,
      procedure_type TEXT NOT NULL,
      audio_output_id TEXT,
      custom_warning_flags_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `);
  ensureColumn("race_starts", "countdown_target_time", "TEXT");
  ensureColumn("race_starts", "countdown_running", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("race_starts", "countdown_started_at", "TEXT");
  ensureColumn("race_starts", "warning_flag_type", "TEXT NOT NULL DEFAULT 'class'");
  ensureColumn("race_starts", "warning_flag_number", "INTEGER");
  ensureColumn("race_starts", "warning_flag_id", "TEXT NOT NULL DEFAULT 'class-a'");
  ensureColumn("race_starts", "manual_signal_flags_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn("race_starts", "prep_flag", "TEXT NOT NULL DEFAULT 'P'");
  ensureColumn("settings", "signal_sound", "TEXT NOT NULL DEFAULT 'electronic'");
  ensureColumn("settings", "party_mode_enabled", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("settings", "custom_warning_flags_json", "TEXT NOT NULL DEFAULT '[]'");
}

export function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM race_events").get().count;
  if (count > 0) return;
  seedData();
}

export function seedData() {
  const now = new Date();
  const eventId = randomUUID();
  const startA = randomUUID();
  const startB = randomUUID();
  const today = now.toISOString().slice(0, 10);
  const firstStart = new Date(now);
  firstStart.setMinutes(firstStart.getMinutes() + 15, 0, 0);
  const secondStart = new Date(firstStart);
  secondStart.setMinutes(secondStart.getMinutes() + 10);

  db.prepare(
    "INSERT INTO race_events (id, name, date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(eventId, "Torsdagssejlads", today, "planned", now.toISOString(), now.toISOString());

  const insertStart = db.prepare(
    "INSERT INTO race_starts (id, event_id, name, scheduled_start_time, procedure_type, distance_nm, status, warning_flag_type, warning_flag_number, warning_flag_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertStart.run(startA, eventId, "DH Klasse A", firstStart.toISOString(), "five-minute", 8.4, "planned", "class", null, "class-a");
  insertStart.run(startB, eventId, "DH Klasse B", secondStart.toISOString(), "five-minute", 6.2, "planned", "number", 2, "class-a");

  const boats = [
    [startA, "Aurora", "DEN 42", "X-99", "Mette Holm", "Aalborg Sejlklub", 97.5, 0.912],
    [startA, "Nordlys", "DEN 117", "J/80", "Lars Vester", "Nibe Sejlklub", 94.1, 0.884],
    [startA, "Freja", "DEN 35114", "First 36.7", "Anne Kirk", "Aalborg Sejlklub", 101.2, 0.948],
    [startA, "Havblik", "DEN 808", "Dehler 34", "Peter Bro", "Hals Bådelaug", 99.8, 0.929],
    [startB, "Saga", "DEN 65", "Folkebåd", "Kasper Lund", "Aalborg Sejlklub", 82.0, 0.772],
    [startB, "Kraka", "DEN 190", "H-båd", "Signe Fogh", "Nibe Sejlklub", 86.3, 0.809],
    [startB, "Vega", "DEN 12", "Albin Express", "Jonas Ravn", "Aalborg Sejlklub", 90.2, 0.846],
    [startB, "Mira", "DEN 74", "Maxi 77", "Niels Bjerre", "Hals Bådelaug", 84.8, 0.795]
  ];

  const insertBoat = db.prepare(
    "INSERT INTO boats (id, start_id, boat_name, sail_number, boat_type, skipper, club, handicap, source, finish_queue_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertCertificate = db.prepare(
    "INSERT INTO certificates (id, boat_id, certificate_number, gph, tcc, raw_json, source_url, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  boats.forEach((boat, index) => {
    const boatId = randomUUID();
    insertBoat.run(boatId, boat[0], boat[1], boat[2], boat[3], boat[4], boat[5], boat[6], "manual", index + 1);
    insertCertificate.run(
      randomUUID(),
      boatId,
      boat[2].includes("35114") ? "35114" : null,
      null,
      boat[7],
      JSON.stringify({ seeded: true }),
      boat[2].includes("35114") ? "https://websejler.dk/da/certifikat/35114" : null,
      now.toISOString()
    );
  });

  db.prepare(
    "INSERT INTO settings (id, signal_volume, signal_sound, party_mode_enabled, procedure_type, custom_warning_flags_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run("default", 0.8, "electronic", 1, "five-minute", "[]", now.toISOString());

  logEvent({ eventId, type: "seeded", message: "Seed data oprettet", metadata: { boats: boats.length } });
}

export function allEvents() {
  const events = db.prepare("SELECT * FROM race_events ORDER BY date DESC, name").all();
  return events.map((event) => ({ ...mapEvent(event), starts: startsForEvent(event.id) }));
}

export function getEvent(id) {
  const event = db.prepare("SELECT * FROM race_events WHERE id = ?").get(id);
  return event ? { ...mapEvent(event), starts: startsForEvent(id) } : null;
}

export function deleteEvent(id) {
  const existing = getEvent(id);
  if (!existing) return null;
  db.prepare("DELETE FROM race_events WHERE id = ?").run(id);
  logEvent({ eventId: id, type: "race.deleted", message: `Løb fjernet: ${existing.name}`, metadata: { id, name: existing.name } });
  return existing;
}

export function startsForEvent(eventId) {
  return db
    .prepare("SELECT * FROM race_starts WHERE event_id = ? ORDER BY scheduled_start_time")
    .all(eventId)
    .map(mapStart);
}

export function getStart(id) {
  const start = db.prepare("SELECT * FROM race_starts WHERE id = ?").get(id);
  return start ? mapStart(start) : null;
}

export function createEvent(payload) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO race_events (id, name, date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, payload.name, payload.date, payload.status ?? "planned", now, now);
  for (const start of payload.starts ?? []) {
    createStart(id, start);
  }
  logEvent({ eventId: id, type: "race.created", message: `Løb oprettet: ${payload.name}`, metadata: payload });
  return getEvent(id);
}

export function createStart(eventId, payload) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO race_starts (id, event_id, name, scheduled_start_time, procedure_type, distance_nm, status, warning_flag_type, warning_flag_number, warning_flag_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    eventId,
    payload.name,
    payload.scheduledStartTime,
    payload.procedureType ?? "five-minute",
    payload.distanceNm ?? null,
    payload.status ?? "planned",
    payload.warningFlagType ?? "class",
    normalizeWarningFlagNumber(payload.warningFlagNumber),
    payload.warningFlagId ?? "class-a"
  );
  return getStart(id);
}

export function updateStart(id, payload) {
  const existing = getStart(id);
  if (!existing) return null;
  db.prepare(
    "UPDATE race_starts SET name = ?, scheduled_start_time = ?, actual_start_time = ?, procedure_type = ?, distance_nm = ?, status = ?, countdown_target_time = ?, countdown_running = ?, countdown_started_at = ?, warning_flag_type = ?, warning_flag_number = ?, warning_flag_id = ?, manual_signal_flags_json = ?, prep_flag = ? WHERE id = ?"
  ).run(
    payload.name ?? existing.name,
    payload.scheduledStartTime ?? existing.scheduledStartTime,
    payload.actualStartTime ?? existing.actualStartTime,
    payload.procedureType ?? existing.procedureType,
    payload.distanceNm ?? existing.distanceNm,
    payload.status ?? existing.status,
    payload.countdownTargetTime ?? existing.countdownTargetTime,
    payload.countdownRunning == null ? (existing.countdownRunning ? 1 : 0) : (payload.countdownRunning ? 1 : 0),
    payload.countdownStartedAt ?? existing.countdownStartedAt,
    payload.warningFlagType ?? existing.warningFlagType ?? "class",
    payload.warningFlagNumber === undefined ? existing.warningFlagNumber : normalizeWarningFlagNumber(payload.warningFlagNumber),
    payload.warningFlagId ?? existing.warningFlagId ?? "class-a",
    JSON.stringify(payload.manualSignalFlags === undefined ? existing.manualSignalFlags : normalizeManualSignalFlags(payload.manualSignalFlags)),
    normalizePrepFlag(payload.prepFlag ?? existing.prepFlag),
    id
  );
  logEvent({ startId: id, type: "start.updated", message: "Start opdateret", metadata: payload });
  return getStart(id);
}

export function updateStartCountdown(id, payload) {
  const existing = getStart(id);
  if (!existing) return null;
  const now = new Date();
  const shouldStart = payload.action === "start" || payload.running === true;
  const shouldStop = payload.action === "stop" || payload.running === false;
  const durationSeconds = Number(payload.durationSeconds ?? 5 * 60);
  const targetTime = payload.targetTime ?? new Date(now.getTime() + durationSeconds * 1000).toISOString();
  const startedAt = payload.startedAt ?? now.toISOString();

  if (shouldStart) {
    db.prepare(
      "UPDATE race_starts SET countdown_target_time = ?, countdown_running = 1, countdown_started_at = ?, status = ? WHERE id = ?"
    ).run(targetTime, startedAt, "running", id);
    logEvent({ startId: id, type: "start.countdown.started", message: "Startprocedure startet", metadata: { targetTime, durationSeconds } });
    return getStart(id);
  }

  if (shouldStop) {
    db.prepare("UPDATE race_starts SET countdown_running = 0 WHERE id = ?").run(id);
    logEvent({ startId: id, type: "start.countdown.stopped", message: "Startprocedure stoppet", metadata: payload });
    return getStart(id);
  }

  return updateStart(id, payload);
}

export function boatsForStart(startId) {
  const boats = db
    .prepare("SELECT * FROM boats WHERE start_id = ? ORDER BY COALESCE(finish_queue_position, 9999), boat_name")
    .all(startId)
    .map(mapBoat);
  return boats.map((boat) => ({ ...boat, certificate: certificateForBoat(boat.id) }));
}

export function createBoat(startId, payload) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO boats (id, start_id, boat_name, sail_number, boat_type, skipper, club, handicap, source, finish_queue_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    startId,
    payload.boatName,
    payload.sailNumber,
    payload.boatType ?? "",
    payload.skipper ?? "",
    payload.club ?? "",
    payload.handicap ?? null,
    payload.source ?? "manual",
    nextQueuePosition(startId)
  );
  if (payload.certificate) upsertCertificate(id, payload.certificate);
  logEvent({ startId, boatId: id, type: "boat.created", message: `Båd tilføjet: ${payload.boatName}`, metadata: payload });
  return boatsForStart(startId).find((boat) => boat.id === id);
}

export function updateBoat(id, payload) {
  const existing = db.prepare("SELECT * FROM boats WHERE id = ?").get(id);
  if (!existing) return null;
  db.prepare(
    "UPDATE boats SET boat_name = ?, sail_number = ?, boat_type = ?, skipper = ?, club = ?, handicap = ?, source = ?, finish_queue_position = ? WHERE id = ?"
  ).run(
    payload.boatName ?? existing.boat_name,
    payload.sailNumber ?? existing.sail_number,
    payload.boatType ?? existing.boat_type,
    payload.skipper ?? existing.skipper,
    payload.club ?? existing.club,
    payload.handicap ?? existing.handicap,
    payload.source ?? existing.source,
    payload.finishQueuePosition ?? existing.finish_queue_position,
    id
  );
  if (payload.certificate) upsertCertificate(id, payload.certificate);
  logEvent({ startId: existing.start_id, boatId: id, type: "boat.updated", message: "Båd opdateret", metadata: payload });
  return boatsForStart(existing.start_id).find((boat) => boat.id === id);
}

export function reorderQueue(startId, boatIds) {
  const update = db.prepare("UPDATE boats SET finish_queue_position = ? WHERE id = ? AND start_id = ?");
  boatIds.forEach((boatId, index) => update.run(index + 1, boatId, startId));
  logEvent({ startId, type: "finish.queue.reordered", message: "Målgangskø ændret", metadata: { boatIds } });
  return boatsForStart(startId);
}

export function finishNextBoat(startId, finishedAt = new Date().toISOString()) {
  const boats = boatsForStart(startId);
  const finishedBoatIds = new Set(finishRecordsForStart(startId).filter((finish) => !finish.isDeleted).map((finish) => finish.boatId));
  const nextBoat = boats.find((boat) => !finishedBoatIds.has(boat.id));
  if (!nextBoat) return null;
  return createFinish(startId, nextBoat.id, finishedAt, "queue");
}

export function createFinish(startId, boatId, finishedAt, method = "manual") {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO finish_records (id, start_id, boat_id, finished_at, recorded_at, method, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(id, startId, boatId, finishedAt, now, method);
  logEvent({ startId, boatId, type: "finish.recorded", message: "Målgang registreret", metadata: { finishedAt, method } });
  return finishRecordsForStart(startId).find((finish) => finish.id === id);
}

export function updateFinish(id, payload) {
  const existing = db.prepare("SELECT * FROM finish_records WHERE id = ?").get(id);
  if (!existing) return null;
  db.prepare("UPDATE finish_records SET boat_id = ?, finished_at = ?, notes = ? WHERE id = ?").run(
    payload.boatId ?? existing.boat_id,
    payload.finishedAt ?? existing.finished_at,
    payload.notes ?? existing.notes,
    id
  );
  logEvent({ startId: existing.start_id, boatId: payload.boatId ?? existing.boat_id, type: "finish.updated", message: "Målgang rettet", metadata: payload });
  return finishRecordsForStart(existing.start_id).find((finish) => finish.id === id);
}

export function undoLastFinish(startId) {
  const finish = db
    .prepare("SELECT * FROM finish_records WHERE start_id = ? AND is_deleted = 0 ORDER BY recorded_at DESC LIMIT 1")
    .get(startId);
  if (!finish) return null;
  db.prepare("UPDATE finish_records SET is_deleted = 1 WHERE id = ?").run(finish.id);
  logEvent({ startId, boatId: finish.boat_id, type: "finish.undone", message: "Seneste målgang fortrudt", metadata: { finishId: finish.id } });
  return mapFinish({ ...finish, is_deleted: 1 });
}

export function finishRecordsForStart(startId) {
  return db
    .prepare("SELECT * FROM finish_records WHERE start_id = ? ORDER BY finished_at")
    .all(startId)
    .map(mapFinish);
}

export function certificateForBoat(boatId) {
  const certificate = db.prepare("SELECT * FROM certificates WHERE boat_id = ?").get(boatId);
  return certificate ? mapCertificate(certificate) : null;
}

export function upsertCertificate(boatId, payload) {
  const existing = certificateForBoat(boatId);
  const id = existing?.id ?? randomUUID();
  db.prepare(`
    INSERT INTO certificates (
      id, boat_id, certificate_number, valid_until, gph, tcc, tacil, tacim, tacih, taudl, taudm, taudh, raw_json, source_url, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(boat_id) DO UPDATE SET
      certificate_number = excluded.certificate_number,
      valid_until = excluded.valid_until,
      gph = excluded.gph,
      tcc = excluded.tcc,
      tacil = excluded.tacil,
      tacim = excluded.tacim,
      tacih = excluded.tacih,
      taudl = excluded.taudl,
      taudm = excluded.taudm,
      taudh = excluded.taudh,
      raw_json = excluded.raw_json,
      source_url = excluded.source_url,
      fetched_at = excluded.fetched_at
  `).run(
    id,
    boatId,
    payload.certificateNumber ?? null,
    payload.validUntil ?? null,
    payload.gph ?? null,
    payload.tcc ?? null,
    payload.tacil ?? null,
    payload.tacim ?? null,
    payload.tacih ?? null,
    payload.taudl ?? null,
    payload.taudm ?? null,
    payload.taudh ?? null,
    JSON.stringify(payload.raw ?? payload),
    payload.sourceUrl ?? null,
    new Date().toISOString()
  );
  return certificateForBoat(boatId);
}

export function getSettings() {
  return mapSettings(db.prepare("SELECT * FROM settings WHERE id = 'default'").get());
}

export function updateSettings(payload) {
  const existing = getSettings();
  const partyModeEnabled = payload.partyModeEnabled ?? existing.partyModeEnabled;
  db.prepare("UPDATE settings SET signal_volume = ?, signal_sound = ?, party_mode_enabled = ?, procedure_type = ?, audio_output_id = ?, custom_warning_flags_json = ?, updated_at = ? WHERE id = 'default'").run(
    payload.signalVolume ?? existing.signalVolume,
    payload.signalSound ?? existing.signalSound,
    partyModeEnabled ? 1 : 0,
    payload.procedureType ?? existing.procedureType,
    payload.audioOutputId ?? existing.audioOutputId,
    JSON.stringify(payload.customWarningFlags ?? existing.customWarningFlags ?? []),
    new Date().toISOString()
  );
  return getSettings();
}

export function logs(limit = 100) {
  return db
    .prepare("SELECT * FROM event_logs ORDER BY created_at DESC LIMIT ?")
    .all(limit)
    .map(mapLog);
}

export function logEvent({ eventId = null, startId = null, boatId = null, type, message, metadata = {} }) {
  db.prepare(
    "INSERT INTO event_logs (id, event_id, start_id, boat_id, type, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), eventId, startId, boatId, type, message, JSON.stringify(metadata), new Date().toISOString());
}

function nextQueuePosition(startId) {
  const row = db.prepare("SELECT COALESCE(MAX(finish_queue_position), 0) + 1 AS next FROM boats WHERE start_id = ?").get(startId);
  return row.next;
}

function mapEvent(row) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapStart(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    scheduledStartTime: row.scheduled_start_time,
    actualStartTime: row.actual_start_time,
    procedureType: row.procedure_type,
    distanceNm: row.distance_nm,
    status: row.status,
    countdownTargetTime: row.countdown_target_time,
    countdownRunning: Boolean(row.countdown_running),
    countdownStartedAt: row.countdown_started_at,
    warningFlagType: row.warning_flag_type ?? "class",
    warningFlagNumber: row.warning_flag_number,
    warningFlagId: row.warning_flag_id ?? "class-a",
    manualSignalFlags: parseJsonArray(row.manual_signal_flags_json),
    prepFlag: normalizePrepFlag(row.prep_flag)
  };
}

function normalizeWarningFlagNumber(value) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1 && number <= 9) return number;
  return null;
}

function normalizeManualSignalFlags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapBoat(row) {
  return {
    id: row.id,
    startId: row.start_id,
    boatName: row.boat_name,
    sailNumber: row.sail_number,
    boatType: row.boat_type,
    skipper: row.skipper,
    club: row.club,
    handicap: row.handicap,
    source: row.source,
    finishQueuePosition: row.finish_queue_position
  };
}

function mapCertificate(row) {
  return {
    id: row.id,
    boatId: row.boat_id,
    certificateNumber: row.certificate_number,
    validUntil: row.valid_until,
    gph: row.gph,
    tcc: row.tcc,
    tacil: row.tacil,
    tacim: row.tacim,
    tacih: row.tacih,
    taudl: row.taudl,
    taudm: row.taudm,
    taudh: row.taudh,
    raw: JSON.parse(row.raw_json || "{}"),
    sourceUrl: row.source_url,
    fetchedAt: row.fetched_at
  };
}

function mapFinish(row) {
  return {
    id: row.id,
    startId: row.start_id,
    boatId: row.boat_id,
    finishedAt: row.finished_at,
    recordedAt: row.recorded_at,
    method: row.method,
    notes: row.notes,
    isDeleted: Boolean(row.is_deleted)
  };
}

function mapSettings(row) {
  return {
    id: row.id,
    signalVolume: row.signal_volume,
    signalSound: row.signal_sound ?? "electronic",
    partyModeEnabled: Boolean(row.party_mode_enabled ?? 1),
    procedureType: row.procedure_type,
    audioOutputId: row.audio_output_id,
    customWarningFlags: JSON.parse(row.custom_warning_flags_json || "[]"),
    updatedAt: row.updated_at
  };
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function mapLog(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    startId: row.start_id,
    boatId: row.boat_id,
    type: row.type,
    message: row.message,
    metadata: JSON.parse(row.metadata || "{}"),
    createdAt: row.created_at
  };
}
