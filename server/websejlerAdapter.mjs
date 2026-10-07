const CERTIFICATE_URL = "https://websejler.dk/da/certifikat/";

export async function lookupWebSejler(input) {
  const query = String(input?.query ?? input?.certificateUrl ?? input?.certificateNumber ?? "").trim();
  const certificateNumber = extractCertificateNumber(query);

  if (!certificateNumber) {
    return {
      ok: false,
      fallbackRequired: true,
      message: "Indtast et WebSejler-certifikatnummer eller en certifikat-URL.",
      candidates: []
    };
  }

  const sourceUrl = `${CERTIFICATE_URL}${certificateNumber}`;
  try {
    const response = await fetch(sourceUrl, {
      headers: { "user-agent": "Kapsejladsapp MVP local lookup" }
    });
    if (!response.ok) {
      return {
        ok: false,
        fallbackRequired: true,
        message: `WebSejler svarede med status ${response.status}. Brug manuel indtastning.`,
        candidates: []
      };
    }
    const html = await response.text();
    const parsed = parseCertificateHtml(html, sourceUrl, certificateNumber);
    return {
      ok: true,
      fallbackRequired: false,
      sourceUrl,
      candidates: [parsed]
    };
  } catch (error) {
    return {
      ok: false,
      fallbackRequired: true,
      message: `Kunne ikke hente WebSejler-data: ${error.message}`,
      candidates: []
    };
  }
}

export function parseCertificateHtml(html, sourceUrl, certificateNumber) {
  const text = normalizeText(stripHtml(html));
  const rawFields = collectLikelyFields(text);
  const measurement = {
    certificateNumber,
    boatName: pick(rawFields, ["Bådnavn", "Baadnavn", "Boat Name", "Navn"]) ?? findAfter(text, /B[åa]dnavn\s+([A-ZÆØÅ0-9][^\n]{1,60})/i),
    sailNumber: pick(rawFields, ["Sejlnummer", "Sejl nr.", "Sejlnr", "Sail No.", "Sail No"]) ?? findAfter(text, /Sejl(?:nummer|nr\.?)\s+([A-Z]{0,4}\s?\d+[^\n]*)/i),
    boatType: pick(rawFields, ["Bådtype", "Baadtype", "Class", "Klasse", "Type"]),
    skipper: pick(rawFields, ["Skipper", "Owner", "Ejer", "Rorsmand"]),
    club: pick(rawFields, ["Klub", "Club", "Sejlklub"]),
    validUntil: pick(rawFields, ["Gyldig til", "Gyldighed", "Udløbsdato", "Not valid after"]),
    gph: numberFrom(rawFields, "GPH"),
    tcc: numberFrom(rawFields, "TCC"),
    tacil: numberFrom(rawFields, "TACIL"),
    tacim: numberFrom(rawFields, "TACIM"),
    tacih: numberFrom(rawFields, "TACIH"),
    taudl: numberFrom(rawFields, "TAUDL"),
    taudm: numberFrom(rawFields, "TAUDM"),
    taudh: numberFrom(rawFields, "TAUDH"),
    raw: {
      fields: rawFields,
      textSample: text.slice(0, 4000)
    },
    sourceUrl
  };

  return {
    boatName: measurement.boatName ?? "",
    sailNumber: measurement.sailNumber ?? "",
    boatType: measurement.boatType ?? "",
    skipper: measurement.skipper ?? "",
    club: measurement.club ?? "",
    handicap: measurement.tcc ? Math.round(measurement.tcc * 10000) / 100 : null,
    certificate: measurement
  };
}

function extractCertificateNumber(value) {
  const match = String(value).match(/certifikat\/(\d+)|^(\d+)$/i);
  return match?.[1] ?? match?.[2] ?? null;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(tr|p|div|li|h\d|section|article|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&aring;/g, "å")
    .replace(/&aelig;/g, "æ")
    .replace(/&oslash;/g, "ø")
    .replace(/&#230;/g, "æ")
    .replace(/&#248;/g, "ø")
    .replace(/&#229;/g, "å");
}

function normalizeText(value) {
  return value
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function collectLikelyFields(text) {
  const labels = [
    "Bådnavn",
    "Baadnavn",
    "Boat Name",
    "Navn",
    "Sejlnummer",
    "Sejl nr.",
    "Bådtype",
    "Baadtype",
    "Sail No.",
    "Sail No",
    "Certificate No.",
    "Issued on",
    "Not valid after",
    "Class",
    "Klasse",
    "Type",
    "Skipper",
    "Owner",
    "Ejer",
    "Rorsmand",
    "Klub",
    "Club",
    "Sejlklub",
    "Gyldig til",
    "Gyldighed",
    "Udløbsdato",
    "GPH",
    "TCC",
    "TACIL",
    "TACIM",
    "TACIH",
    "TAUDL",
    "TAUDM",
    "TAUDH"
  ];
  const fields = {};
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const label = labels.find((candidate) => sameLabel(candidate, lines[index]));
    if (label && !fields[label]) {
      const value = lines[index + 1]?.trim();
      if (value && !labels.some((candidate) => sameLabel(candidate, value))) fields[label] = value;
    }
  }
  const compact = text.replace(/\n/g, " | ");
  for (const label of labels) {
    if (fields[label]) continue;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextLabels = labels.filter((candidate) => candidate !== label).map((candidate) => candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const pattern = new RegExp(`${escaped}\\s*:?\\s*([^|]{1,100}?)(?=\\s+(?:${nextLabels})\\s*:?|\\s*\\||$)`, "i");
    const match = compact.match(pattern);
    if (match?.[1]) fields[label] = match[1].trim();
  }
  return fields;
}

function sameLabel(expected, actual) {
  return normalizeLabel(expected) === normalizeLabel(actual);
}

function normalizeLabel(value) {
  return String(value).toLowerCase().replaceAll(".", "").replace(/\s+/g, " ").trim();
}

function pick(fields, names) {
  for (const name of names) {
    const value = cleanValue(fields[name]);
    if (value) return value;
  }
  return null;
}

function cleanValue(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned && cleaned !== "*" ? cleaned : null;
}

function numberFrom(fields, name) {
  const value = fields[name];
  if (!value) return null;
  const match = String(value).match(/\d+(?:[,.]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function findAfter(text, pattern) {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}
