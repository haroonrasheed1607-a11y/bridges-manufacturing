import { PlanPage } from './features/plan/PlanPage.jsx';
import {BarcodeApprovals} from './features/admin-approvals/BarcodeApprovals.jsx';
import {AvailabilityPage} from './features/availability/AvailabilityPage.jsx';
import {AttendancePage} from './features/attendance/AttendancePage.jsx';
import {ConfigurationsPage} from './features/configurations/ConfigurationsPage.jsx';
import { UsersPage } from './features/users/UsersPage.jsx';
import { canUsePlan, isShopFloorRole } from './features/auth/permissions.js';
import { React } from './vendor/react-runtime.js';
import { WorkOrdersPage } from './features/work-orders/WorkOrdersPage.js';
// app/App.js
import { AppLayout } from "./components/MainLayout.jsx";
import { ManufacturingCustomers } from "./features/customers/CustomersPage.js";
import { ManufacturingDashboard } from "./features/dashboard/DashboardPage.js";
import { ManufacturingIndividuals } from "./features/individuals/IndividualsPage.js";
import { ManufacturingJobBoard } from "./features/job-board/JobBoardPage.js";
import { CreateOrderPage } from "./features/orders/CreateOrderPage.js";
import { OrderDetailsPage } from "./features/orders/OrderDetailsPage.js";
import { OrdersPage } from "./features/orders/OrdersPage.js";
import { ManufacturingProductionLine } from "./features/production/ProductionLinePage.js";
import { WorkflowPage } from "./features/workflow/WorkflowPage.js";
import { useManufacturing } from "./state/ManufacturingContext.jsx";
import { jsxRuntime } from "./vendor/jsx-runtime.js";

function App() {
  let {
    view: e, manager, profile, orderDisplayTitle,
    order: t
  } = useManufacturing();
  if(e === 'plan' && canUsePlan(profile?.role)) return <AppLayout><PlanPage /></AppLayout>;
  if(isShopFloorRole(profile?.role))return React.createElement(AppLayout,null,React.createElement(ManufacturingProductionLine));
  if(['admin','manager','coach'].includes(profile?.role)&&['availability','attendance'].includes(e))return React.createElement(AppLayout,null,React.createElement(e==='availability'?AvailabilityPage:AttendancePage));
  if(!manager)return React.createElement(AppLayout,null,e==='detail'&&t?React.createElement(React.Fragment,null,React.createElement('h2',null,orderDisplayTitle(t)),React.createElement(WorkOrdersPage)):e==='board'?React.createElement(ManufacturingJobBoard):React.createElement(ManufacturingProductionLine));
  return (0, jsxRuntime.jsx)(AppLayout, {
    children: e === 'barcodeapprovals' && profile?.role === 'admin' ? React.createElement(BarcodeApprovals) : e === 'configurations' && profile?.role === 'admin' ? React.createElement(ConfigurationsPage) : e === 'users' && profile?.role === 'admin' ? React.createElement(UsersPage) : e === `productionline` ? (0, jsxRuntime.jsx)(ManufacturingProductionLine, {}) : e === `individuals` ? (0, jsxRuntime.jsx)(ManufacturingIndividuals, {}) : e === `board` ? (0, jsxRuntime.jsx)(ManufacturingJobBoard, {}) : e === `customers` ? (0, jsxRuntime.jsx)(ManufacturingCustomers, {}) : e === `dashboard` ? (0, jsxRuntime.jsx)(ManufacturingDashboard, {}) : e === `new` ? (0, jsxRuntime.jsx)(CreateOrderPage, {}) : e === `workflow` ? (0, jsxRuntime.jsx)(WorkflowPage, {}) : e === `detail` && t ? (0, jsxRuntime.jsx)(OrderDetailsPage, {}, t.id) : (0, jsxRuntime.jsx)(OrdersPage, {})
  });
}

export { App };

export { App as AppRouter };
export default App;
