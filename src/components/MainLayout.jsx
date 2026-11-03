import { ResponsiveTables } from './common/ResponsiveTables.js';
// components/layout/MainLayout.js
import { useManufacturing } from "../state/ManufacturingContext.jsx";
import { jsxRuntime } from "../vendor/jsx-runtime.js";
import { AppFooter } from "./layout/AppFooter.js";
import { AppHeader } from "./layout/AppHeader.js";

function MainLayout({
  children: e
}) {
  let {
    storageError: t, refresh, pending, manager, profile
  } = useManufacturing();
  return (0, jsxRuntime.jsxs)(`div`, {
    id: `manufacturing-app`,
    children: [(0, jsxRuntime.jsx)(ResponsiveTables, {}), (0, jsxRuntime.jsx)(AppHeader, {}), (0, jsxRuntime.jsxs)(`div`, {
      className: `draft-banner`,
      children: [(0, jsxRuntime.jsx)(`span`, {
        className: `status-dot`
      }), ` Screen draft `, (0, jsxRuntime.jsx)(`span`, {
        className: `banner-divider`,
        children: `/`
      }), ` Shared Supabase database · updates across devices`]
    }), t && (0, jsxRuntime.jsx)(`div`, {
      role: `alert`,
      className: `alert`,
      children: [t, (0, jsxRuntime.jsx)(`button`, {type:`button`,onClick:refresh,children:`Refresh data`})]
    }), (0, jsxRuntime.jsx)(`div`, {
      className: `shell`,
      children: (0, jsxRuntime.jsx)(`main`, {
        id: `main-content`,
        className: `work`,
        children: (0, jsxRuntime.jsx)(`fieldset`, {disabled:pending,className:`workspace-controls`,children:e})
      })
    }), (0, jsxRuntime.jsx)(AppFooter, {})]
  });
}

export { MainLayout };

export { MainLayout as AppLayout };
export default MainLayout;
