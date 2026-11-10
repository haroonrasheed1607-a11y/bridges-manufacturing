// domain/workflow.js
import { getStageBlocker } from "./validation.js";
import { manufacturingIsCoach } from "./workforce.js";

const manufacturingBoardStages = ['Order Requests', 'Work Orders', 'Plan Production', 'Quality Check & Packing', 'Warehouse & Ready for Delivery', 'Mark Complete'];
const boardStageByOrderStage = [0, 2, 3, 3, 4, 4, 5];
const orderSteps = ['', 'In production', 'Quality check', 'Packing', 'Warehouse', 'Ready for delivery', 'Completion'];

function manufacturingBoardStage(order) {
  if (order.stage !== 0) return boardStageByOrderStage[order.stage];
  if (order.assignmentConfirmedAt) return 2;
  return order.workOrderApprovedAt || order.workOrders.length ? 1 : 0;
}

function manufacturingOrderStep(order) {
  if (order.stage !== 0) return orderSteps[order.stage];
  if (order.assignmentConfirmedAt) return 'Start production';
  if (order.workOrderApprovedAt) return 'Assign Job Coaches';
  return order.workOrders.length ? 'Prepare work orders' : 'Order request';
}
function manufacturingNextOrderState(order) {
  return order.stage === 0 && !order.workOrderApprovedAt ? {
    ...order,
    workOrderApprovedAt: new Date().toISOString()
  } : {
    ...order,
    stage: order.stage + 1,
    ...(order.stage === 0 ? {
      productionStartedAt: new Date().toISOString()
    } : {})
  };
}
function manufacturingTransitionLabel(order) {
  if (order.stage === 0) {
    if (!order.workOrderApprovedAt) return 'Approve work orders';
    return order.assignmentConfirmedAt ? 'Start production' : 'Confirm assignments';
  }
  return ['', 'Move to quality check', 'Move to packing', 'Move to warehouse', 'Move to ready for delivery', 'Mark complete'][order.stage];
}
function manufacturingWorkflowBlock(order, workforce) {
  const rule = getStageBlocker(order);
  if (rule) return rule;
  if (order.stage === 0 && order.assignmentConfirmedAt && !order.workOrders.every(work => workforce.people.some(person => person.id === work.coachId && manufacturingIsCoach(person)))) return 'Assign a Job Coach to every work order before starting production.';
  return '';
}

export { manufacturingBoardStages, manufacturingBoardStage, manufacturingOrderStep, manufacturingNextOrderState, manufacturingTransitionLabel, manufacturingWorkflowBlock };
