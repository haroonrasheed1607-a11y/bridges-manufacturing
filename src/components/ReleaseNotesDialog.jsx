import { appVersion } from '../utils/appVersion.js';
import { useEffect, useId, useRef } from "react";
import release from "../../release.json";

export default function ReleaseNotesDialog({ onClose }) {
  const dialog = useRef(null);
  const titleId = useId(),
    descriptionId = useId();
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="release-notes"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={onClose}
    >
      <h2 id={titleId}>What’s new in Version {appVersion}</h2>
      <p id={descriptionId}>{release.notes.join(" ")}</p>
      <div className="actions">
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
