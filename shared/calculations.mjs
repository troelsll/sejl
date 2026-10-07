export function secondsBetween(startIso, finishIso) {
  if (!startIso || !finishIso) return null;
  const start = new Date(startIso).getTime();
  const finish = new Date(finishIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(finish)) return null;
  return Math.max(0, Math.round((finish - start) / 1000));
}

export function calculateCorrectedSeconds(elapsedSeconds, measurement = {}) {
  if (elapsedSeconds == null) return null;
  const tcc = parseNumber(measurement.tcc);
  if (tcc) return Math.round(elapsedSeconds * tcc);

  const handicap = parseNumber(measurement.handicap);
  if (handicap) {
    // TODO: Replace this placeholder with the validated Danish DH formula.
    // MVP assumption: lower handicap means a faster boat and therefore a larger correction.
    return Math.round(elapsedSeconds * (handicap / 100));
  }

  return elapsedSeconds;
}

export function buildResults(start, boats, finishRecords) {
  const activeFinishes = finishRecords.filter((finish) => !finish.isDeleted);
  const results = activeFinishes
    .map((finish) => {
      const boat = boats.find((candidate) => candidate.id === finish.boatId);
      if (!boat) return null;
      const startTime = start.actualStartTime || start.scheduledStartTime;
      const elapsedSeconds = secondsBetween(startTime, finish.finishedAt);
      const correctedSeconds = calculateCorrectedSeconds(elapsedSeconds, {
        tcc: boat.certificate?.tcc,
        handicap: boat.handicap
      });
      return {
        boatId: boat.id,
        boatName: boat.boatName,
        sailNumber: boat.sailNumber,
        skipper: boat.skipper,
        club: boat.club,
        startTime,
        finishTime: finish.finishedAt,
        elapsedSeconds,
        handicap: boat.handicap,
        tcc: boat.certificate?.tcc ?? null,
        correctedSeconds,
        method: boat.certificate?.tcc ? "TCC foreløbig" : "Placeholder måltal"
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.correctedSeconds ?? Infinity) - (b.correctedSeconds ?? Infinity));

  return results.map((result, index) => ({ ...result, rank: index + 1 }));
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
