// domain/workOrders.js
import { manufacturingOrderPlan } from "./orders.js";
import { manufacturingToday } from "../utils/dates.js";

function manufacturingWorkSeconds(work) {
  const quantity = Number(work.quantity || 0),
    perPack = Math.max(1, Number(work.perPack || 1)),
    seconds = Number(work.seconds || 0),
    packSeconds = Number(work.packSeconds || 0);
  return work.timingVersion === 2 ? quantity * seconds + Math.ceil(quantity / perPack) * packSeconds : quantity * (seconds + packSeconds) + Math.ceil(quantity / perPack) * Number(work.packageSeconds || 0);
}
function manufacturingWorkDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' h' + (minutes % 60 ? ' ' + minutes % 60 + ' min' : '');
}
function manufacturingSuggestedPacks(work) {
  const totalPacks = Math.ceil(Number(work.quantity || 0) / Math.max(1, Number(work.perPack || 1))),
    packTime = manufacturingWorkSeconds({
      ...work,
      quantity: Number(work.perPack || 1)
    }),
    target = Number(work.hoursPerDay || 6) * 1800;
  return totalPacks > 0 && packTime > 0 && Number.isFinite(packTime) ? Math.min(totalPacks, Math.max(1, Math.floor(target / packTime))) : 1;
}
function manufacturingAutoSubJobs(work) {
  const quantity = Number(work.quantity),
    perPack = Number(work.perPack),
    targetSeconds = Number(work.hoursPerDay || 6) * 1800,
    fullPackSeconds = manufacturingWorkSeconds({
      ...work,
      quantity: perPack
    });
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(perPack) || perPack < 1 || !Number.isFinite(fullPackSeconds) || fullPackSeconds <= 0 || targetSeconds <= 0) return [];
  const packsPerJob = Number(work.packsPerSubJob ?? manufacturingSuggestedPacks(work));
  if (!Number.isSafeInteger(packsPerJob) || packsPerJob < 1) return [];
  const piecesPerJob = packsPerJob * perPack,
    jobs = [];
  for (let remaining = quantity, index = 1; remaining > 0; index++) {
    const pieces = Math.min(piecesPerJob, remaining);
    jobs.push({
      id: work.id + '-SJ-' + String(index).padStart(3, '0'),
      name: 'Sub-job ' + String(index).padStart(2, '0'),
      quantity: pieces,
      completed: 0,
      packType: 'Box',
      targetSeconds,
      estimatedSeconds: manufacturingWorkSeconds({
        ...work,
        quantity: pieces
      })
    });
    remaining -= pieces;
  }
  return jobs;
}
function manufacturingCanEditWorkOrder(order, work) {
  return order.stage < 2 &&
    !work.jobs.some(job => Number(job.completed) > 0) &&
    !(work.boxes || []).some(box => box.completedAt || box.status === 'completed');
}

function manufacturingBuildWorkOrder(order, {
  id, type, description, instructions, parts = [],
  seconds = Number(order.seconds ?? 30), packSeconds = 20,
  hoursPerDay = Number(order.hoursPerDay ?? 6),
  startDate = order.startDate || manufacturingToday(),
  required = order.required, existingWork, assignedPeople = '', packsOverride = null,
}) {
  const { quantity, perPack, packCount } = manufacturingOrderPlan(existingWork ?? order);
  const totalSeconds = manufacturingWorkSeconds({
    quantity, perPack, seconds, packSeconds, timingVersion: 2,
  });
  const plan = manufacturingOrderPlan({
    ...order, quantity, perPack,
    seconds: quantity ? totalSeconds / quantity : seconds,
    hoursPerDay, startDate, required, assignedPeople,
  });
  const work = {
    ...existingWork,
    id, type, description, instructions, parts: type === 'Assembly' ? parts : [],
    timingVersion: 2, quantity, perPack, packCount, seconds, packSeconds,
    packageSeconds: seconds * perPack + packSeconds,
    hoursPerDay, startDate, required, expected: plan.expected,
    people: plan.people, recommendedPeople: plan.recommendedPeople,
    assignedPeople: assignedPeople || null, totalSeconds,
    audits: existingWork?.audits ?? [], packing: existingWork?.packing ?? [],
  };
  const suggestedPacks = manufacturingSuggestedPacks(work);
  const packsPerSubJob = existingWork
    ? existingWork.packsPerSubJob
    : packsOverride === null ? suggestedPacks : Number(packsOverride);
  return {
    suggestedPacks,
    work: {
      ...work,
      packsPerSubJob,
      jobs: existingWork
        ? existingWork.jobs.map(job => ({
          ...job,
          targetSeconds: hoursPerDay * 1800,
          estimatedSeconds: manufacturingWorkSeconds({ ...work, quantity: job.quantity }),
        }))
        : manufacturingAutoSubJobs({ ...work, packsPerSubJob }),
    },
  };
}
function manufacturingDefaultParts() {
  return [{
    id: 'bolt',
    name: 'Bolt',
    kind: 'bolt',
    image: ''
  }, {
    id: 'washer',
    name: 'Washer',
    kind: 'washer',
    image: ''
  }, {
    id: 'nut',
    name: 'Nut',
    kind: 'nut',
    image: ''
  }];
}

export { manufacturingWorkSeconds, manufacturingWorkDuration, manufacturingSuggestedPacks, manufacturingAutoSubJobs, manufacturingBuildWorkOrder, manufacturingCanEditWorkOrder, manufacturingDefaultParts };
