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

export const RACE_SIGNAL_FLAGS = [
  { id: "general-recall", name: "Generel tilbagekaldelse", code: "1. substitute", cssClass: "signal-general-recall" },
  { id: "individual-recall", name: "Individuel tilbagekaldelse", code: "X", cssClass: "signal-x" },
  { id: "course-side", name: "Båd på banesiden", code: "V", cssClass: "signal-v" },
  { id: "c", name: "C - baneændring", code: "C", cssClass: "signal-c" },
  { id: "s", name: "S - afkortet bane", code: "S", cssClass: "signal-s" },
  { id: "m", name: "M - mærke erstattet", code: "M", cssClass: "signal-m" },
  { id: "b", name: "B - mærke til bagbord", code: "B", cssClass: "signal-b" },
  { id: "green", name: "Grøn - mærke til styrbord", code: "Grøn", cssClass: "signal-green" },
  { id: "orange", name: "Orange - start/målflag", code: "Orange", cssClass: "signal-orange" },
  { id: "y", name: "Y - redningsvest påbudt", code: "Y", cssClass: "signal-y" },
  { id: "l", name: "L - kom på prajehold", code: "L", cssClass: "signal-l" },
  { id: "yellow", name: "Gul - accepter straf", code: "Gul", cssClass: "signal-yellow" },
  { id: "n", name: "N - opgivet", code: "N", cssClass: "signal-n" },
  { id: "ap", name: "AP - udsættelse", code: "AP", cssClass: "signal-ap" },
  { id: "a", name: "A - ikke flere sejladser i dag", code: "A", cssClass: "signal-a" },
  { id: "h", name: "H - fremtidige signaler i land", code: "H", cssClass: "signal-h" }
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
