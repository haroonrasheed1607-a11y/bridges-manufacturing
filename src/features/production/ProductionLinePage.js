import { ScanAssignPage } from "../scan-assign/ScanAssignPage.jsx";
import { hasDesktopPrinter } from "../../services/printing/desktopPrinter.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { useScreenMemory } from "../../state/useScreenMemory.js";
import { React } from "../../vendor/react-runtime.js";
import { productionTabs } from "../auth/permissions.js";
import { ApprovedPlanPrint } from "./ApprovedPlanPrint.jsx";
import { ManufacturingScanComplete } from "./ScanComplete.js";

function ManufacturingProductionLine() {
  const { profile } = useManufacturing();
  const tasks = productionTabs(profile?.role).map(([task]) => task);
  const [saved, setTask] = useScreenMemory(hasDesktopPrinter() ? "desktop-shop-floor" : "shop-floor-tab", tasks[0]);
  const current = tasks.includes(saved) ? saved : tasks[0];
  const h = React.createElement;
  if (!current) return h("p", { role: "alert" }, "Shop Floor access required.");

  return h("section", { className: "shop-floor-tasks" },
    h("div", { className: "production-mode-tabs", role: "group", "aria-label": "Shop Floor tasks" },
      [["scan", "Scan"], ["print", "Print"], ["assign", "Scan & Assign"]].map(([task, label]) => h("button", {
        key: task,
        type: "button",
        className: current === task ? "is-selected" : "",
        "aria-pressed": current === task,
        disabled: !tasks.includes(task),
        onClick: () => setTask(task),
      }, label))),
    current === "scan"
      ? h(ManufacturingScanComplete, { minimal: profile?.role === "box_scanner" })
      : current === "assign" ? h(ScanAssignPage) : h(ApprovedPlanPrint));
}

export { ManufacturingProductionLine };
