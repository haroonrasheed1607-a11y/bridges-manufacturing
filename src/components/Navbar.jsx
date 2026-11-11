import { hasDesktopPrinter } from "../services/printing/desktopPrinter.js";
import { canUsePlan, canUseShopFloor, isShopFloorRole } from "../features/auth/permissions.js";
import { useManufacturing } from "../state/ManufacturingContext.jsx";
import { SessionActions } from "../features/auth/AuthGate.js";
import { React } from "../vendor/react-runtime.js";

function Navbar() {
  const { setView, view, manager, profile } = useManufacturing();
  const session = React.useContext(SessionActions);
  const [open, setOpen] = React.useState(false);
  const root = React.useRef(null);
  const trigger = React.useRef(null);
  const menuId = React.useId();
  const desktop = hasDesktopPrinter();

  React.useEffect(() => {
    if (!open) return;
    function closeOutside(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  React.useEffect(() => { setOpen(false); }, [view]);

  const items = [];
  if (!desktop && manager) items.push(["Dashboard", "dashboard"], ["Job Board", "board"]);
  items.push(["Shop Floor", "productionline"]);
  if (canUseShopFloor(profile?.role)) {
    items.push(["Shop Floor Dashboard", "shopfloordashboard"], ["Time In / Out", "shopfloorattendance"]);
  }
  if (canUsePlan(profile?.role)) {
    items.push(["Print", "shopfloorprint"]);
    if (!desktop) items.push(["Plan", "plan"]);
  }
  if (!desktop && manager) {
    items.push(["Clients", "customers"], ["Individuals", "individuals"],
      ["Availability", "availability"], ["Attendance roster", "attendance"]);
    if (profile?.role === "admin") items.push(["Users", "users"], ["Configurations", "configurations"]);
  } else if (!desktop && !isShopFloorRole(profile?.role)) {
    items.push(["Job Board", "board"]);
    if (profile?.role === "coach") items.push(["Availability", "availability"], ["Attendance roster", "attendance"]);
  }
  function active(route) {
    return route === "board" ? ["board", "orders", "new", "detail"].includes(view) : route === view;
  }
  function closeAndFocus() { setOpen(false); trigger.current?.focus(); }

  return <nav ref={root} className="main-navigation workspace-menu-navigation" aria-label="Main navigation"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === "Escape" && open) { event.preventDefault(); closeAndFocus(); }
    }}>
    <button ref={trigger} type="button" className="workspace-menu-trigger" aria-expanded={open}
      aria-controls={menuId} onClick={() => setOpen(value => !value)}
      onKeyDown={event => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => root.current?.querySelector(".workspace-menu-panel a")?.focus());
        }
      }}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      Menu
    </button>
    <div id={menuId} className="workspace-menu-panel" hidden={!open}>
      {items.map(([label, route]) => <a key={route} href={"#" + route} aria-current={active(route) ? "page" : undefined}
        onClick={event => { event.preventDefault(); closeAndFocus(); setView(route); }}>{label}</a>)}
      <button type="button" className="workspace-menu-sign-out" disabled={!session?.signOut}
        onClick={() => { setOpen(false); session?.signOut(); }}>Sign out</button>
    </div>
  </nav>;
}

export { Navbar, Navbar as ManufacturingNavigation };
export default Navbar;
