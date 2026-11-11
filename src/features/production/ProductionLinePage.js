import { ShopFloorDashboard } from "./ShopFloorDashboard.jsx";
import { ScanAssignPage } from "../scan-assign/ScanAssignPage.jsx";
import { hasDesktopPrinter } from "../../services/printing/desktopPrinter.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { useScreenMemory } from "../../state/useScreenMemory.js";
import { React } from "../../vendor/react-runtime.js";
import { productionTabs } from "../auth/permissions.js";
import { ManufacturingScanComplete } from "./ScanComplete.js";

function ManufacturingProductionLine() {
  const { profile } = useManufacturing();
  const tasks = productionTabs(profile?.role).map(([task]) => task);
  const [saved, setTask] = useScreenMemory(hasDesktopPrinter() ? "desktop-shop-floor" : "shop-floor-tab", tasks[0]);
  const [assignRefresh, setAssignRefresh] = React.useState(0);
  const [dashboard, setDashboard] = React.useState(false);
  const [dashboardRefresh, setDashboardRefresh] = React.useState(0);
  const current = tasks.includes(saved) ? saved : tasks[0];
  const h = React.createElement;
  if (!current) return h("p", { role: "alert" }, "Shop Floor access required.");

  return h("section", { className: "shop-floor-tasks" },
    h("div", { className: "shop-floor-utility-actions" }, h("button", {
      type: "button",
      className: "shop-floor-dashboard-button",
      "aria-pressed": dashboard,
      onClick: () => { setDashboard(true); setDashboardRefresh(value => value + 1); },
    }, "Dashboard")),
    h("div", { className: "production-mode-tabs shop-floor-scan-tabs", role: "group", "aria-label": "Shop Floor tasks" },
      [["scan", "Routine Scan"], ["assign", "Scan & Assign"]].map(([task, label]) => h("button", {
        key: task,
        type: "button",
        className: [!dashboard && current === task ? "is-selected" : "", task === "assign" ? "scan-assign-tab" : "routine-scan-tab"].filter(Boolean).join(" "),
        "aria-pressed": !dashboard && current === task,
        disabled: !tasks.includes(task),
        onClick: () => {
          setDashboard(false);
          if (task === "assign") setAssignRefresh(value => value + 1);
          setTask(task);
        },
      }, label))),
    dashboard ? h(ShopFloorDashboard, { refreshVersion: dashboardRefresh }) : current === "scan"
      ? h(ManufacturingScanComplete, { minimal: profile?.role === "box_scanner" })
      : h(ScanAssignPage, { refreshVersion: assignRefresh }));
}

export { ManufacturingProductionLine };
