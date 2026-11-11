import { React } from "../../vendor/react-runtime.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { ManufacturingNavigation } from "../Navbar.jsx";

function AppHeader() {
  return React.createElement(React.Fragment, null,
    React.createElement("a", { href: "#main-content", className: "skip-link" }, "Skip to content"),
    React.createElement("header", { className: "top compact-workspace-header" },
      React.createElement("img", { className: "brand-logo", src: manufacturingWorkLogo, alt: "Bridges", width: 104, height: 32 }),
      React.createElement(ManufacturingNavigation)));
}

export { AppHeader };
