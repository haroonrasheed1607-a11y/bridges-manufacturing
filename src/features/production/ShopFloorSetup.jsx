import { React } from "../../vendor/react-runtime.js";
import { SimpleBoxSetup } from "./SimpleBoxSetup.jsx";
import { DumpingSetup } from "../dumping/DumpingSetup.jsx";
export function ShopFloorSetup() {
  const [mode, setMode] = React.useState("box");
  return (
    <>
      <div
        className="production-mode-tabs"
        role="group"
        aria-label="Production mode"
      >
        <button
          className={mode === "box" ? "is-selected" : ""}
          onClick={() => setMode("box")}
        >
          Box tracking
        </button>
        <button
          className={mode === "dumping" ? "is-selected" : ""}
          onClick={() => setMode("dumping")}
        >
          Dumping · reusable QR
        </button>
      </div>
      {mode === "box" ? <SimpleBoxSetup /> : <DumpingSetup />}
    </>
  );
}
