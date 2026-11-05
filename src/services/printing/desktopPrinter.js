export function hasDesktopPrinter() {
  return (
    globalThis.window?.bridgesDesktop?.version === 1 && !!window.chrome?.webview
  );
}
export function printDesktop(labels, { preview = false } = {}) {
  const type =
    labels.length === 1 ? "bridges.print-box" : "bridges.print-boxes";
  if (labels.length > 1 && !window.bridgesDesktop.bulkPrinting)
    return "Update the Windows app to use batch printing.";
  window.chrome.webview.postMessage(
    labels.length === 1
      ? { type, ...labels[0], preview }
      : { type, labels, preview },
  );
  return "";
}
