import { formatDuration, getActiveFlags, getProcedure, getProcedureState } from "../../shared/startProcedure.mjs";
import {
  DEFAULT_CLASS_FLAGS,
  DS_DINGHY_CAT_CLASS_FLAGS,
  DS_KEELBOAT_CLASS_FLAGS,
  RACE_SIGNAL_FLAGS,
  allClassFlags,
  classFlagById,
  raceSignalById
} from "../../shared/flags.mjs";

const state = {
  events: [],
  selectedEventId: null,
  selectedStartId: null,
  boats: [],
  finishes: [],
  results: [],
  logs: [],
  settings: null,
  view: "dashboard",
  editingBoatId: null,
  confettiBursts: [],
  countdown: {
    running: false,
    targetTime: null,
    fired: new Set()
  }
};

const app = document.querySelector("#app");

const SIGNAL_SOUNDS = [
  { id: "electronic", label: "Elektronisk" },
  { id: "foghorn", label: "Tågehorn" },
  { id: "bell", label: "Skibsklokke" }
];

const api = {
  async get(path) {
    const response = await fetch(path);
    return handle(response);
  },
  async post(path, body = {}) {
    const response = await fetch(path, jsonOptions("POST", body));
    return handle(response);
  },
  async patch(path, body = {}) {
    const response = await fetch(path, jsonOptions("PATCH", body));
    return handle(response);
  },
  async put(path, body = {}) {
    const response = await fetch(path, jsonOptions("PUT", body));
    return handle(response);
  },
  async delete(path) {
    const response = await fetch(path, { method: "DELETE" });
    return handle(response);
  }
};

function jsonOptions(method, body) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

async function handle(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Ukendt API-fejl");
  return data;
}

async function init() {
  await loadAll();
  render();
  setInterval(tickCountdown, 500);
}

async function loadAll() {
  state.events = await api.get("/api/events");
  state.settings = await api.get("/api/settings");
  if (!state.selectedEventId) state.selectedEventId = state.events[0]?.id ?? null;
  if (!state.selectedStartId) state.selectedStartId = selectedEvent()?.starts?.[0]?.id ?? null;
  await loadStartData();
}

async function loadStartData() {
  if (!state.selectedStartId) {
    state.boats = [];
    state.finishes = [];
    state.results = [];
    state.logs = await api.get("/api/logs?limit=50");
    return;
  }
  const [boats, finishes, results, logs] = await Promise.all([
    api.get(`/api/starts/${state.selectedStartId}/boats`),
    api.get(`/api/starts/${state.selectedStartId}/finishes`),
    api.get(`/api/starts/${state.selectedStartId}/results`),
    api.get("/api/logs?limit=50")
  ]);
  state.boats = boats;
  state.finishes = finishes;
  state.results = results;
  state.logs = logs;
}

function selectedEvent() {
  return state.events.find((event) => event.id === state.selectedEventId) ?? state.events[0] ?? null;
}

function selectedStart() {
  const event = selectedEvent();
  return event?.starts?.find((start) => start.id === state.selectedStartId) ?? event?.starts?.[0] ?? null;
}

function setView(view) {
  state.view = view;
  render();
}

