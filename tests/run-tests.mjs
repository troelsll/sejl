import assert from "node:assert/strict";
import { buildResults, calculateCorrectedSeconds, secondsBetween } from "../shared/calculations.mjs";
import { formatDuration, getActiveFlags, getProcedureState } from "../shared/startProcedure.mjs";
import { DS_DINGHY_CAT_CLASS_FLAGS, DS_KEELBOAT_CLASS_FLAGS, RACE_SIGNAL_FLAGS, allClassFlags, raceSignalById } from "../shared/flags.mjs";
import { parseCertificateHtml } from "../server/websejlerAdapter.mjs";

const tests = [];

test("5-minutters procedure finder korrekt signal", () => {
  const atFourMinutes = getProcedureState(240, "five-minute");
  assert.equal(atFourMinutes.dueSignal.signalName, "Klar");
  assert.equal(atFourMinutes.currentPhase, "Klarsignal");

  const atStart = getProcedureState(0, "five-minute");
  assert.equal(atStart.dueSignal.signalName, "Start");
  assert.equal(atStart.currentPhase, "Startet");
});

test("5-minutters procedure viser korrekte aktive signalflag", () => {
  assert.deepEqual(getActiveFlags(300, { warningFlagType: "class" }).map((flag) => flag.id), ["class-a"]);
  assert.deepEqual(getActiveFlags(240, { warningFlagType: "class" }).map((flag) => flag.id), ["class-a", "prep-p"]);
  assert.deepEqual(getActiveFlags(60, { warningFlagType: "class" }).map((flag) => flag.id), ["class-a"]);
  assert.deepEqual(getActiveFlags(0, { warningFlagType: "class" }).map((flag) => flag.id), []);
  assert.deepEqual(getActiveFlags(300, { warningFlagType: "number", warningFlagNumber: 3 }).map((flag) => flag.id), ["number-3"]);
});

test("dommersignaler indeholder de manuelle startside-signaler", () => {
  const ids = RACE_SIGNAL_FLAGS.map((flag) => flag.id);
  assert.ok(ids.includes("general-recall"));
  assert.ok(ids.includes("individual-recall"));
  assert.ok(ids.includes("course-side"));
  assert.ok(ids.includes("ap"));
  assert.equal(raceSignalById("h").name, "H - fremtidige signaler i land");
});

test("Dansk Sejlunion-klasseflag er tilgængelige som klassestandere", () => {
  const ids = allClassFlags().map((flag) => flag.id);
  assert.equal(DS_KEELBOAT_CLASS_FLAGS.length, 15);
  assert.equal(DS_DINGHY_CAT_CLASS_FLAGS.length, 14);
  assert.ok(DS_KEELBOAT_CLASS_FLAGS.every((flag) => flag.dataUrl?.startsWith("/assets/class-flags/")));
  assert.ok(DS_KEELBOAT_CLASS_FLAGS.every((flag) => !flag.cssClass));
  assert.ok(DS_DINGHY_CAT_CLASS_FLAGS.every((flag) => flag.dataUrl?.startsWith("/assets/class-flags/")));
  assert.ok(DS_DINGHY_CAT_CLASS_FLAGS.every((flag) => !flag.cssClass));
  assert.ok(ids.includes("ds-keel-j70"));
  assert.ok(ids.includes("ds-keel-x-99"));
  assert.ok(ids.includes("ds-dinghy-optimist"));
  assert.ok(ids.includes("ds-dinghy-ilca"));
  assert.ok(ids.includes("ds-cat-formula-18"));
});

test("formatDuration formatterer tid til dommervisning", () => {
  assert.equal(formatDuration(300), "5:00");
  assert.equal(formatDuration(3723), "1:02:03");
});

test("sejlet tid beregnes fra start og målgang", () => {
  assert.equal(secondsBetween("2026-06-04T17:00:00.000Z", "2026-06-04T18:13:22.000Z"), 4402);
});

test("korrigeret tid bruger TCC før fallback", () => {
  assert.equal(calculateCorrectedSeconds(3600, { tcc: 0.9, handicap: 100 }), 3240);
  assert.equal(calculateCorrectedSeconds(3600, { handicap: 95 }), 3420);
});

test("resultater sorteres efter korrigeret tid", () => {
  const start = { actualStartTime: "2026-06-04T17:00:00.000Z" };
  const boats = [
    { id: "a", boatName: "A", sailNumber: "DEN 1", skipper: "A", club: "AS", handicap: 100, certificate: { tcc: 1 } },
    { id: "b", boatName: "B", sailNumber: "DEN 2", skipper: "B", club: "AS", handicap: 100, certificate: { tcc: 0.8 } }
  ];
  const finishes = [
    { boatId: "a", finishedAt: "2026-06-04T18:00:00.000Z", isDeleted: false },
    { boatId: "b", finishedAt: "2026-06-04T18:10:00.000Z", isDeleted: false }
  ];
  const results = buildResults(start, boats, finishes);
  assert.equal(results[0].boatName, "B");
  assert.equal(results[0].rank, 1);
});

test("WebSejler-parser normaliserer kendte certifikatfelter", () => {
  const html = `
    <html><body>
      <h1>Målebrev</h1>
      <table>
        <tr><td>Bådnavn</td><td>Freja</td></tr>
        <tr><td>Sejlnummer</td><td>DEN 35114</td></tr>
        <tr><td>Bådtype</td><td>First 36.7</td></tr>
        <tr><td>Skipper</td><td>Anne Kirk</td></tr>
        <tr><td>Klub</td><td>Aalborg Sejlklub</td></tr>
        <tr><td>TCC</td><td>0,948</td></tr>
        <tr><td>GPH</td><td>612,4</td></tr>
        <tr><td>TACIL</td><td>0,812</td></tr>
      </table>
    </body></html>
  `;
  const parsed = parseCertificateHtml(html, "https://websejler.dk/da/certifikat/35114", "35114");
  assert.equal(parsed.boatName, "Freja");
  assert.equal(parsed.sailNumber, "DEN 35114");
  assert.equal(parsed.certificate.tcc, 0.948);
  assert.equal(parsed.certificate.gph, 612.4);
  assert.equal(parsed.certificate.tacil, 0.812);
});

test("WebSejler-parser håndterer engelsk certifikatformat", () => {
  const html = `
    <html><body>
      <h1>Målebrev - CROWN 39 DEN 6</h1>
      Certificate No.
      35114
      Issued on
      21-04-2026
      Class
      CROWN 39
      Not valid after
      31-12-2026
      Sail No.
      DEN 6
      Club
      Aalborg Sejlklub
      Boat Name
      White Beam
      Ratings
      GPH
      563,6
      TCC
      1,182
      TACIL
      702,2
      TAUDH
      597,6
    </body></html>
  `;
  const parsed = parseCertificateHtml(html, "https://websejler.dk/da/certifikat/35114", "35114");
  assert.equal(parsed.boatName, "White Beam");
  assert.equal(parsed.sailNumber, "DEN 6");
  assert.equal(parsed.boatType, "CROWN 39");
  assert.equal(parsed.club, "Aalborg Sejlklub");
  assert.equal(parsed.certificate.validUntil, "31-12-2026");
  assert.equal(parsed.certificate.tcc, 1.182);
  assert.equal(parsed.certificate.taudh, 597.6);
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`${tests.length} tests bestået.`);

function test(name, fn) {
  tests.push({ name, fn });
}
