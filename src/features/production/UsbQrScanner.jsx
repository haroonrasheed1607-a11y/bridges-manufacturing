import { useEffect, useRef, useState } from "react";

// A keyboard-wedge scanner types into this focused field and submits with Enter.
// Keep capture local to the dialog so scans cannot alter another form.
export function UsbQrScanner({ onScan, onClose, description }) {
  const dialog = useRef(null), input = useRef(null), submitted = useRef(false);
  const [value, setValue] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    if (!dialog.current.open) dialog.current.showModal();
    input.current?.focus();
    return () => previous?.focus?.();
  }, []);
  function submit(event) {
    event.preventDefault();
    const code = value.trim();
    if (!code || submitted.current) return;
    submitted.current = true;
    onScan(code);
  }
  return <dialog ref={dialog} className="qr-camera-dialog" aria-labelledby="usb-qr-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="section-heading"><h2 id="usb-qr-title">USB QR scanner</h2>
      <button type="button" onClick={onClose}>Close</button></div>
    <p role="status">Ready to scan. Point the connected USB scanner at the QR code.</p>
    <form onSubmit={submit}>
      <label className="field">Scanned QR code
        <input ref={input} autoFocus value={value} autoComplete="off" spellCheck={false}
          onChange={event => setValue(event.target.value)} placeholder="Waiting for scanner…" />
      </label>
      <p className="quiet">The scanner should send Enter after each scan. You can also press Enter or select Use scanned code.</p>
      <button type="submit" className="primary" disabled={!value.trim()}>Use scanned code</button>
    </form>
    {description && <p>{description}</p>}
  </dialog>;
}
