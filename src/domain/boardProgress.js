// domain/boardProgress.js
import { getStageBlocker } from "./validation.js";
import { manufacturingBoardStage, manufacturingBoardStages } from "./workflow.js";

function manufacturingBoardProgress(order) {
  const jobs = order.workOrders.flatMap(work => work.jobs || []),
    quantity = Number(order.quantity ?? jobs.reduce((sum, job) => sum + job.quantity, 0)),
    completed = jobs.reduce((sum, job) => sum + Number(job.completed || 0), 0);
  return {
    quantity,
    completed,
    percent: quantity > 0 ? Math.min(100, Math.round(completed / quantity * 100)) : 0
  };
}
function manufacturingColumnProgress(orders, column) {
  let pending = 0,
    acted = 0;
  for (const order of orders) {
    const stage = manufacturingBoardStage(order);
    if (stage < column) continue;
    if (stage > column || column === manufacturingBoardStages.length - 1 || stage === column && column >= 4 && !getStageBlocker(order)) acted++;else pending++;
  }
  const total = pending + acted;
  return {
    pending,
    acted,
    total,
    percent: total ? Math.round(acted / total * 100) : 0
  };
}

export { manufacturingBoardProgress, manufacturingColumnProgress };