function render() {
  const event = selectedEvent();
  const start = selectedStart();
  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">Kapsejladsleder</p>
        <h1>Kapsejladsapp</h1>
      </div>
      <div class="selectors">
        <label>
          Vælg event/løb
          <select id="eventSelect">
            ${state.events.map((candidate) => `<option value="${candidate.id}" ${candidate.id === event?.id ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="compact" data-view="race">Nyt event</button>
        <label>
          Start
          <select id="startSelect">
            ${(event?.starts ?? []).map((candidate) => `<option value="${candidate.id}" ${candidate.id === start?.id ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`).join("")}
          </select>
        </label>
      </div>
    </header>
    <nav class="tabs">
      ${tab("dashboard", "Dashboard")}
      ${tab("race", "Løb")}
      ${tab("boats", "Både")}
      ${tab("start", "Start")}
      ${tab("finish", "Målgang")}
      ${tab("results", "Resultater")}
      ${tab("settings", "Indstillinger")}
    </nav>
    <main>
      ${renderView()}
    </main>
    ${renderConfettiLayer()}
  `;
  bindGlobalControls();
  bindView();
}

function tab(view, label) {
  return `<button class="${state.view === view ? "active" : ""}" data-view="${view}">${label}</button>`;
}

function renderView() {
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "race") return renderRace();
  if (state.view === "boats") return renderBoats();
  if (state.view === "start") return renderStartProcedure();
  if (state.view === "finish") return renderFinish();
  if (state.view === "results") return renderResults();
  if (state.view === "settings") return renderSettings();
  return "";
}

function renderDashboard() {
  return `
    <section class="grid two">
      <div class="panel">
        <h2>Dagens løb</h2>
        <div class="race-list">
          ${state.events.map((event) => `
            <button class="race-row ${event.id === state.selectedEventId ? "selected" : ""}" data-select-event="${event.id}">
              <span>
                <strong>${escapeHtml(event.name)}</strong>
                <small>${formatDate(event.date)} · ${event.starts.length} starter</small>
              </span>
              <span class="badge ${event.status}">${statusText(event.status)}</span>
            </button>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <h2>Aktiv start</h2>
        ${selectedStartCard()}
        <div class="quick-actions">
          <button class="primary" data-view="start">Startprocedure</button>
          <button class="danger" data-view="finish">Målgang</button>
          <button data-view="results">Resultater</button>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Hændelseslog</h2>
      ${renderLogs()}
    </section>
  `;
}

function selectedStartCard() {
  const start = selectedStart();
  if (!start) return `<p>Ingen start valgt.</p>`;
  return `
    <div class="status-card">
      <div>
        <p class="eyebrow">Klasse/startgruppe</p>
        <h3>${escapeHtml(start.name)}</h3>
      </div>
      <p><strong>Planlagt start:</strong> ${formatDateTime(start.scheduledStartTime)}</p>
      <p><strong>Faktisk start:</strong> ${start.actualStartTime ? formatDateTime(start.actualStartTime) : "Ikke sat"}</p>
      <p><strong>Distance:</strong> ${start.distanceNm ?? "-"} nm</p>
      <span class="badge ${start.status}">${statusText(start.status)}</span>
    </div>
  `;
}

function renderRace() {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <section class="grid two">
      <form class="panel form" id="raceForm">
        <h2>Opret nyt event/løb</h2>
        <p class="helper">Et event er selve kapsejladsen for dagen. Formularen opretter eventet og den første startgruppe; flere starter kan senere vælges og administreres under samme event.</p>
        <label>Eventnavn <input name="name" required value="Aftenmatch"></label>
        <label>Dato <input name="date" type="date" required value="${today}"></label>
        <label>Første startgruppe/klasse <input name="startName" required value="DH Klasse A"></label>
        <div class="form-row">
          <label>Startstander
            <select name="warningFlagType" id="warningFlagType">
              <option value="class">Klassestander</option>
              <option value="number">Talstander</option>
            </select>
          </label>
          <label>Klassestander
            <select name="warningFlagId" id="warningFlagId">
              ${renderClassFlagOptions()}
            </select>
          </label>
          <label>Talstander
            <select name="warningFlagNumber" id="warningFlagNumber">
              ${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="flag-preview-panel">
          <span class="muted">Valgt stander</span>
          <div id="warningFlagPreview">${renderConfiguredWarningFlag({ warningFlagType: "class", warningFlagId: "class-a" })}</div>
        </div>
        <label>Starttid <input name="startTime" type="datetime-local" required value="${localInputValue(minutesFromNow(10))}"></label>
        <label>Distance nm <input name="distanceNm" type="number" step="0.1" value="7.5"></label>
        <button class="primary" type="submit">Opret event/løb</button>
      </form>
      <div class="panel">
        <div class="section-header">
          <h2>Starter i valgt event/løb</h2>
          ${selectedEvent() ? `<button type="button" class="danger" id="deleteSelectedEvent">Slet løb</button>` : ""}
        </div>
        <p class="helper">Brug event-vælgeren øverst til at skifte mellem oprettede events. Listen her viser starterne for det valgte event.</p>
        <div class="race-list">
          ${(selectedEvent()?.starts ?? []).map((start) => `
            <button class="race-row ${start.id === state.selectedStartId ? "selected" : ""}" data-select-start="${start.id}">
              <span>
                <strong>${escapeHtml(start.name)}</strong>
                <small>${formatDateTime(start.scheduledStartTime)} · ${escapeHtml(warningFlagText(start))}</small>
              </span>
              <span class="badge ${start.status}">${statusText(start.status)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderClassFlagOptions() {
  const customFlags = state.settings?.customWarningFlags ?? [];
  return `
    <optgroup label="Signalflag">
      ${DEFAULT_CLASS_FLAGS.map((flag) => renderClassFlagOption(flag)).join("")}
    </optgroup>
    <optgroup label="Dansk Sejlunion · Kølbåde">
      ${DS_KEELBOAT_CLASS_FLAGS.map((flag) => renderClassFlagOption(flag)).join("")}
    </optgroup>
    <optgroup label="Dansk Sejlunion · Joller og katamaraner">
      ${DS_DINGHY_CAT_CLASS_FLAGS.map((flag) => renderClassFlagOption(flag)).join("")}
    </optgroup>
    ${customFlags.length ? `
      <optgroup label="Egne standere">
        ${customFlags.map((flag) => renderClassFlagOption(flag)).join("")}
      </optgroup>
    ` : ""}
  `;
}

function renderClassFlagOption(flag) {
  return `<option value="${escapeHtml(flag.id)}">${escapeHtml(flag.name)}</option>`;
}

function renderBoats() {
  return `
    <section class="grid two">
      <form class="panel form" id="websejlerForm">
        <h2>WebSejler-opslag</h2>
        <label>Certifikatnummer eller URL <input name="query" placeholder="https://websejler.dk/da/certifikat/35114"></label>
        <button class="primary" type="submit">Forsøg opslag</button>
        <p class="muted" id="lookupStatus">Hvis opslag fejler, kan båden indtastes manuelt.</p>
      </form>
      <form class="panel form" id="boatForm">
        <h2>Tilføj båd manuelt</h2>
        <label>Bådnavn <input name="boatName" required></label>
        <label>Sejlnummer <input name="sailNumber" required></label>
        <label>Bådtype <input name="boatType"></label>
        <label>Skipper <input name="skipper"></label>
        <label>Klub <input name="club"></label>
        <label>Måltal/handicap <input name="handicap" type="number" step="0.001"></label>
        <label>TCC <input name="tcc" type="number" step="0.001"></label>
        <button class="primary" type="submit">Tilføj båd</button>
      </form>
    </section>
    <section class="panel">
      <h2>Bådliste og målgangskø</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Kø</th><th>Båd</th><th>Sejlnr.</th><th>Skipper</th><th>Måltal</th><th>TCC</th><th></th></tr></thead>
          <tbody>
            ${state.boats.map((boat, index) => `
              <tr>
                <td>${boat.finishQueuePosition ?? index + 1}</td>
                <td><strong>${escapeHtml(boat.boatName)}</strong><br><small>${escapeHtml(boat.boatType)}</small></td>
                <td>${escapeHtml(boat.sailNumber)}</td>
                <td>${escapeHtml(boat.skipper)}<br><small>${escapeHtml(boat.club)}</small></td>
                <td>${boat.handicap ?? "-"}</td>
                <td>${boat.certificate?.tcc ?? "-"}</td>
                <td class="row-actions">
                  <button data-move-up="${boat.id}" ${index === 0 ? "disabled" : ""}>Op</button>
                  <button data-move-down="${boat.id}" ${index === state.boats.length - 1 ? "disabled" : ""}>Ned</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

let manualSignalQueue = Promise.resolve();

function renderStartProcedure() {
  const start = selectedStart();
  const procedure = getProcedure(start?.procedureType);
  const seconds = currentSecondsToStart();
  const procedureState = getProcedureState(seconds, procedure.id);
  const activeFlags = getActiveFlags(seconds, {
    procedureType: procedure.id,
    warningFlagType: start?.warningFlagType,
    warningFlagNumber: start?.warningFlagNumber,
    warningFlagId: start?.warningFlagId
  });
  return `
    <section class="start-screen">
      <div class="countdown">
        <p class="eyebrow">${escapeHtml(start?.name ?? "Ingen start")}</p>
        <div class="time">${formatDuration(seconds)}</div>
        <h2>${escapeHtml(procedureState.currentPhase)}</h2>
        <p>Næste signal: ${procedureState.nextSignal ? `${procedureState.nextSignal.signalName} ved ${formatDuration(procedureState.nextSignal.offsetSeconds)}` : "Ingen"}</p>
        ${renderSignalFlags([...activeFlags, ...getManualSignalFlags(start)])}
      </div>
      <div class="start-actions">
        <button class="primary huge" id="startCountdown">${isCountdownRunning(start) ? "Genstart 5 min" : "Start 5 min"}</button>
        <button id="setActualStart">Sæt faktisk start nu</button>
        <button id="soundTest">Lydtest</button>
        <button id="openStartDisplay">Åbn ekstern startskærm</button>
      </div>
      <div class="procedure-steps">
        ${procedure.steps.map((step) => `
          <div class="step ${step.offsetSeconds >= seconds ? "done" : ""}">
            <strong>${formatDuration(step.offsetSeconds)}</strong>
            <span>${escapeHtml(step.phase)}</span>
            <small>${[...(step.flagActions ?? []).map((action) => action.label), step.soundLabel].filter(Boolean).map(escapeHtml).join(" · ")}</small>
          </div>
        `).join("")}
      </div>
      ${renderManualSignals(start)}
    </section>
  `;
}

function renderManualSignals(start) {
  const activeIds = new Set(start?.manualSignalFlags ?? []);
  const activeFlags = getManualSignalFlags(start);
  return `
    <section class="panel manual-signal-panel">
      <div class="section-heading">
        <div>
          <h2>Ekstra signaler</h2>
          <p class="helper">Slå dommersignaler til og fra. De aktive signaler følger den eksterne startskærm.</p>
        </div>
        <span class="badge">${activeFlags.length} oppe</span>
      </div>
      <div class="manual-signal-active">
        ${renderSignalFlags(activeFlags, "Ingen ekstra signaler oppe")}
      </div>
      <div class="manual-signal-grid">
        ${RACE_SIGNAL_FLAGS.map((signal) => {
          const active = activeIds.has(signal.id);
          return `
            <button type="button" class="manual-signal-toggle ${active ? "active" : ""}" data-toggle-manual-signal="${escapeHtml(signal.id)}" aria-pressed="${active ? "true" : "false"}">
              ${renderFlagFace({ type: "race", code: signal.id, title: signal.name })}
              <span>${escapeHtml(signal.name)}</span>
              <small>${active ? "Slå fra" : "Slå til"}</small>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSignalFlags(flags, emptyText = "Ingen flag oppe") {
  return `
    <div class="signal-flags ${flags.length ? "" : "empty"}">
      ${flags.map((flag) => flag.type === "race" ? `
        <button type="button" class="flag-card removable" data-remove-manual-signal="${escapeHtml(flag.id)}" title="Klik for at tage flaget ned">
          ${renderFlagFace(flag)}
          <small>${escapeHtml(flag.title)}</small>
          <small class="remove-hint">Klik for at tage ned</small>
        </button>
      ` : `
        <div class="flag-card">
          ${renderFlagFace(flag)}
          <small>${escapeHtml(flag.title)}</small>
        </div>
      `).join("") || `<span>${escapeHtml(emptyText)}</span>`}
    </div>
  `;
}

function renderFlagFace(flag) {
  if (flag.type === "class") {
    const classFlag = classFlagById(flag.code, state.settings?.customWarningFlags ?? []);
    if (classFlag.dataUrl) {
      return `<div class="signal-flag class-flag custom-class-flag" style="background-image: url('${escapeHtml(classFlag.dataUrl)}')" aria-label="${escapeHtml(classFlag.name)}"></div>`;
    }
    return `<div class="${signalFlagClass(flag)} ${escapeHtml(classFlag.cssClass ?? "class-a")}" aria-label="${escapeHtml(classFlag.name)}"></div>`;
  }
  if (flag.type === "race") {
    const signal = raceSignalById(flag.code);
    if (signal?.stack) {
      return `<div class="signal-flag-stack" aria-label="${escapeHtml(signal.name)}">${signal.stack.map((cssClass) => `<div class="signal-flag race-signal-flag ${cssClass}"></div>`).join("")}</div>`;
    }
    return `<div class="${signalFlagClass(flag)} ${escapeHtml(signal?.cssClass ?? "")}" aria-label="${escapeHtml(signal?.name ?? flag.title)}"></div>`;
  }
  return `<div class="${signalFlagClass(flag)}" aria-label="${escapeHtml(flag.title)}"></div>`;
}

function signalFlagClass(flag) {
  if (flag.type === "prep") return `signal-flag prep prep-${flag.code.toLowerCase()}`;
  if (flag.type === "number") return `signal-flag number-flag number-${flag.code}`;
  if (flag.type === "race") return "signal-flag race-signal-flag";
  return "signal-flag class-flag";
}

function getManualSignalFlags(start) {
  return (start?.manualSignalFlags ?? [])
    .map((id) => raceSignalById(id))
    .filter(Boolean)
    .map((signal) => ({ type: "race", id: signal.id, code: signal.id, title: signal.name }));
}

function renderConfiguredWarningFlag(start) {
  const flags = getActiveFlags(300, {
    procedureType: "five-minute",
    warningFlagType: start.warningFlagType,
    warningFlagNumber: start.warningFlagNumber,
    warningFlagId: start.warningFlagId
  });
  return renderSignalFlags(flags);
}

function renderFinish() {
  const finishedIds = new Set(state.finishes.filter((finish) => !finish.isDeleted).map((finish) => finish.boatId));
  const queue = state.boats.filter((boat) => !finishedIds.has(boat.id));
  return `
    <section class="finish-layout">
      <div class="finish-buttons">
        <button class="finish-button" id="finishNext">Målgang</button>
        <button class="danger" id="undoFinish">Fortryd seneste målgang</button>
      </div>
      <div class="panel queue-panel">
        <div class="section-header">
          <h2>Klar til målgang</h2>
          <span class="muted">${queue.length} i kø</span>
        </div>
        <div class="queue">
          ${queue.map((boat, index) => `
            <div class="queue-item ${index === 0 ? "next" : ""}" data-queue-item="${boat.id}" draggable="true">
              <span class="queue-number">${index + 1}</span>
              <span class="queue-details">
                <strong>${escapeHtml(boat.boatName)}</strong>
                <small>${escapeHtml(boat.sailNumber)} · ${escapeHtml(boat.skipper || "Ingen skipper")}</small>
              </span>
              <span class="queue-actions">
                <button type="button" class="queue-drag-handle" data-drag-handle="${boat.id}" aria-label="Træk ${escapeHtml(boat.boatName)}">Træk</button>
                <button type="button" data-queue-up="${boat.id}" ${index === 0 ? "disabled" : ""}>Op</button>
                <button type="button" data-queue-down="${boat.id}" ${index === queue.length - 1 ? "disabled" : ""}>Ned</button>
                <button type="button" data-queue-top="${boat.id}" ${index === 0 ? "disabled" : ""}>Øverst</button>
                <button type="button" data-edit-boat="${boat.id}">Ret båd</button>
              </span>
            </div>
          `).join("") || `<p>Alle både er registreret i mål.</p>`}
        </div>
        ${renderBoatEditPanel()}
      </div>
    </section>
    <section class="panel">
      <h2>Registrerede mål</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Båd</th><th>Målgang</th><th>Rettelse</th></tr></thead>
          <tbody>
            ${state.finishes.filter((finish) => !finish.isDeleted).map((finish) => {
              const boat = state.boats.find((candidate) => candidate.id === finish.boatId);
              return `
                <tr>
                  <td>${escapeHtml(boat?.boatName ?? "Ukendt")}</td>
                  <td>${formatDateTime(finish.finishedAt)}</td>
                  <td>
                    <button data-edit-finish="${finish.id}">Ret tid/båd</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBoatEditPanel() {
  const boat = state.boats.find((candidate) => candidate.id === state.editingBoatId);
  if (!boat) return "";
  return `
    <form class="boat-edit-panel" id="finishBoatEditForm">
      <div class="section-header">
        <h3>Ret båd</h3>
        <button type="button" id="cancelBoatEdit">Luk</button>
      </div>
      <div class="edit-grid">
        <label>Bådnavn <input name="boatName" required value="${escapeHtml(boat.boatName)}"></label>
        <label>Sejlnummer <input name="sailNumber" required value="${escapeHtml(boat.sailNumber)}"></label>
        <label>Skipper <input name="skipper" value="${escapeHtml(boat.skipper)}"></label>
        <label>Bådtype <input name="boatType" value="${escapeHtml(boat.boatType)}"></label>
        <label>Klub <input name="club" value="${escapeHtml(boat.club)}"></label>
        <label>Måltal/handicap <input name="handicap" type="number" step="0.001" value="${boat.handicap ?? ""}"></label>
      </div>
      <div class="edit-actions">
        <button type="submit" class="primary">Gem båd</button>
        <button type="button" id="cancelBoatEditSecondary">Annuller</button>
      </div>
    </form>
  `;
}

function renderResults() {
  return `
    <section class="panel">
      <div class="section-header">
        <h2>Resultatliste</h2>
        <button id="refreshResults">Genberegn</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Pl.</th><th>Båd</th><th>Sejlnr.</th><th>Skipper</th><th>Start</th><th>Mål</th><th>Sejlet</th><th>Måltal</th><th>Korrigeret</th></tr>
          </thead>
          <tbody>
            ${state.results.map((result) => `
              <tr>
                <td><strong>${result.rank}</strong></td>
                <td>${escapeHtml(result.boatName)}</td>
                <td>${escapeHtml(result.sailNumber)}</td>
                <td>${escapeHtml(result.skipper)}</td>
                <td>${formatDateTime(result.startTime)}</td>
                <td>${formatDateTime(result.finishTime)}</td>
                <td>${formatDuration(result.elapsedSeconds)}</td>
                <td>${result.tcc ?? result.handicap ?? "-"}</td>
                <td><strong>${formatDuration(result.correctedSeconds)}</strong><br><small>${escapeHtml(result.method)}</small></td>
              </tr>
            `).join("") || `<tr><td colspan="9">Ingen målregistreringer endnu.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSettings() {
  const supportsSink = "setSinkId" in HTMLMediaElement.prototype;
  return `
    <section class="grid two">
      <form class="panel form" id="settingsForm">
        <h2>Lyd og procedure</h2>
        <label>Signalvolumen <input name="signalVolume" type="range" min="0" max="1" step="0.05" value="${state.settings?.signalVolume ?? 0.8}"></label>
        <label>Signallyd
          <select name="signalSound">
            ${SIGNAL_SOUNDS.map((sound) => `<option value="${sound.id}" ${sound.id === (state.settings?.signalSound ?? "electronic") ? "selected" : ""}>${sound.label}</option>`).join("")}
          </select>
        </label>
        <label>Procedure
          <select name="procedureType">
            <option value="five-minute" selected>5-minutters procedure</option>
          </select>
        </label>
        <label class="toggle-row">
          <input name="partyModeEnabled" type="checkbox" ${state.settings?.partyModeEnabled ?? true ? "checked" : ""}>
          <span>
            <strong>Party Mode</strong>
            <small>Vis konfetti når White Beam / certifikat 35114 tages i mål.</small>
          </span>
        </label>
        <button class="primary" type="submit">Gem indstillinger</button>
        <button type="button" id="settingsSoundTest">Lydtest</button>
      </form>
      <div class="panel">
        <h2>Bluetooth</h2>
        <p>Forbind Bluetooth-højttaleren på enheden først. Appen afspiller derefter via browserens aktuelle lydudgang.</p>
        <p>${supportsSink ? "Denne browser understøtter muligvis valg af lydudgang via setSinkId." : "Denne browser viser ikke audio output selection til webapps."}</p>
        <div id="audioDevices"></div>
      </div>
    </section>
    <section class="panel form">
      <h2>Egne klassestandere</h2>
      <p class="helper">Upload PNG/JPG/SVG af egne standere. De gemmes lokalt i SQLite og kan vælges ved oprettelse af løb.</p>
      <form class="form" id="customFlagForm">
        <label>Navn <input name="flagName" required placeholder="Fx Klubstander"></label>
        <label>Flagfil <input name="flagFile" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" required></label>
        <button class="primary" type="submit">Upload stander</button>
      </form>
      <div class="custom-flag-list">
        ${(state.settings?.customWarningFlags ?? []).map((flag) => `
          <div class="custom-flag-row">
            <span class="signal-flag class-flag custom-class-flag" style="background-image: url('${escapeHtml(flag.dataUrl)}')"></span>
            <strong>${escapeHtml(flag.name)}</strong>
            <button type="button" data-delete-custom-flag="${escapeHtml(flag.id)}">Fjern</button>
          </div>
        `).join("") || `<p class="muted">Ingen egne standere uploadet endnu.</p>`}
      </div>
    </section>
    <section class="panel">
      <h2>Seneste hændelser</h2>
      ${renderLogs()}
    </section>
  `;
}

function renderLogs() {
  return `
    <div class="log-list">
      ${state.logs.map((log) => `
        <div class="log-row">
          <span>${formatDateTime(log.createdAt)}</span>
          <strong>${escapeHtml(log.message)}</strong>
          <small>${escapeHtml(log.type)}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderConfettiLayer() {
  if (!state.confettiBursts.length) return "";
  return `
    <div class="confetti-layer" aria-hidden="true">
      ${state.confettiBursts.flatMap((burst) => burst.particles).map((particle) => `
        <span class="confetti-piece" style="
          --x: ${particle.x}vw;
          --rise-x: ${particle.riseX}vw;
          --fall-x: ${particle.fallX}vw;
          --rise-y: -${particle.riseY}vh;
          --size: ${particle.size}px;
          --duration: ${particle.duration}ms;
          --delay: ${particle.delay}ms;
          --rotation: ${particle.rotation}deg;
          background: ${particle.color};
        "></span>
      `).join("")}
    </div>
  `;
}

function bindGlobalControls() {
  document.querySelector("#eventSelect")?.addEventListener("change", async (event) => {
    state.selectedEventId = event.target.value;
    state.selectedStartId = selectedEvent()?.starts?.[0]?.id ?? null;
    await loadStartData();
    render();
  });
  document.querySelector("#startSelect")?.addEventListener("change", async (event) => {
    state.selectedStartId = event.target.value;
    await loadStartData();
    render();
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

function bindView() {
  document.querySelectorAll("[data-select-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedEventId = button.dataset.selectEvent;
      state.selectedStartId = selectedEvent()?.starts?.[0]?.id ?? null;
      await loadStartData();
      render();
    });
  });
  document.querySelectorAll("[data-select-start]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedStartId = button.dataset.selectStart;
      await loadStartData();
      render();
    });
  });
  bindRaceForm();
  bindBoatForms();
  bindQueueButtons();
  bindStartButtons();
  bindFinishButtons();
  bindResultsButtons();
  bindSettings();
}

function bindRaceForm() {
  document.querySelector("#raceForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const payload = {
      name: data.name,
      date: data.date,
      starts: [
        {
          name: data.startName,
          scheduledStartTime: new Date(data.startTime).toISOString(),
          distanceNm: Number(data.distanceNm || 0),
          procedureType: "five-minute",
          warningFlagType: data.warningFlagType,
          warningFlagNumber: data.warningFlagType === "number" ? Number(data.warningFlagNumber) : null,
          warningFlagId: data.warningFlagType === "class" ? data.warningFlagId : "class-a"
        }
      ]
    };
    const created = await api.post("/api/events", payload);
    state.selectedEventId = created.id;
    state.selectedStartId = created.starts[0]?.id ?? null;
    await loadAll();
    setView("dashboard");
  });
  const updateWarningFlagForm = () => {
    const type = document.querySelector("#warningFlagType")?.value ?? "class";
    const numberSelect = document.querySelector("#warningFlagNumber");
    const classSelect = document.querySelector("#warningFlagId");
    if (numberSelect) numberSelect.disabled = type !== "number";
    if (classSelect) classSelect.disabled = type !== "class";
    const preview = document.querySelector("#warningFlagPreview");
    if (preview) {
      preview.innerHTML = renderConfiguredWarningFlag({
        warningFlagType: type,
        warningFlagNumber: Number(numberSelect?.value ?? 1),
        warningFlagId: classSelect?.value ?? "class-a"
      });
    }
  };
  document.querySelector("#warningFlagType")?.addEventListener("change", updateWarningFlagForm);
  document.querySelector("#warningFlagNumber")?.addEventListener("change", updateWarningFlagForm);
  document.querySelector("#warningFlagId")?.addEventListener("change", updateWarningFlagForm);
  updateWarningFlagForm();
  document.querySelector("#deleteSelectedEvent")?.addEventListener("click", async () => {
    const eventToDelete = selectedEvent();
    if (!eventToDelete || !confirm(`Slet løbet "${eventToDelete.name}" og alle starter, både, mål og resultater?`)) return;
    await api.delete(`/api/events/${eventToDelete.id}`);
    state.selectedEventId = null;
    state.selectedStartId = null;
    await loadAll();
    render();
  });
}

function bindBoatForms() {
  document.querySelector("#boatForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    await createBoatFromForm(data);
    event.target.reset();
  });
  document.querySelector("#websejlerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#lookupStatus");
    const data = Object.fromEntries(new FormData(event.target));
    status.textContent = "Henter WebSejler...";
    const result = await api.post("/api/websejler/lookup", { query: data.query });
    if (!result.ok || result.candidates.length === 0) {
      status.textContent = result.message ?? "Ingen data fundet. Brug manuel indtastning.";
      return;
    }
    const candidate = result.candidates[0];
    await api.post(`/api/starts/${state.selectedStartId}/boats`, {
      ...candidate,
      source: "websejler"
    });
    status.textContent = `Tilføjet fra WebSejler: ${candidate.boatName || candidate.sailNumber || data.query}`;
    await loadStartData();
    render();
  });
}

async function createBoatFromForm(data) {
  await api.post(`/api/starts/${state.selectedStartId}/boats`, {
    boatName: data.boatName,
    sailNumber: data.sailNumber,
    boatType: data.boatType,
    skipper: data.skipper,
    club: data.club,
    handicap: data.handicap ? Number(data.handicap) : null,
    source: "manual",
    certificate: data.tcc
      ? {
          tcc: Number(data.tcc),
          raw: { manual: true }
        }
      : null
  });
  await loadStartData();
  render();
}

function bindQueueButtons() {
  document.querySelectorAll("[data-move-up], [data-move-down]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.moveUp || button.dataset.moveDown;
      const direction = button.dataset.moveUp ? -1 : 1;
      await moveBoatInQueue(id, direction, false);
    });
  });
}

