import { manufacturingDayOffset } from "../../utils/dates.js";
export function availabilityDates(start, count) {
  return Array.from({ length: count }, (_, i) =>
    manufacturingDayOffset(start, i),
  );
}
export function availabilityFor(records, personId, date) {
  return (
    records.find((r) => r.personId === personId && r.date === date) || {
      status: "unknown",
      hours: 0,
    }
  );
}
export function availabilitySummary(records, personId, dates) {
  return dates.reduce(
    (out, date) => {
      const r = availabilityFor(records, personId, date);
      out[r.status]++;
      out.hours += r.status === "available" ? Number(r.hours) : 0;
      return out;
    },
    { available: 0, unavailable: 0, unknown: 0, hours: 0 },
  );
}
