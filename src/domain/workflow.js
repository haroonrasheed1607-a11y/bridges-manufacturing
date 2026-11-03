// domain/workflow.js
import { getStageBlocker } from "./validation.js";
import { manufacturingIsCoach } from "./workforce.js";

var legacyStageLabels = [`New Order`, `Work Order`, `Quality Check`, `Packing`, `Warehouse`, `Delivery`, `Order Completion`];
var manufacturingBoardStages = ['New Orders', 'Work Orders', 'Assign Work Order', 'Start Production', 'In Production', 'Quality Check', 'Packing', 'Warehouse', 'Delivery', 'Order Completion'];
function manufacturingBoardStage(order) {
  return order.stage === 0 ? order.assignmentConfirmedAt ? 3 : order.workOrderApprovedAt ? 2 : order.workOrders.length ? 1 : 0 : order.stage + 3;
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
  return order.stage === 0 ? !order.workOrderApprovedAt ? 'Assign Work Order' : !order.assignmentConfirmedAt ? 'Confirm assignments' : 'Start Production' : order.stage === 5 ? 'Complete order' : 'Move to ' + manufacturingBoardStages[manufacturingBoardStage(order) + 1];
}
function manufacturingWorkflowBlock(order, workforce) {
  const rule = getStageBlocker(order);
  if (rule) return rule;
  if (order.stage === 0 && order.assignmentConfirmedAt && !order.workOrders.every(work => workforce.people.some(person => person.id === work.coachId && manufacturingIsCoach(person)))) return 'Assign a Job Coach to every work order before starting production.';
  return '';
}

export { legacyStageLabels, manufacturingBoardStages, manufacturingBoardStage, manufacturingNextOrderState, manufacturingTransitionLabel, manufacturingWorkflowBlock };
