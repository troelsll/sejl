export const DEFAULT_CLASS_FLAGS = [
  { id: "class-a", name: "Alfa", cssClass: "class-a" },
  { id: "class-b", name: "Bravo", cssClass: "class-b" },
  { id: "class-c", name: "Charlie", cssClass: "class-c" },
  { id: "class-d", name: "Delta", cssClass: "class-d" },
  { id: "class-e", name: "Echo", cssClass: "class-e" },
  { id: "class-f", name: "Foxtrot", cssClass: "class-f" },
  { id: "class-g", name: "Golf", cssClass: "class-g" },
  { id: "class-h", name: "Hotel", cssClass: "class-h" },
  { id: "class-i", name: "India", cssClass: "class-i" },
  { id: "class-j", name: "Juliet", cssClass: "class-j" }
];

export const DS_KEELBOAT_CLASS_FLAGS = [
  dsClassFlag("ds-keel-aphrodite-101", "Aphrodite 101"),
  dsClassFlag("ds-keel-bb-10m", "BB 10M"),
  dsClassFlag("ds-keel-cb66", "CB66"),
  dsClassFlag("ds-keel-express", "Express"),
  dsClassFlag("ds-keel-h-boat", "H-båd"),
  dsClassFlag("ds-keel-j70", "J/70"),
  dsClassFlag("ds-keel-j80", "J/80"),
  dsClassFlag("ds-keel-l23", "L23"),
  dsClassFlag("ds-keel-molich-x-meter", "Molich X-meter"),
  dsClassFlag("ds-keel-folkebad", "Nordisk Folkebåd"),
  dsClassFlag("ds-keel-spaekhugger", "Spækhugger"),
  dsClassFlag("ds-keel-star", "STAR"),
  dsClassFlag("ds-keel-yngling", "Yngling"),
  dsClassFlag("ds-keel-x-99", "X-99"),
  dsClassFlag("ds-keel-806", "806")
];

export const DS_DINGHY_CAT_CLASS_FLAGS = [
  dsClassFlag("ds-dinghy-optimist", "Optimist"),
  dsClassFlag("ds-dinghy-tera", "Tera"),
  dsClassFlag("ds-dinghy-zoom8", "Zoom8"),
  dsClassFlag("ds-dinghy-feva", "Feva"),
  dsClassFlag("ds-dinghy-europe", "Europe"),
  dsClassFlag("ds-dinghy-ilca", "ILCA"),
  dsClassFlag("ds-dinghy-contender", "Contender"),
  dsClassFlag("ds-dinghy-29er", "29er"),
  dsClassFlag("ds-dinghy-505", "505"),
  dsClassFlag("ds-dinghy-wayfarer", "Wayfarer"),
  dsClassFlag("ds-dinghy-snipe", "Snipe"),
  dsClassFlag("ds-cat-a-cat", "A-cat"),
  dsClassFlag("ds-cat-formula-18", "Formula 18"),
  dsClassFlag("ds-cat-hobie-cat", "Hobie Cat")
];

function dsClassFlag(id, name) {
  return { id, name, dataUrl: `/assets/class-flags/${id}.webp` };
}

// Kapsejladssignaler efter Dansk Sejlunions oversigt (Kapsejladsregler). `stack` = flag der vises over hinanden.
export const RACE_SIGNAL_FLAGS = [
  { id: "general-recall", name: "Første lighedsstander - generel tilbagekaldelse", code: "1. lighedsstander", cssClass: "signal-general-recall" },
  { id: "individual-recall", name: "X - individuel tilbagekaldelse", code: "X", cssClass: "signal-x" },
  { id: "i", name: "I - rundingsregel 30.1", code: "I", cssClass: "signal-i" },
  { id: "black", name: "Sort flag - regel 30.3", code: "Sort", cssClass: "signal-black" },
  { id: "s", name: "S - afkortning af banen", code: "S", cssClass: "signal-s" },
  { id: "c", name: "C - ændring af næste ben", code: "C", cssClass: "signal-c" },
  { id: "red", name: "Rødt flag - mærker holdes om bagbord", code: "Rød", cssClass: "signal-red" },
  { id: "green", name: "Grønt flag - mærker holdes om styrbord", code: "Grøn", cssClass: "signal-green" },
  { id: "m", name: "M - genstanden erstatter mærke", code: "M", cssClass: "signal-m" },
  { id: "y", name: "Y - bær personligt opdriftsmiddel", code: "Y", cssClass: "signal-y" },
  { id: "l", name: "L - på land / kom på prajehold", code: "L", cssClass: "signal-l" },
  { id: "ap", name: "Svarstander - udsættelse", code: "Svarstander", cssClass: "signal-ap" },
  { id: "ap-h", name: "Svarstander over H - udsat, fremtidige signaler i land", code: "Svarstander over H", stack: ["signal-ap", "signal-h"] },
  { id: "ap-a", name: "Svarstander over A - udsat, ikke flere sejladser i dag", code: "Svarstander over A", stack: ["signal-ap", "signal-a"] },
  { id: "n", name: "N - opgivelse", code: "N", cssClass: "signal-n" },
  { id: "n-h", name: "N over H - opgivet, fremtidige signaler i land", code: "N over H", stack: ["signal-n", "signal-h"] },
  { id: "n-a", name: "N over A - opgivet, ikke flere sejladser i dag", code: "N over A", stack: ["signal-n", "signal-a"] },
  { id: "orange", name: "Orange - start/målflag", code: "Orange", cssClass: "signal-orange" },
  { id: "yellow", name: "Gul - accepter straf", code: "Gul", cssClass: "signal-yellow" }
];

export function allClassFlags(customFlags = []) {
  return [
    ...DEFAULT_CLASS_FLAGS,
    ...DS_KEELBOAT_CLASS_FLAGS,
    ...DS_DINGHY_CAT_CLASS_FLAGS,
    ...customFlags.filter((flag) => flag?.id && flag?.name && flag?.dataUrl)
  ];
}

export function classFlagById(id, customFlags = []) {
  return allClassFlags(customFlags).find((flag) => flag.id === id) ?? DEFAULT_CLASS_FLAGS[0];
}

export function raceSignalById(id) {
  return RACE_SIGNAL_FLAGS.find((flag) => flag.id === id) ?? null;
}
