import { remainingBoxPieces } from "./boxSetupModel.js";
export function bulkBoxPlan(work, job, personIds) {
  const ids = [...new Set(personIds)];
  const pack = Number(work.perPack);
  let remaining = remainingBoxPieces(work, job);
  if (!ids.length || ids.length > 100) throw Error("Select 1–100 individuals.");
  if (!Number.isSafeInteger(pack) || pack < 1)
    throw Error("Set a valid pieces-per-pack value on the work order.");
  if (ids.length > Math.ceil(remaining / pack))
    throw Error("Not enough unallocated pieces for every selected individual.");
  return ids.map((personId) => {
    const quantity = Math.min(pack, remaining);
    remaining -= quantity;
    return { personId, quantity };
  });
}

export function datedBulkBoxPlan(work, job, personIds, date) {
  const day = new Date(String(date) + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) ||
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== date
  )
    throw Error("Select a valid work date.");
  if ([0, 6].includes(day.getUTCDay()))
    throw Error("Choose a working day (Monday–Friday).");
  return bulkBoxPlan(work, job, personIds).map((item) => ({ ...item, date }));
}
