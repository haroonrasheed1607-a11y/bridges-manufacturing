// Same-page preview and printing; all label values use textContent, never HTML interpolation.
export function printBrowser(labels, { preview = false } = {}) {
  const frame = document.createElement("iframe");
  frame.title = preview ? "Label preview" : "Label print";
  frame.style.cssText = preview
    ? "position:fixed;inset:3%;width:94%;height:94%;z-index:10000;background:white;border:2px solid #223;border-radius:8px"
    : "position:fixed;left:-10000px;top:0;width:62mm;height:100mm;border:0";
  if (!preview) frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const popup = frame.contentWindow,
    doc = popup?.document;
  if (!doc) {
    frame.remove();
    return "Unable to prepare labels.";
  }
  const node = (tag, text, parent) => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  const style = node(
    "style",
    `@page{size:62mm 20.32mm;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white;color:black}body{font:9pt Arial}.label{width:62mm;min-height:20.32mm;padding:2mm 2mm 1.5mm;display:flex;align-items:center;gap:1mm;break-after:page}.label:last-child{break-after:auto}svg{width:16.5mm;height:16.5mm;flex:none}.text{flex:1;min-width:0;line-height:1.15}.line{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}strong{font-size:10pt}.code{font:7pt monospace}.toolbar{padding:12px;position:sticky;top:0;background:#eee}.toolbar button{padding:12px;margin-right:12px}@media screen{body.preview .label{margin:16px;border:1px dashed #999}}@media print{.toolbar{display:none}}`,
    doc.head,
  );
  doc.title = "Bridges box labels";
  if (preview) doc.body.className = "preview";
  const sections = [];
  if (preview) {
    const toolbar = node("div", undefined, doc.body);
    toolbar.className = "toolbar";
    node("span", labels.length + " label(s) · 62 mm roll ", toolbar);
    node("button", "Print", toolbar).onclick = () => popup.print();
    node("button", "Close preview", toolbar).onclick = () => frame.remove();
  }
  for (const label of labels) {
    const section = node("section", undefined, doc.body);
    section.className = "label";
    sections.push(section);
    const ns = "http://www.w3.org/2000/svg",
      svg = doc.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 33 33");
    svg.setAttribute("shape-rendering", "crispEdges");
    const rect = doc.createElementNS(ns, "rect");
    rect.setAttribute("width", "33");
    rect.setAttribute("height", "33");
    rect.setAttribute("fill", "white");
    svg.appendChild(rect);
    const path = doc.createElementNS(ns, "path");
    path.setAttribute("fill", "black");
    path.setAttribute(
      "d",
      label.matrix
        .flatMap((row, y) =>
          row.flatMap((dark, x) =>
            dark ? ["M" + (x + 4) + " " + (y + 4) + "h1v1h-1z"] : [],
          ),
        )
        .join(""),
    );
    svg.appendChild(path);
    section.appendChild(svg);
    const text = node("div", undefined, section);
    text.className = "text";
    [
      label.person,
      label.orderTitle,
      label.job + " · " + label.quantity + " pcs",
      label.boxId,
    ].forEach((value, i) => {
      const line = node("div", undefined, text);
      line.className = i === 3 ? "line code" : "line";
      node(i === 0 ? "strong" : "span", value, line);
    });
  }
  const print = () => {
    const mm =
      Math.ceil(
        ((Math.max(...sections.map((s) => s.getBoundingClientRect().height)) *
          25.4) /
          96) *
          10,
      ) / 10;
    style.textContent += "@page{size:62mm " + mm + "mm;margin:0}";
    if (!preview) {
      popup.focus();
      popup.print();
    }
  };
  popup.addEventListener(
    "afterprint",
    () => {
      if (!preview) frame.remove();
    },
    { once: true },
  );
  popup.requestAnimationFrame(() => {
    try {
      print();
    } catch {
      frame.remove();
      window.alert("Printing could not open. Use reprint to try again.");
    }
  });
  if (!preview) setTimeout(() => frame.remove(), 300000);
  return "";
}
