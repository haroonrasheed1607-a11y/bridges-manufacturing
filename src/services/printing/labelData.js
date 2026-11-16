export function labelData({ order, work, job, box, person }, matrix) {
  return {
    matrix,
    person: String(person?.name || "Unassigned"),
    orderTitle: String(order.title || ""),
    orderId: String(order.id || ""),
    workId: String(work.id || ""),
    job: String(job.name || ""),
    quantity: String(box.quantity),
    unit: order.totalBillableUnits != null ? "units" : "pcs",
    boxId: String(box.id),
  };
}
