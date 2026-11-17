import { workspaceParent, optionalViews } from "../../config/workspaceNavigation.js";
import { canUsePlan } from "../../features/auth/permissions.js";
import { hasDesktopPrinter } from "../../services/printing/desktopPrinter.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";

const pageNames = {
  dashboard: "Dashboard",
  board: "Job Board",
  orders: "All orders",
  new: "New order request",
  plan: "Plan",
  productionline: "Shop Floor",
  shopfloorprint: "Print",
  shopfloordashboard: "Shop Floor Dashboard",
  shopfloorattendance: "Time In / Out",
  customers: "Clients",
  individuals: "Individuals",
  availability: "Availability",
  attendance: "Attendance",
  users: "Users",
  configurations: "Configurations",
  barcodeapprovals: "Barcode approvals",
  workflow: "Workflow", timesheets: "Timesheets", optionalorder: "Detailed order workflow", optionalpeople: "Capacity & bookings", optionalboxes: "Box-label setup",
};

export function WorkspaceBreadcrumbs() {
  const { view, setView, order, orderDisplayTitle, manager, profile } = useManufacturing();
  if (hasDesktopPrinter()) return null;
  const parents = [];
  const [route, group] = workspaceParent(view);
  if (view === 'detail') parents.push(canUsePlan(profile?.role) ? ['plan', 'Daily Operations / Plan'] : ['productionline', 'Daily Operations / Shop Floor']);
  else if (route) parents.push([route, group]);
  else parents.push([null, group]);
  if (optionalViews.includes(view)) parents.push([null, 'Optional workflows']);

  const title = view === "detail" && order ? orderDisplayTitle(order)
    : pageNames[view] || pageNames.board;

  return <nav className="draft-banner workspace-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {parents.map(([route, label]) => <li key={route || label}>
        {route ? <button type="button" onClick={() => setView(route)}>{label}</button> : <span>{label}</span>}
      </li>)}
      <li aria-current="page">{title}</li>
    </ol>
  </nav>;
}
