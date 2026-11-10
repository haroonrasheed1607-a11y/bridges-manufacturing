import { hasDesktopPrinter } from "../../services/printing/desktopPrinter.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";

const pageNames = {
  dashboard: "Dashboard",
  board: "Job Board",
  orders: "All orders",
  new: "New order request",
  plan: "Plan",
  productionline: "Shop Floor",
  customers: "Clients",
  individuals: "Individuals",
  availability: "Availability",
  attendance: "Attendance",
  users: "Users",
  configurations: "Configurations",
  barcodeapprovals: "Barcode approvals",
  workflow: "Workflow",
};

export function WorkspaceBreadcrumbs() {
  const { view, setView, order, orderDisplayTitle, profile, manager } = useManufacturing();
  if (hasDesktopPrinter()) return null;
  const parents = [];
  if (["orders", "new", "detail"].includes(view)) parents.push(["board", pageNames.board]);
  if (view === "detail" && manager) parents.push(["orders", pageNames.orders]);
  if (view === "barcodeapprovals") parents.push(["configurations", pageNames.configurations]);

  const shopFloorTitle = { box_setup: "Box Setup", box_scanner: "Scan & Complete" }[profile?.role];
  const title = view === "detail" && order ? orderDisplayTitle(order)
    : view === "productionline" && shopFloorTitle ? shopFloorTitle
    : pageNames[view] || pageNames.board;

  return <nav className="draft-banner workspace-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {parents.map(([route, label]) => <li key={route}>
        <button type="button" onClick={() => setView(route)}>{label}</button>
      </li>)}
      <li aria-current="page">{title}</li>
    </ol>
  </nav>;
}