function bindStartButtons() {
  document.querySelector("#startCountdown")?.addEventListener("click", async () => {
    const procedure = getProcedure(selectedStart()?.procedureType);
    state.countdown.fired = new Set();
    await api.patch(`/api/starts/${state.selectedStartId}/countdown`, {
      action: "start",
      durationSeconds: procedure.durationSeconds
    });
    await loadAll();
    render();
  });
  document.querySelector("#setActualStart")?.addEventListener("click", async () => {
    if (!confirm("Sæt faktisk starttidspunkt til nu?")) return;
    await api.patch(`/api/starts/${state.selectedStartId}`, {
      actualStartTime: new Date().toISOString(),
      status: "running"
    });
    await loadAll();
    render();
  });
  document.querySelector("#soundTest")?.addEventListener("click", () => playSignal("single"));
  document.querySelector("#openStartDisplay")?.addEventListener("click", () => {
    if (!state.selectedStartId) return;
    window.open(`/display.html?startId=${encodeURIComponent(state.selectedStartId)}`, "_blank", "noopener,noreferrer");
  });
  document.querySelectorAll("[data-toggle-manual-signal], [data-remove-manual-signal]").forEach((button) => {
    button.addEventListener("click", () => {
      const signalId = button.dataset.toggleManualSignal ?? button.dataset.removeManualSignal;
      // Køsæt klik, så hurtige klik ikke overskriver hinanden med forældet state
      manualSignalQueue = manualSignalQueue.then(async () => {
        const start = selectedStart();
        if (!start) return;
        const activeSignals = new Set(start.manualSignalFlags ?? []);
        if (activeSignals.has(signalId)) activeSignals.delete(signalId);
        else activeSignals.add(signalId);
        await api.patch(`/api/starts/${start.id}`, { manualSignalFlags: [...activeSignals] });
        await loadAll();
        render();
      }).catch((error) => console.error(error));
    });
  });
}

