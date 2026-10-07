export const FIVE_MINUTE_PROCEDURE = {
  id: "five-minute",
  name: "5-minutters startprocedure",
  durationSeconds: 5 * 60,
  steps: [
    {
      offsetSeconds: 5 * 60,
      phase: "Varselssignal",
      signalName: "Varsel",
      soundPattern: "long",
      description: "5 minutter til start",
      flagActions: [{ flag: "class", action: "up", label: "Klasseflag op" }]
    },
    {
      offsetSeconds: 4 * 60,
      phase: "Klarsignal",
      signalName: "Klar",
      soundPattern: "long",
      description: "4 minutter til start",
      flagActions: [{ flag: "prep", action: "up", label: "P-flag op" }]
    },
    {
      offsetSeconds: 60,
      phase: "Et-minut-signal",
      signalName: "Et minut",
      soundPattern: "long",
      description: "1 minut til start",
      flagActions: [{ flag: "prep", action: "down", label: "P-flag ned" }]
    },
    {
      offsetSeconds: 0,
      phase: "Startsignal",
      signalName: "Start",
      soundPattern: "long",
      description: "Start",
      flagActions: [{ flag: "class", action: "down", label: "Klasseflag ned" }]
    }
  ]
};

export const PROCEDURES = [FIVE_MINUTE_PROCEDURE];

export function getProcedure(type = "five-minute") {
  return PROCEDURES.find((procedure) => procedure.id === type) ?? FIVE_MINUTE_PROCEDURE;
}

export function getProcedureState(secondsToStart, type = "five-minute") {
  const procedure = getProcedure(type);
  const elapsed = procedure.durationSeconds - secondsToStart;
  const firedSteps = procedure.steps.filter((step) => step.offsetSeconds >= secondsToStart);
  const current = firedSteps.at(-1) ?? procedure.steps[0];
  const next = procedure.steps.find((step) => step.offsetSeconds < secondsToStart) ?? null;

  return {
    procedure,
    secondsToStart,
    elapsedSeconds: Math.max(0, elapsed),
    currentPhase: secondsToStart <= 0 ? "Startet" : current.phase,
    nextSignal: next,
    dueSignal: procedure.steps.find((step) => step.offsetSeconds === secondsToStart) ?? null,
    activeFlags: getActiveFlags(secondsToStart, { procedureType: procedure.id })
  };
}

export function getActiveFlags(secondsToStart, options = {}) {
  const procedure = getProcedure(options.procedureType);
  if (procedure.id !== "five-minute") return [];

  const warningFlagType = options.warningFlagType ?? "class";
  const warningFlagNumber = normalizeFlagNumber(options.warningFlagNumber);
  const warningFlagId = options.warningFlagId ?? "class-a";
  const prepFlag = options.prepFlag ?? "P";
  const flags = [];
  if (secondsToStart <= 5 * 60 && secondsToStart > 0) {
    flags.push(
      warningFlagType === "number"
        ? { id: `number-${warningFlagNumber}`, type: "number", code: String(warningFlagNumber), label: "", title: `Talstander ${warningFlagNumber}` }
        : { id: warningFlagId, type: "class", code: warningFlagId, label: "", title: "Klassestander" }
    );
  }
  if (secondsToStart <= 4 * 60 && secondsToStart > 60) {
    flags.push({ id: `prep-${prepFlag.toLowerCase()}`, type: "prep", code: prepFlag, label: "", title: "Klarsignal" });
  }
  return flags;
}

function normalizeFlagNumber(value) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1 && number <= 9) return number;
  return 1;
}

export function formatDuration(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return "-";
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalSeconds));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  if (hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}
