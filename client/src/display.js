import { formatDuration, getActiveFlags, getProcedure, getProcedureState } from "../../shared/startProcedure.mjs";
import { classFlagById, raceSignalById } from "../../shared/flags.mjs";

const app = document.querySelector("#displayApp");
const params = new URLSearchParams(window.location.search);
const startId = params.get("startId");
const state = {
  data: null,
  error: null,
  clockOffsetMs: 0
};

async function fetchDisplayState() {
  if (!startId) {
    state.error = "Mangler startId i URL'en.";
    render();
    return;
  }
  try {
    const response = await fetch(`/api/starts/${encodeURIComponent(startId)}/display-state`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Kunne ikke hente startskærm.");
    state.data = data;
    state.error = null;
    state.clockOffsetMs = new Date(data.serverTime).getTime() - Date.now();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

function render() {
  if (state.error) {
    app.innerHTML = `
      <main class="display-shell display-error">
        <p class="display-eyebrow">Ekstern startskærm</p>
        <h1>${escapeHtml(state.error)}</h1>
      </main>
    `;
    return;
  }

  if (!state.data) {
    app.innerHTML = `
      <main class="display-shell">
        <p class="display-eyebrow">Ekstern startskærm</p>
        <h1>Indlæser start...</h1>
      </main>
    `;
    return;
  }

  const { eventName, start } = state.data;
  const procedure = getProcedure(start.procedureType);
  const seconds = secondsToStart(start, procedure.durationSeconds);
  const procedureState = getProcedureState(seconds, procedure.id);
  const waiting = !start.countdownRunning || !start.countdownTargetTime;
  const started = !waiting && seconds <= 0;
  const activeFlags = waiting
    ? []
    : getActiveFlags(seconds, {
        procedureType: procedure.id,
        warningFlagType: start.warningFlagType,
        warningFlagNumber: start.warningFlagNumber,
        warningFlagId: start.warningFlagId
      });
  const manualFlags = getManualSignalFlags(start);

  app.innerHTML = `
    <main class="display-shell ${started ? "started" : ""}">
      <header class="display-header">
        <div>
          <p class="display-eyebrow">${escapeHtml(eventName || "Kapsejlads")}</p>
          <h1>${escapeHtml(start.name)}</h1>
        </div>
        <button type="button" id="displayFullscreen">Fuld skærm</button>
      </header>

      <section class="display-countdown">
        <p class="display-status">${waiting ? "Afventer startprocedure" : escapeHtml(procedureState.currentPhase)}</p>
        <div class="display-time">${waiting ? formatDuration(procedure.durationSeconds) : formatDuration(seconds)}</div>
        <p class="display-next">
          ${waiting
            ? `Planlagt start: ${formatDateTime(start.scheduledStartTime)}`
            : procedureState.nextSignal
              ? `Næste signal: ${escapeHtml(procedureState.nextSignal.signalName)} ved ${formatDuration(procedureState.nextSignal.offsetSeconds)}`
              : "Startet"}
        </p>
      </section>

      <section class="display-flag-panel">
        <h2>Signalflag</h2>
        ${renderSignalFlags(activeFlags)}
        ${manualFlags.length ? `
          <h2>Ekstra signaler</h2>
          ${renderSignalFlags(manualFlags)}
        ` : ""}
      </section>
    </main>
  `;

  document.querySelector("#displayFullscreen")?.addEventListener("click", () => {
    document.documentElement.requestFullscreen?.();
  });
}

function secondsToStart(start, durationSeconds) {
  if (!start.countdownRunning || !start.countdownTargetTime) return durationSeconds;
  const now = Date.now() + state.clockOffsetMs;
  return Math.max(0, Math.round((new Date(start.countdownTargetTime).getTime() - now) / 1000));
}

function renderSignalFlags(flags) {
  return `
    <div class="signal-flags display-flags ${flags.length ? "" : "empty"}">
      ${flags.map((flag) => `
        <div class="flag-card">
          ${renderFlagFace(flag)}
          <small>${escapeHtml(flag.title)}</small>
        </div>
      `).join("") || `<span>Ingen flag oppe</span>`}
    </div>
  `;
}

function renderFlagFace(flag) {
  if (flag.type === "class") {
    const classFlag = classFlagById(flag.code, state.data?.customWarningFlags ?? []);
    if (classFlag.dataUrl) {
      return `<div class="signal-flag class-flag custom-class-flag" style="background-image: url('${escapeHtml(classFlag.dataUrl)}')" aria-label="${escapeHtml(classFlag.name)}"></div>`;
    }
    return `<div class="${signalFlagClass(flag)} ${escapeHtml(classFlag.cssClass ?? "class-a")}" aria-label="${escapeHtml(classFlag.name)}"></div>`;
  }
  if (flag.type === "race") {
    const signal = raceSignalById(flag.code);
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

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

await fetchDisplayState();
setInterval(fetchDisplayState, 1000);
setInterval(render, 250);
