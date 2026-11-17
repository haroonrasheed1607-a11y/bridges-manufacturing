import { React } from './vendor/react-runtime.js';
import { AppLayout } from './components/MainLayout.jsx';
import { useManufacturing } from './state/ManufacturingContext.jsx';
import { hasDesktopPrinter } from './services/printing/desktopPrinter.js';
import { canUsePlan, canUseShopFloor, isShopFloorRole } from './features/auth/permissions.js';
import { optionalViews } from './config/workspaceNavigation.js';
import { OptionalWorkflowShell } from './features/configurations/OptionalWorkflows.jsx';
import { ConfigurationsPage } from './features/configurations/ConfigurationsPage.jsx';
import { PlanPage } from './features/plan/PlanPage.jsx';
import { ManufacturingProductionLine } from './features/production/ProductionLinePage.js';
import { ShopFloorDashboard } from './features/production/ShopFloorDashboard.jsx';
import { QrAttendance } from './features/attendance/QrAttendance.jsx';
import { AttendancePage } from './features/attendance/AttendancePage.jsx';
import { TimesheetsPage } from './features/timesheets/TimesheetsPage.jsx';
import { DailyOrderDetails } from './features/orders/DailyOrderDetails.jsx';
import { ManufacturingDashboard } from './features/dashboard/DashboardPage.jsx';
import { ManufacturingCustomers } from './features/customers/CustomersPage.js';
import { ManufacturingIndividuals } from './features/individuals/IndividualsPage.js';
import { UsersPage } from './features/users/UsersPage.jsx';
import { BarcodeApprovals } from './features/admin-approvals/BarcodeApprovals.jsx';
// Optional tools stay intact behind the Configurations entry point.
import { ManufacturingJobBoard } from './features/job-board/JobBoardPage.js';
import { OrdersPage } from './features/orders/OrdersPage.js';
import { CreateOrderPage } from './features/orders/CreateOrderPage.js';
import { OrderDetailsPage } from './features/orders/OrderDetailsPage.js';
import { WorkflowPage } from './features/workflow/WorkflowPage.js';
import { AvailabilityPage } from './features/availability/AvailabilityPage.jsx';
import { ApprovedPlanPrint } from './features/production/ApprovedPlanPrint.jsx';
import { ShopFloorSetup } from './features/production/ShopFloorSetup.jsx';

function App() {
  const { view, manager, profile, order } = useManufacturing();
  const role = profile?.role;
  let screen;
  if (view === 'shopfloordashboard' && canUseShopFloor(role)) screen = <ShopFloorDashboard />;
  else if (view === 'shopfloorattendance' && canUseShopFloor(role)) screen = <QrAttendance />;
  else if (hasDesktopPrinter()) screen = <ManufacturingProductionLine />;
  else if (optionalViews.includes(view)) {
    const tools = {
      board: ManufacturingJobBoard, orders: OrdersPage, new: CreateOrderPage,
      workflow: WorkflowPage, availability: AvailabilityPage, shopfloorprint: ApprovedPlanPrint,
      optionalboxes: ShopFloorSetup,
    };
    const Tool = tools[view];
    screen = <OptionalWorkflowShell>{role === 'admin' && (view === 'optionalpeople' ? <ManufacturingIndividuals advanced />
      : view === 'optionalorder' ? order ? <OrderDetailsPage /> : <p>Select an order in Optional workflows.</p>
        : Tool ? <Tool /> : null)}</OptionalWorkflowShell>;
  }
  else if (view === 'plan' && canUsePlan(role)) screen = <PlanPage />;
  else if (view === 'detail' && order) screen = <DailyOrderDetails />;
  else if (isShopFloorRole(role)) screen = <ManufacturingProductionLine />;
  else if (view === 'attendance' && ['admin','manager','coach'].includes(role)) screen = <AttendancePage />;
  else if (view === 'timesheets' && ['admin','manager','coach'].includes(role)) screen = <TimesheetsPage />;
  else if (view === 'configurations' && role === 'admin') screen = <ConfigurationsPage />;
  else if (view === 'users' && role === 'admin') screen = <UsersPage />;
  else if (view === 'barcodeapprovals' && role === 'admin') screen = <BarcodeApprovals />;
  else if (manager && view === 'customers') screen = <ManufacturingCustomers />;
  else if (manager && view === 'individuals') screen = <ManufacturingIndividuals />;
  else if (manager && view !== 'productionline') screen = <ManufacturingDashboard />;
  else screen = <ManufacturingProductionLine />;
  return <AppLayout>{screen}</AppLayout>;
}
export { App, App as AppRouter };
export default App;
