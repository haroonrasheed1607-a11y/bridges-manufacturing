const creationDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago",
});

export function planningWorkDetails(work) {
  const date = work.createdAt ? new Date(work.createdAt) : null;
  const created = date && !Number.isNaN(date.getTime()) ? creationDate.format(date) : "Not recorded";
  return "Created " + created + " · " + work.perPack + " pieces/pack · " + (work.description || "No description");
}

export function planningOrderOption(order, title) {
  const works = order.workOrders.filter(work => work.jobs.some(job => job.completed < job.quantity));
  return [title, ...works.map(planningWorkDetails)].join(" · ");
}
