import { PlanCreateOrder } from "./PlanCreateOrder.jsx";
import { PlannedJobs } from "./PlannedJobs.jsx";
import { React } from "../../vendor/react-runtime.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingToday } from "../../utils/dates.js";

export function PlanPage() {
  const { profile } = useManufacturing();
  const [date, setDate] = React.useState(manufacturingToday);
  const [version, setVersion] = React.useState(0);
  if (!["admin", "manager", "coach", "station", "box_setup"].includes(profile?.role)) return null;
  return <section className="plan-page">
    {["admin", "manager"].includes(profile?.role) && <PlanCreateOrder onPlanned={receipt => {
      setDate(receipt.date); setVersion(value => value + 1);
    }} />}
    <PlannedJobs date={date} onDateChange={setDate} refreshVersion={version} />
  </section>;
}
