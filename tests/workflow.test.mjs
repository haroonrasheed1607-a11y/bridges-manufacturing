import test from 'node:test';
import assert from 'node:assert/strict';
import { manufacturingDemoData } from '../src/state/demoData.js';
import { manufacturingBoardStage, manufacturingBoardStages, manufacturingNextOrderState, manufacturingTransitionLabel } from '../src/domain/workflow.js';
import { validateWorkOrder } from '../src/domain/validation.js';
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
