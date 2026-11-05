import { React } from "../../vendor/react-runtime.js";
import { SimpleBoxSetup } from "./SimpleBoxSetup.jsx";
import { BulkBoxSetup } from "./BulkBoxSetup.jsx";
import { DumpingSetup } from "../dumping/DumpingSetup.jsx";
export function ShopFloorSetup() {
  const [mode, setMode] = React.useState("box");
  const tabs = [
    ["box", "Single box"],
    ["bulk", "Bulk box labels"],
    ["dumping", "Dumping · reusable QR"],
  ];
  return (
    <div className="box-setup-screen">
      <header className="box-setup-heading">
        <div>
          <div className="eyebrow">SHOP FLOOR</div>
          <h2>Box setup</h2>
          <p>
            Choose the work and individual, then print. Current work stays
            visible alongside.
          </p>
        </div>
      </header>
      <div
        className="production-mode-tabs setup-task-tabs"
        role="group"
        aria-label="Production mode"
      >
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className={mode === value ? "is-selected" : ""}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "box" ? (
        <SimpleBoxSetup includeBulk={false} />
      ) : mode === "bulk" ? (
        <BulkBoxSetup expanded />
      ) : (
        <DumpingSetup />
      )}
    </div>
  );
}
