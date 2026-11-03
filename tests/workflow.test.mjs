import test from 'node:test';
import assert from 'node:assert/strict';
import { manufacturingDemoData } from '../src/state/demoData.js';
import { manufacturingBoardStage } from '../src/domain/workflow.js';
import { validateWorkOrder } from '../src/domain/validation.js';
import { manufacturingColumnProgress } from '../src/domain/boardProgress.js';
import { manufacturingFindBox, manufacturingCompleteBox } from '../src/domain/production.js';
import { manufacturingChallanRows } from '../src/domain/delivery.js';

test('sample data covers all stages and work-order quantities balance', () => {
  const { orders } = manufacturingDemoData();
  assert.equal(new Set(orders.map(manufacturingBoardStage)).size, 10);
  for (const order of orders) for (const work of order.workOrders) {
    assert.equal(validateWorkOrder(work), '');
    assert.equal(work.jobs.reduce((total, job) => total + job.quantity, 0), work.quantity);
  }
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
  const progress = manufacturingColumnProgress(orders, 5);
  assert.equal(progress.pending, 1);
  assert.equal(progress.acted, 4);
  assert.equal(progress.percent, 80);
});

test('challan counts a partially filled final pack', () => {
  const rows = manufacturingChallanRows({ workOrders: [{id:'WO',quantity:51,perPack:25}] });
  assert.equal(rows[0].packs, 3);
  assert.equal(rows[0].quantity, 51);
});
