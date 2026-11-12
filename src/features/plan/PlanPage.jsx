import { PlanCreateOrder } from "./PlanCreateOrder.jsx";
import { React } from "../../vendor/react-runtime.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";

export function PlanPage() {
  const { profile } = useManufacturing();
  return <section className="plan-page">
    {["admin", "manager"].includes(profile?.role)
      ? <PlanCreateOrder />
      : <p className="quiet">Orders are planned automatically when created by an administrator or manager. Assigned work is available in Shop Floor.</p>}
  </section>;
}