function bindFinishButtons() {
  document.querySelector("#finishNext")?.addEventListener("click", async () => {
    const boat = firstUnfinishedBoat();
    if (!boat) return;
    const shouldCelebrate = shouldTriggerPartyMode(boat);
    await api.post(`/api/starts/${state.selectedStartId}/finish-next`, { finishedAt: new Date().toISOString() });
    playSignal("short");
    await loadStartData();
    if (shouldCelebrate) triggerConfetti();
    else render();
  });
  document.querySelector("#undoFinish")?.addEventListener("click", async () => {
    if (!confirm("Fortryd seneste målgang?")) return;
    await api.post(`/api/starts/${state.selectedStartId}/undo-finish`);
    await loadStartData();
    render();
  });
  document.querySelectorAll("[data-edit-finish]").forEach((button) => {
    button.addEventListener("click", async () => {
      const finish = state.finishes.find((candidate) => candidate.id === button.dataset.editFinish);
      const boat = state.boats.find((candidate) => candidate.id === finish.boatId);
      const time = prompt("Ny målgangstid (ISO eller lokal tekst)", localInputValue(new Date(finish.finishedAt)));
      if (!time) return;
      const boatName = prompt("Bådnavn ved rettelse", boat?.boatName ?? "");
      const replacement = state.boats.find((candidate) => candidate.boatName.toLowerCase() === boatName?.toLowerCase()) ?? boat;
      await api.patch(`/api/finishes/${finish.id}`, {
        boatId: replacement.id,
        finishedAt: new Date(time).toISOString(),
        notes: "Rettet fra målgangsskærm"
      });
      await loadStartData();
      render();
    });
  });
  document.querySelectorAll("[data-queue-up], [data-queue-down]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.queueUp || button.dataset.queueDown;
      const direction = button.dataset.queueUp ? -1 : 1;
      await moveBoatInQueue(id, direction, true);
    });
  });
  document.querySelectorAll("[data-queue-top]").forEach((button) => {
    button.addEventListener("click", async () => {
      await moveBoatToTop(button.dataset.queueTop);
    });
  });
  document.querySelectorAll("[data-edit-boat]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingBoatId = button.dataset.editBoat;
      render();
    });
  });
  bindBoatEditForm();
  bindQueueDragDrop();
}

