export function groupDayPlans(labels) {
  const plans = new Map();
  for (const label of labels) {
    if (!plans.has(label.jobId)) plans.set(label.jobId, { ...label, labels: [] });
    plans.get(label.jobId).labels.push(label);
  }
  return [...plans.values()];
}

export function dayPlanLabelIds(plan) {
  return plan.labels.map(label => label.id).sort();
}
