// domain/production.js


function manufacturingFindBox(orders, code) {
  const value = String(code || '').trim().toUpperCase();
  for (const order of orders) for (const work of order.workOrders) for (const box of work.boxes || []) if (box.id.toUpperCase() === value) return {
    order,
    work,
    box,
    job: work.jobs.find(job => job.id === box.jobId)
  };
  return null;
}
function manufacturingCompleteBox(order, boxId, pieces, at = new Date().toISOString()) {
  const found = manufacturingFindBox([order], boxId);
  if (!found) return {
    error: 'Box code not found.'
  };
  const {
    work,
    box,
    job
  } = found;
  if (box.completedAt || box.status === 'completed') return {
    error: 'This box is already completed.'
  };
  if (order.stage !== 1) return {
    error: 'This order is not currently in production.'
  };
  if (!job) return {
    error: 'The sub-job for this box could not be found.'
  };
  if (!Number.isSafeInteger(pieces) || pieces < 0 || pieces > box.quantity) return {
    error: 'Completed pieces must be a whole number from 0 to ' + box.quantity + '.'
  };
  const previousBoxTotal = (work.boxes || []).filter(item => item.jobId === job.id && (item.completedAt || item.status === 'completed')).reduce((sum, item) => sum + Number(item.completedPieces ?? item.quantity), 0),
    baseline = Math.max(0, Number(job.completed || 0) - previousBoxTotal),
    nextCompleted = baseline + previousBoxTotal + pieces;
  if (nextCompleted > job.quantity) return {
    error: 'This would exceed the sub-job quantity. Review its existing completed-piece count.'
  };
  const updatedBox = {
      ...box,
      status: 'completed',
      completedPieces: pieces,
      completedAt: at
    },
    nextWork = {
      ...work,
      boxes: work.boxes.map(item => item.id === box.id ? updatedBox : item),
      jobs: work.jobs.map(item => item.id === job.id ? {
        ...item,
        completed: nextCompleted
      } : item)
    };
  return {
    order: {
      ...order,
      workOrders: order.workOrders.map(item => item.id === work.id ? nextWork : item)
    },
    box: updatedBox,
    job: {
      ...job,
      completed: nextCompleted
    },
    work: nextWork
  };
}

export { manufacturingFindBox, manufacturingCompleteBox };
