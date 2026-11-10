import { groupDayPlans } from '../src/features/plan/dayPlan.js';
import { manufacturingCanEditOrderRequest } from '../src/domain/orders.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { manufacturingDemoData } from '../src/state/demoData.js';
import { manufacturingBoardStage, manufacturingBoardStages, manufacturingNextOrderState, manufacturingTransitionLabel } from '../src/domain/workflow.js';
import { manufacturingBuildWorkOrder, manufacturingCanEditWorkOrder } from '../src/domain/workOrders.js';
import { getStageBlocker, validateWorkOrder } from '../src/domain/validation.js';
import { manufacturingColumnProgress } from '../src/domain/boardProgress.js';
import { manufacturingFindBox, manufacturingCompleteBox } from '../src/domain/production.js';
import { manufacturingChallanRows } from '../src/domain/delivery.js';

test('sample data covers all stages and work-order quantities balance', () => {
  const { orders } = manufacturingDemoData();
  assert.equal(new Set(orders.map(manufacturingBoardStage)).size, manufacturingBoardStages.length);
  for (const order of orders) for (const work of order.workOrders) {
    assert.equal(validateWorkOrder(work), '');
    assert.equal(work.jobs.reduce((total, job) => total + job.quantity, 0), work.quantity);
  }
});

test('existing orders map to the six stages without skipping internal steps', () => {
  const { orders } = manufacturingDemoData();
  const request = orders.find(order => order.stage === 0 && !order.workOrders.length);
  const draft = orders.find(order => order.stage === 0 && order.workOrders.length && !order.workOrderApprovedAt);
  const assigned = orders.find(order => order.stage === 0 && order.assignmentConfirmedAt);
  const approved = manufacturingNextOrderState(draft);
  assert.equal(manufacturingBoardStage(request), 0);
  assert.equal(manufacturingBoardStage(draft), 1);
  assert.equal(manufacturingBoardStage(approved), 1);
  assert.equal(manufacturingBoardStage(assigned), 2);
  assert.equal(manufacturingBoardStage(manufacturingNextOrderState(assigned)), 2);

  for (const [stage, column, label, nextColumn] of [
    [1, 2, 'Move to quality check', 3],
    [2, 3, 'Move to packing', 3],
    [3, 3, 'Move to warehouse', 4],
    [4, 4, 'Move to ready for delivery', 4],
    [5, 4, 'Mark complete', 5],
  ]) {
    const order = orders.find(order => order.stage === stage);
    assert.equal(manufacturingBoardStage(order), column);
    assert.equal(manufacturingTransitionLabel(order), label);
    assert.equal(manufacturingBoardStage(manufacturingNextOrderState(order)), nextColumn);
  }
});

test('quality and packing progress stays pending until the packing check passes', () => {
  const order = { stage: 2, workOrders: [{
    quantity: 10,
    audits: [{ mode: '100% Check', inspector: 'Inspector', inspected: 10, failed: 0 }],
    packing: [],
  }] };
  assert.equal(manufacturingColumnProgress([order], 3).percent, 0);
  const packing = manufacturingNextOrderState(order);
  assert.equal(manufacturingColumnProgress([packing], 3).percent, 0);
  const packed = { ...packing, workOrders: packing.workOrders.map(work => ({
    ...work, packing: [{ correct: true }],
  })) };
  assert.equal(manufacturingColumnProgress([packed], 3).percent, 100);
});

test('order request editing ends as soon as a draft work order exists', () => {
  const request = { stage: 0, workOrders: [] };
  assert.equal(manufacturingCanEditOrderRequest(request), true);
  assert.equal(manufacturingCanEditOrderRequest({ ...request, workOrders: [{ id: 'WO-1' }] }), false);
  assert.equal(manufacturingCanEditOrderRequest({ ...request, stage: 1 }), false);
});

test('quick approval builds a valid full-quantity work order and awaits coach assignment', () => {
  const request = {
    stage: 0, title: 'Package components', quantity: 301, perPack: 25,
    startDate: '2026-11-10', required: '2026-11-16', workOrders: [],
  };
  const { work } = manufacturingBuildWorkOrder(request, {
    id: 'WO-1', type: 'Packaging', description: request.title, instructions: 'Count and seal each box.',
  });
  assert.equal(validateWorkOrder(work), '');
  assert.equal(work.quantity, request.quantity);
  assert.equal(work.perPack, request.perPack);
  assert.equal(work.required, request.required);
  assert.equal(work.totalSeconds, 301 * 30 + 13 * 20);
  assert.equal(work.jobs.reduce((sum, job) => sum + job.quantity, 0), request.quantity);

  const approved = manufacturingNextOrderState({ ...request, workOrders: [work], expected: work.expected });
  assert.ok(approved.workOrderApprovedAt);
  assert.equal(manufacturingBoardStage(approved), 1);
  assert.match(getStageBlocker(approved), /Job Coaches/);
});

