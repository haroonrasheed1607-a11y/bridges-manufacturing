export const SUCCESS_DISPLAY_MS = 5000;
export function isDumpingCode(value) {
  return /^(?:DUMP|REUSE)-[A-F0-9]{16}$/i.test(String(value || "").trim());
}
export function isIndividualJobCode(value) {
  return /^IND-[A-F0-9]{16}$/i.test(String(value || "").trim());
}
export function dumpingLabel(assignment, orders, people) {
  const order = orders.find((o) => o.id === assignment.orderId),
    work = order?.workOrders.find((w) => w.id === assignment.workId),
    job = work?.jobs.find((j) => j.id === assignment.jobId),
    person = people.find((p) => p.id === assignment.personId);
  if (!order || !work || !job || !person) return null;
  return {
    order,
    work,
    job: { ...job, name: "REUSE · " + job.name },
    person,
    box: { id: assignment.id, quantity: assignment.batchQuantity },
  };
}
export function scanRequestKey(profileId, code) {
  return "bridges-dump-pending:" + profileId + ":" + code;
}

export function completedLoadPieces(batchQuantity, multiplier, actual = "") {
  const batch = Number(batchQuantity), factor = Number(multiplier);
  const quantity = actual === "" ? batch * factor : Number(actual);
  if (!Number.isInteger(batch) || batch < 1 || ![1, 2].includes(factor) || !Number.isInteger(quantity) || quantity < 1 || quantity > batch * 2) throw new Error("Enter between 1 and two loads of pieces.");
  return quantity;
}
