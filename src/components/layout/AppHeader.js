import { React } from "../../vendor/react-runtime.js";
import { SessionActions } from "../../features/auth/AuthGate.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { ManufacturingNavigation } from "../Navbar.jsx";
import { MobileNavbar } from "../MobileNavbar.jsx";

function AppHeader() {
  const session = React.useContext(SessionActions);
  const h = React.createElement;
  return h(React.Fragment, null,
    h("a", { href: "#main-content", className: "skip-link" }, "Skip to content"),
    h("header", { className: "top desktop-workspace-header" },
      h("div", { className: "workspace-brand" },
        h("span", { className: "brand-mark", "aria-hidden": true }, "▦"),
        h("div", null, h("h1", null, "Manufacturing"), h("span", null, "BRIDGES WORKSPACE"))),
      h(ManufacturingNavigation),
      h("img", { className: "brand-logo", src: manufacturingWorkLogo, alt: "Bridges", width: 130, height: 39 }),
      h("button", { type: "button", className: "header-sign-out", onClick: session?.signOut }, "Sign out")),
    h("header", { className: "top compact-workspace-header" },
      h("img", { className: "brand-logo", src: manufacturingWorkLogo, alt: "Bridges", width: 104, height: 32 }),
      h(MobileNavbar)));
}

export { AppHeader };
