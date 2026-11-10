import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { useScreenMemory } from "../../state/useScreenMemory.js";
import { productionTabs } from "../auth/permissions.js";
import { ApprovedPlanPrint } from "./ApprovedPlanPrint.jsx";
import { ManufacturingScanComplete } from "./ScanComplete.js";

export function DesktopShopFloor() {
  const { profile } = useManufacturing();
  const tasks = productionTabs(profile?.role).map(([task]) => task);
  const [saved, setTask] = useScreenMemory("desktop-shop-floor", tasks[0]);
  const current = tasks.includes(saved) ? saved : tasks[0];
  if (!current) return <p role="alert">Shop Floor access required.</p>;

  return <section className="desktop-shop-floor">
    <div className="production-mode-tabs" role="group" aria-label="Shop Floor tasks">
      {[["scan", "Scan"], ["print", "Print"]].map(([task, label]) => <button
        key={task} type="button" className={current === task ? "is-selected" : ""}
        aria-pressed={current === task} disabled={!tasks.includes(task)}
        onClick={() => setTask(task)}>{label}</button>)}
    </div>
    {current === "scan"
      ? <ManufacturingScanComplete minimal={profile?.role === "box_scanner"} />
      : <ApprovedPlanPrint />}
  </section>;
}
