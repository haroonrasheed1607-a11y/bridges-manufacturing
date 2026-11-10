export function dayPlanKey(label) {
  return label.planId ? label.jobId + "/" + label.planId : label.jobId;
}

export function dayPlanName(plan) {
  return plan.planId ? "Plan " + plan.planId.slice(0, 6).toUpperCase() : "Original plan";
}

export function groupDayPlans(labels) {
  const plans = new Map();
  for (const label of labels) {
    const key = dayPlanKey(label);
    if (!plans.has(key)) plans.set(key, { ...label, key, labels: [] });
    plans.get(key).labels.push(label);
  }
  return [...plans.values()];
}

export function dayPlanLabelIds(plan) {
  return plan.labels.map(label => label.id).sort();
}
