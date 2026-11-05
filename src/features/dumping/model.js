export const DUMPING_COOLDOWN_MS = 5000;
export function isDumpingCode(value) {
  return /^DUMP-[A-F0-9]{16}$/i.test(String(value || "").trim());
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
