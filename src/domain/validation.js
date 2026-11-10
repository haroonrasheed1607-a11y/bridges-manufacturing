// domain/validation.js


function buildPackRecords(e, t) {
  return !Number.isSafeInteger(e.quantity) || e.quantity < 1 || !Number.isSafeInteger(t) || t < 1 ? [] : Array.from({
    length: Math.ceil(e.quantity / t)
  }, (n, r) => ({
    id: `${e.id}-${String(r + 1).padStart(3, `0`)}`,
    type: e.packType,
    pieces: Math.min(t, e.quantity - r * t)
  }));
}
var getOrderPackRecords = e => e.workOrders.flatMap(e => e.jobs.flatMap(t => buildPackRecords(t, e.perPack).map(n => ({
  ...n,
  workOrder: e.id,
  job: t.name
}))));
function validateWorkOrder(e) {
  if (!Number.isFinite(Number(e.packSeconds ?? 0)) || Number(e.packSeconds ?? 0) < 0 || !Number.isFinite(Number(e.packageSeconds ?? 0)) || Number(e.packageSeconds ?? 0) < 0) return `Packing times must be zero or greater.`;
  return [`Assembly`, `Packing`, `Packaging`].includes(e.type) ? !e.description.trim() || !e.instructions.trim() ? `Description and instructions are required.` : [e.quantity, e.perPack, e.people].every(e => Number.isSafeInteger(e) && e > 0) ? e.quantity > 1e6 || e.perPack > 1e6 ? `The screen draft supports up to 1,000,000 pieces per work order.` : !Number.isFinite(e.seconds) || e.seconds <= 0 ? `Time per piece must be greater than zero.` : !e.expected || !e.required ? `Both delivery dates are required.` : !e.jobs.length || e.jobs.some(e => !e.name.trim() || !Number.isSafeInteger(e.quantity) || e.quantity < 1 || ![`Box`, `Packet`].includes(e.packType)) ? `Each sub-job needs a name, positive whole quantity and pack type.` : e.jobs.reduce((e, t) => e + t.quantity, 0) === e.quantity ? `` : `Sub-job pieces must add up to the work-order quantity.` : `Pieces, pieces per pack and people must be positive whole numbers.` : `Choose Assembly or Packing.`;
}
function validateQualityCheck(e, t) {
  return [`Random Audit`, `100% Check`].includes(e.mode) ? e.inspector?.trim() ? !Number.isInteger(e.inspected) || e.inspected < 1 || e.inspected > t.quantity ? `Inspected pieces must be between 1 and the work-order quantity.` : !Number.isInteger(e.failed) || e.failed < 0 || e.failed > e.inspected ? `Failed pieces must be between zero and the inspected quantity.` : e.mode === `100% Check` && e.inspected !== t.quantity ? `A 100% check must inspect every piece.` : `` : `Enter the inspector name.` : `Choose a check method.`;
}
function getStageBlocker(e) {
  let t = e.workOrders;
  switch (e.stage) {
    case 0:
      if (!t.length) return `Add at least one work order.`;
      if (e.quantity != null && t.reduce((total, work) => total + work.quantity, 0) !== Number(e.quantity)) {
        return `Allocate the full order quantity across the work orders before approval.`;
      }
      return t.map(validateWorkOrder).find(Boolean) || (e.workOrderApprovedAt && !e.assignmentConfirmedAt ? `Assign Job Coaches to every work order and confirm assignments.` : ``);
    case 1:
      return t.some(e => e.jobs.some(e => e.completed !== e.quantity)) ? `Complete every sub-job before quality checking.` : ``;
    case 2:
      return t.some(e => !e.audits.length || validateQualityCheck(e.audits.at(-1), e) || e.audits.at(-1).failed > 0) ? `Each work order needs a passing quality check.` : ``;
    case 3:
      return t.some(e => !e.packing.length || !e.packing.at(-1).correct) ? `Confirm correct packing for every work order.` : ``;
    case 4:
      return e.warehouse?.receivedAt ? `` : `Confirm receipt into the warehouse.`;
    case 5:
      return e.delivery?.dispatchedAt ? e.delivery?.signature ? `` : `The customer must sign before this order can be completed.` : `Approve and dispatch the delivery first.`;
    default:
      return `This order is completed.`;
  }
}

export { buildPackRecords, getOrderPackRecords, validateWorkOrder, validateQualityCheck, getStageBlocker };
