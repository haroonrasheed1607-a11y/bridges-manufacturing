// domain/delivery.js


function manufacturingChallanRows(order) {
  return order.workOrders.map(work => ({
    id: work.id,
    description: work.description || work.type,
    type: work.type,
    quantity: Number(work.quantity || 0),
    perPack: Math.max(1, Number(work.perPack || 1)),
    packs: Math.ceil(Number(work.quantity || 0) / Math.max(1, Number(work.perPack || 1)))
  }));
}

export { manufacturingChallanRows };