function bindBoatEditForm() {
  document.querySelector("#finishBoatEditForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const boat = state.boats.find((candidate) => candidate.id === state.editingBoatId);
    if (!boat) return;
    const data = Object.fromEntries(new FormData(event.target));
    await api.patch(`/api/boats/${boat.id}`, {
      boatName: data.boatName,
      sailNumber: data.sailNumber,
      skipper: data.skipper,
      boatType: data.boatType,
      club: data.club,
      handicap: data.handicap === "" ? null : Number(data.handicap)
    });
    state.editingBoatId = null;
    await loadStartData();
    render();
  });
  document.querySelector("#cancelBoatEdit")?.addEventListener("click", closeBoatEdit);
  document.querySelector("#cancelBoatEditSecondary")?.addEventListener("click", closeBoatEdit);
}

function closeBoatEdit() {
  state.editingBoatId = null;
  render();
}

async function moveBoatInQueue(id, direction, unfinishedOnly) {
  const ids = unfinishedOnly ? unfinishedBoatIds() : state.boats.map((boat) => boat.id);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await saveQueueOrder(unfinishedOnly ? mergeVisibleQueue(ids) : ids);
}

async function moveBoatToTop(id) {
  const ids = unfinishedBoatIds();
  const index = ids.indexOf(id);
  if (index <= 0) return;
  ids.splice(index, 1);
  ids.unshift(id);
  await saveQueueOrder(mergeVisibleQueue(ids));
}

