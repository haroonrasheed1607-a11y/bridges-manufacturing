import { useState } from "react";
import ReleaseNotesDialog from "./ReleaseNotesDialog.jsx";
import "./version.css";

export default function VersionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="version-link"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Version {__APP_VERSION__}
      </button>
      {open && <ReleaseNotesDialog onClose={() => setOpen(false)} />}
    </>
  );
}
