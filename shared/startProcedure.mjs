export const FIVE_MINUTE_PROCEDURE = {
  id: "five-minute",
  name: "5-minutters startprocedure",
  durationSeconds: 5 * 60,
  steps: [
    {
      offsetSeconds: 5 * 60,
      phase: "Varselssignal",
      signalName: "Varsel",
      soundPattern: "single",
      soundLabel: "1 lydsignal",
      description: "5 minutter til start",
      flagActions: [{ flag: "class", action: "up", label: "Klasseflag op" }]
    },
    {
      offsetSeconds: 4 * 60,
      phase: "Klarsignal",
      signalName: "Klar",
      soundPattern: "single",
      soundLabel: "1 lydsignal",
      description: "4 minutter til start",
      flagActions: [{ flag: "prep", action: "up", label: "Klarsignal op" }]
    },
    {
      offsetSeconds: 60,
      phase: "Et-minut-signal",
      signalName: "Et minut",
      soundPattern: "long",
      soundLabel: "1 langt lydsignal",
      description: "1 minut til start",
      flagActions: [{ flag: "prep", action: "down", label: "Klarsignal ned" }]
    },
    {
      offsetSeconds: 0,
      phase: "Startsignal",
      signalName: "Start",
      soundPattern: "single",
      soundLabel: "1 lydsignal",
      description: "Start",
      flagActions: [{ flag: "class", action: "down", label: "Klasseflag ned" }]
    }
  ]
};

// Opmærksomhedssignal: orange flag op senest 10 min før start (1 lydsignal). Vises som ekstra trin før nedtællingen.
export const ATTENTION_STEP = {
  offsetSeconds: 10 * 60,
  phase: "Opmærksomhedssignal",
  signalName: "Opmærksomhed",
  soundPattern: "single",
  soundLabel: "1 lydsignal",
  description: "Senest 10 minutter til start",
  flagActions: [{ flag: "orange", action: "up", label: "Orange flag op (senest)" }]
};

// Klarsignal: P, I, Z, Z og I eller sort flag
export const PREP_FLAG_OPTIONS = [
  { id: "P", label: "P-flag" },
  { id: "I", label: "I-flag" },
  { id: "Z", label: "Z-flag" },
  { id: "ZI", label: "Z og I" },
  { id: "BLACK", label: "Sort flag" }
];

export function normalizePrepFlag(value) {
  return PREP_FLAG_OPTIONS.some((option) => option.id === value) ? value : "P";
}

const PREP_FLAG_FACES = {
  P: [{ id: "prep-p", type: "prep", code: "P" }],
  I: [{ id: "i", type: "race", code: "i" }],
  Z: [{ id: "z", type: "race", code: "z" }],
  ZI: [{ id: "z", type: "race", code: "z" }, { id: "i", type: "race", code: "i" }],
  BLACK: [{ id: "black", type: "race", code: "black" }]
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
  const prepFlag = normalizePrepFlag(options.prepFlag ?? "P");
  const flags = [];
  // Rækkefølge som i startskemaet: orange flag, derefter klasseflag/talstander, derefter klarsignal
  if (options.attentionFlag !== false && secondsToStart <= 10 * 60 && secondsToStart > 0) {
    flags.push({ id: "orange", type: "race", code: "orange", label: "", title: "Opmærksomhedssignal" });
  }
  if (secondsToStart <= 5 * 60 && secondsToStart > 0) {
    flags.push(
      warningFlagType === "number"
        ? { id: `number-${warningFlagNumber}`, type: "number", code: String(warningFlagNumber), label: "", title: `Talstander ${warningFlagNumber}` }
        : { id: warningFlagId, type: "class", code: warningFlagId, label: "", title: "Klassestander" }
    );
  }
  if (secondsToStart <= 4 * 60 && secondsToStart > 60) {
    flags.push(...PREP_FLAG_FACES[prepFlag].map((flag) => ({ ...flag, label: "", title: "Klarsignal" })));
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