async function moveBoatBefore(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const ids = unfinishedBoatIds();
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  ids.splice(sourceIndex, 1);
  ids.splice(targetIndex, 0, sourceId);
  await saveQueueOrder(mergeVisibleQueue(ids));
}

async function saveQueueOrder(boatIds) {
  await api.put(`/api/starts/${state.selectedStartId}/queue`, { boatIds });
  await loadStartData();
  render();
}

function bindQueueDragDrop() {
  const items = [...document.querySelectorAll("[data-queue-item]")];
  items.forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.dataset.queueItem);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => clearQueueDragClasses());
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
    item.addEventListener("drop", async (event) => {
      event.preventDefault();
      item.classList.remove("drag-over");
      await moveBoatBefore(event.dataTransfer.getData("text/plain"), item.dataset.queueItem);
    });
  });

  document.querySelectorAll("[data-drag-handle]").forEach((handle) => {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    handle.addEventListener("pointerdown", (event) => {
      startX = event.clientX;
      startY = event.clientY;
      isDragging = false;
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) < 10) return;
      isDragging = true;
      clearQueueDragClasses("drag-over");
      handle.closest("[data-queue-item]")?.classList.add("dragging");
      document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-queue-item]")?.classList.add("drag-over");
    });
    handle.addEventListener("pointerup", async (event) => {
      const sourceId = handle.dataset.dragHandle;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-queue-item]");
      clearQueueDragClasses();
      if (isDragging && target) await moveBoatBefore(sourceId, target.dataset.queueItem);
    });
    handle.addEventListener("pointercancel", () => clearQueueDragClasses());
  });
}

