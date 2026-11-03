// state/legacyData.js


var createLegacyWorkOrder = (e, t, n, r) => ({
  id: e,
  type: t,
  quantity: n,
  perPack: 25,
  description: t === `Assembly` ? `Assemble component sets` : `Pack finished component sets`,
  instructions: `1. Verify the parts against the job sheet.
2. Complete the work using the approved sample.
3. Count the finished pieces and keep each pack together.`,
  people: 4,
  seconds: 30,
  expected: `2026-11-05`,
  required: `2026-11-06`,
  jobs: [{
    id: e + `-A`,
    name: `Batch A`,
    quantity: n,
    completed: r > 1 ? n : 0,
    packType: `Box`
  }],
  audits: r > 2 ? [{
    id: e + `-QC`,
    mode: `Random Audit`,
    inspected: 20,
    failed: 0,
    inspector: `Sample checker`,
    at: `2026-10-29T15:00:00Z`,
    notes: `Sample record`
  }] : [],
  packing: r > 3 ? [{
    id: e + `-PK`,
    correct: !0,
    checker: `Sample packer`,
    at: `2026-10-29T16:00:00Z`,
    notes: ``
  }] : []
});
function createLegacyOrders() {
  return [{
    id: `ORD-1001`,
    customer: `Sample Customer A`,
    title: `Component assembly`,
    expected: `2026-11-05`,
    required: `2026-11-06`,
    stage: 1,
    workOrders: [createLegacyWorkOrder(`WO-1001`, `Assembly`, 200, 1)],
    history: []
  }, {
    id: `ORD-1002`,
    customer: `Sample Customer B`,
    title: `Packet preparation`,
    expected: `2026-11-03`,
    required: `2026-11-04`,
    stage: 2,
    workOrders: [{
      ...createLegacyWorkOrder(`WO-1002`, `Packing`, 100, 2),
      jobs: [{
        id: `WO-1002-A`,
        name: `Packet batch`,
        quantity: 100,
        completed: 100,
        packType: `Packet`
      }]
    }],
    history: []
  }, {
    id: `ORD-1003`,
    customer: `Sample Customer C`,
    title: `Boxed component sets`,
    expected: `2026-11-02`,
    required: `2026-11-03`,
    stage: 4,
    workOrders: [createLegacyWorkOrder(`WO-1003`, `Assembly`, 150, 4)],
    history: []
  }];
}

export { createLegacyWorkOrder, createLegacyOrders };
