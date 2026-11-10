import { BarcodeApprovals } from "../admin-approvals/BarcodeApprovals.jsx";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { useScreenMemory } from "../../state/useScreenMemory.js";
import { React } from "../../vendor/react-runtime.js";
import { ScanSettings } from "./ScanSettings.jsx";
import { ScanHistory } from "./ScanHistory.jsx";

const sections = [
  ["settings", "Scan settings", ScanSettings],
  ["history", "Scan history", ScanHistory],
  ["approvals", "QR approvals", BarcodeApprovals],
  ["windows", "Windows app", WindowsApp],
];

export function ConfigurationsPage() {
  const { profile } = useManufacturing();
  const [saved, setTab] = useScreenMemory("configurations-tab", "settings");
  const active = sections.some(([id]) => id === saved) ? saved : "settings";
  const [visited, setVisited] = React.useState(() => new Set([active]));
  if (profile?.role !== "admin") return null;

  function select(id) {
    setTab(id);
    setVisited(previous => previous.has(id) ? previous : new Set([...previous, id]));
  }

  return <>
    <div className="page-heading"><h2>Configurations</h2></div>
    <div className="production-mode-tabs configuration-tabs" role="tablist" aria-label="Configuration sections">
      {sections.map(([id, label], index) => <button key={id} type="button" role="tab"
        id={"config-tab-" + id} aria-controls={"config-panel-" + id} aria-selected={active === id}
        className={active === id ? "is-selected" : ""} tabIndex={active === id ? 0 : -1}
        onClick={() => select(id)}
        onKeyDown={event => {
          const key = event.key;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
          event.preventDefault();
          const next = key === "Home" ? 0 : key === "End" ? sections.length - 1
            : (index + (key === "ArrowLeft" ? -1 : 1) + sections.length) % sections.length;
          const nextId = sections[next][0];
          select(nextId);
          event.currentTarget.parentElement.querySelector("#config-tab-" + nextId)?.focus();
        }}>{label}</button>)}
    </div>
    {sections.map(([id, , Panel]) => <div key={id} role="tabpanel" id={"config-panel-" + id}
      aria-labelledby={"config-tab-" + id} hidden={active !== id}>
      {(active === id || visited.has(id)) && <Panel embedded />}
    </div>)}
  </>;
}

function WindowsApp() {
  return (
 <section className="panel"><h3>Windows Shop Floor app</h3><p>Box setup, reusable barcode scans, bulk labels, previews and direct Brother QL-800 label printing, connected to your existing manufacturing data.</p>
 <p><a className="primary" href="https://github.com/haroonrasheed1607-a11y/bridges-manufacturing/releases/download/shop-floor-v1/Bridges-Shop-Floor-Windows-x64.zip" target="_blank" rel="noopener noreferrer">Download for Windows (64-bit)</a></p>
 <p className="quiet">Version 1.10 · About 73 MB · Direct download · No GitHub login required.</p>
 <ol><li>Extract the entire ZIP into a folder.</li><li>Install the Brother QL-800 Windows driver and connect the printer by USB.</li><li>Run BridgesShopFloor.exe. Install Microsoft Edge WebView2 Runtime if prompted.</li><li>Select the QL-800 and choose Test printer before printing production labels.</li></ol>
 <p>Use a 62 mm continuous roll with automatic label length. The desktop app prints without browser tabs or a print dialog; b-PAC is not required.</p>
 <p className="quiet">Version 1.10 checks for updates automatically on startup. Install this version once to enable future automatic updates. The Windows app is unsigned. Physical label sizing and QR readability should be checked on the printer. Internet is required.</p>
 <a href="https://github.com/haroonrasheed1607-a11y/bridges-manufacturing/actions/workflows/shop-floor-windows.yml" target="_blank" rel="noopener noreferrer">Windows builds and downloads</a>
 </section>
  );
}