function clearQueueDragClasses(...classNames) {
  const names = classNames.length ? classNames : ["dragging", "drag-over"];
  document.querySelectorAll(names.map((name) => `.${name}`).join(", ")).forEach((element) => {
    element.classList.remove(...names);
  });
}

function unfinishedBoatIds() {
  const finishedIds = new Set(state.finishes.filter((finish) => !finish.isDeleted).map((finish) => finish.boatId));
  return state.boats.filter((boat) => !finishedIds.has(boat.id)).map((boat) => boat.id);
}

function mergeVisibleQueue(visibleIds) {
  const visible = new Set(visibleIds);
  let nextVisibleIndex = 0;
  return state.boats.map((boat) => {
    if (!visible.has(boat.id)) return boat.id;
    const replacement = visibleIds[nextVisibleIndex];
    nextVisibleIndex += 1;
    return replacement;
  });
}

function bindResultsButtons() {
  document.querySelector("#refreshResults")?.addEventListener("click", async () => {
    await loadStartData();
    render();
  });
}

function bindSettings() {
  document.querySelector("#settingsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.settings = await api.patch("/api/settings", {
      signalVolume: Number(data.signalVolume),
      signalSound: data.signalSound,
      partyModeEnabled: data.partyModeEnabled === "on",
      procedureType: data.procedureType,
      customWarningFlags: state.settings?.customWarningFlags ?? []
    });
    await loadStartData();
    render();
  });
  document.querySelector("#settingsSoundTest")?.addEventListener("click", () => playSignal("single"));
  document.querySelector("#customFlagForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const file = data.get("flagFile");
    if (!(file instanceof File) || file.size === 0) return;
    const dataUrl = await readFileAsDataUrl(file);
    const customWarningFlags = [
      ...(state.settings?.customWarningFlags ?? []),
      {
        id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: String(data.get("flagName") || file.name),
        dataUrl
      }
    ];
    state.settings = await api.patch("/api/settings", { customWarningFlags });
    form.reset();
    render();
  });
  document.querySelectorAll("[data-delete-custom-flag]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteCustomFlag;
      const customWarningFlags = (state.settings?.customWarningFlags ?? []).filter((flag) => flag.id !== id);
      state.settings = await api.patch("/api/settings", { customWarningFlags });
      render();
    });
  });
  renderAudioDevices();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function renderAudioDevices() {
  const container = document.querySelector("#audioDevices");
  if (!container || !navigator.mediaDevices?.enumerateDevices || !("setSinkId" in HTMLMediaElement.prototype)) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  container.innerHTML = `
    <label>Lydudgang
      <select id="audioOutputSelect">
        ${outputs.map((device) => `<option value="${device.deviceId}">${escapeHtml(device.label || "Lydudgang")}</option>`).join("")}
      </select>
    </label>
  `;
  document.querySelector("#audioOutputSelect")?.addEventListener("change", async (event) => {
    state.settings = await api.patch("/api/settings", { audioOutputId: event.target.value });
  });
}