test('pre-scan edits preserve sub-job and box references and lock after progress', () => {
  const order = { stage: 1, quantity: 600, perPack: 25, required: '2026-11-16' };
  const existingWork = {
    id: 'WO-1', quantity: 300, perPack: 25, packsPerSubJob: 12, coachId: 'coach-1',
    jobs: [{ id: 'custom-subjob', name: 'Assembly', quantity: 300, completed: 0, packType: 'Box' }],
    boxes: [{ id: 'box-1', jobId: 'custom-subjob', quantity: 25 }],
  };
  assert.equal(manufacturingCanEditWorkOrder(order, existingWork), true);
  const { work } = manufacturingBuildWorkOrder(order, {
    existingWork, id: existingWork.id, type: 'Assembly', description: 'Assemble',
    instructions: 'Check the finished piece.', seconds: 45,
  });
  assert.equal(validateWorkOrder(work), '');
  assert.equal(work.coachId, existingWork.coachId);
  assert.deepEqual(work.boxes, existingWork.boxes);
  assert.equal(work.jobs[0].id, 'custom-subjob');
  assert.equal(work.jobs[0].quantity, 300);
  assert.equal(work.jobs[0].estimatedSeconds, 300 * 45 + 12 * 20);
  assert.equal(manufacturingCanEditWorkOrder(order, { ...work, jobs: [{ ...work.jobs[0], completed: 1 }] }), false);
  assert.equal(manufacturingCanEditWorkOrder(order, { ...work, boxes: [{ ...work.boxes[0], completedAt: '2026-11-10' }] }), false);
  assert.equal(manufacturingCanEditWorkOrder({ ...order, stage: 2 }, work), false);
});

test('replacing a split generates new labels and keeps the work order quantity', () => {
  const order = { stage: 1, required: '2026-11-16' };
  const existingWork = {
    id: 'WO-1', quantity: 51, perPack: 25, coachId: 'coach-1',
    jobs: [{ id: 'WO-1-SJ-001', quantity: 51, completed: 0 }],
    boxes: [{ id: 'old-box', jobId: 'WO-1-SJ-001' }],
  };
  const { work } = manufacturingBuildWorkOrder(order, {
    existingWork, id: existingWork.id, type: 'Packaging', description: 'Pack',
    instructions: 'Seal each box.', replacementPrefix: 'WO-1-FRESH', packsOverride: '1',
  });
  assert.equal(validateWorkOrder(work), '');
  assert.equal(work.replaceSubJobs, true);
  assert.equal(work.id, existingWork.id);
  assert.equal(work.coachId, existingWork.coachId);
  assert.deepEqual(work.boxes, []);
  assert.deepEqual(work.jobs.map(job => job.quantity), [25, 25, 1]);
  assert.ok(work.jobs.every(job => job.id.startsWith('WO-1-FRESH-SJ-')));
  assert.equal(manufacturingCanEditWorkOrder(order, { ...existingWork, hasScans: true }), false);
});

test('printing groups multiple plans for a single sub-job separately', () => {
  const plans = groupDayPlans([
    { id: 'legacy', jobId: 'job', planId: null },
    { id: 'a1', jobId: 'job', planId: 'first' },
    { id: 'a2', jobId: 'job', planId: 'first' },
    { id: 'b1', jobId: 'job', planId: 'second' },
  ]);
  assert.deepEqual(plans.map(plan => plan.labels.map(label => label.id)), [['legacy'], ['a1', 'a2'], ['b1']]);
  assert.equal(new Set(plans.map(plan => plan.key)).size, 3);
});

test('box completion updates pieces once and rejects a second completion', () => {
  const { orders } = manufacturingDemoData();
  const found = manufacturingFindBox(orders, 'demo-box-001');
  const result = manufacturingCompleteBox(found.order, found.box.id, 20);
  assert.equal(result.job.completed, 45);
  assert.ok(manufacturingCompleteBox(result.order, found.box.id, 20).error);
});

test('column progress excludes earlier orders and counts downstream actions', () => {
  const { orders } = manufacturingDemoData();
  const progress = manufacturingColumnProgress(orders, 3);
  assert.equal(progress.pending, 2);
  assert.equal(progress.acted, 3);
  assert.equal(progress.percent, 60);
});

test('challan counts a partially filled final pack', () => {
  const rows = manufacturingChallanRows({ workOrders: [{id:'WO',quantity:51,perPack:25}] });
  assert.equal(rows[0].packs, 3);
  assert.equal(rows[0].quantity, 51);
});