function tickCountdown() {
  if (!isCountdownRunning(selectedStart())) return;
  const seconds = currentSecondsToStart();
  const procedure = getProcedure(selectedStart()?.procedureType);
  const due = procedure.steps.find((step) => step.offsetSeconds === seconds);
  if (due && !state.countdown.fired.has(due.offsetSeconds)) {
    state.countdown.fired.add(due.offsetSeconds);
    playSignal(due.soundPattern);
  }
  if (state.view === "start") render();
}

function currentSecondsToStart() {
  const start = selectedStart();
  const procedure = getProcedure(start?.procedureType);
  if (!start?.countdownRunning || !start.countdownTargetTime) return procedure.durationSeconds;
  return Math.max(0, Math.round((new Date(start.countdownTargetTime).getTime() - Date.now()) / 1000));
}

function isCountdownRunning(start) {
  return Boolean(start?.countdownRunning && start.countdownTargetTime && new Date(start.countdownTargetTime).getTime() > Date.now());
}

function warningFlagText(start) {
  if (start?.warningFlagType === "number") return `Talstander ${start.warningFlagNumber ?? 1}`;
  return classFlagById(start?.warningFlagId, state.settings?.customWarningFlags ?? []).name;
}

function playSignal(pattern) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const volume = state.settings?.signalVolume ?? 0.8;
  const sound = state.settings?.signalSound ?? "electronic";
  if (sound === "foghorn") playFoghorn(context, volume, pattern);
  else if (sound === "bell") playBell(context, volume, pattern);
  else playElectronicSignal(context, volume, pattern);
  setTimeout(() => context.close?.(), signalSeconds(pattern, { short: 0.8, single: 1.6, long: 3.5 }) * 1000 + 600);
}

// Lydlængder: short = kort klik (fx målgang), single = "1 lydsignal", long = "1 langt lydsignal"
function signalSeconds(pattern, lengths) {
  return lengths[pattern] ?? lengths.single;
}

function playElectronicSignal(context, volume, pattern) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const duration = signalSeconds(pattern, { short: 0.18, single: 0.8, long: 2.5 });
  oscillator.frequency.value = 440;
  oscillator.type = "sine";
  gain.gain.value = volume;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + duration);
}

function playFoghorn(context, volume, pattern) {
  const duration = signalSeconds(pattern, { short: 0.75, single: 1.2, long: 3 });
  const start = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.001, start);
  master.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.85), start + 0.18);
  master.gain.exponentialRampToValueAtTime(0.001, start + duration);
  master.connect(context.destination);

  [118, 151].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.linearRampToValueAtTime(frequency * 0.96, start + duration);
    oscillator.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}

function playBell(context, volume, pattern) {
  const duration = signalSeconds(pattern, { short: 0.7, single: 1.25, long: 3 });
  const start = context.currentTime;
  [660, 990, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume * (0.45 - index * 0.1), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}

function shouldTriggerPartyMode(boat) {
  if (!(state.settings?.partyModeEnabled ?? true)) return false;
  const certificateNumber = String(boat?.certificate?.certificateNumber ?? "").trim();
  const boatName = String(boat?.boatName ?? "").trim().toLowerCase();
  return certificateNumber === "35114" || boatName === "white beam";
}

function triggerConfetti() {
  const burstId = `confetti-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const colors = ["#006d77", "#83c5be", "#ffb703", "#fb8500", "#d90429", "#ffffff", "#3a86ff"];
  const particles = Array.from({ length: 90 }, (_, index) => ({
    id: `${burstId}-${index}`,
    x: 50 + randomBetween(-28, 28),
    riseX: randomBetween(-32, 32),
    fallX: randomBetween(-45, 45),
    riseY: randomBetween(52, 86),
    size: randomBetween(7, 14),
    duration: randomBetween(2300, 3300),
    delay: randomBetween(0, 220),
    rotation: randomBetween(180, 900),
    color: colors[index % colors.length]
  }));
  state.confettiBursts = [...state.confettiBursts, { id: burstId, particles }];
  render();
  setTimeout(() => {
    state.confettiBursts = state.confettiBursts.filter((burst) => burst.id !== burstId);
    render();
  }, 3600);
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function firstUnfinishedBoat() {
  const finishedIds = new Set(state.finishes.filter((finish) => !finish.isDeleted).map((finish) => finish.boatId));
  return state.boats.find((boat) => !finishedIds.has(boat.id));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function minutesFromNow(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes, 0, 0);
  return date;
}

function localInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function statusText(status) {
  return {
    planned: "Planlagt",
    running: "I gang",
    finished: "Afsluttet"
  }[status] ?? status;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init().catch((error) => {
  app.innerHTML = `<main class="error"><h1>Appen kunne ikke starte</h1><p>${escapeHtml(error.message)}</p></main>`;
});
