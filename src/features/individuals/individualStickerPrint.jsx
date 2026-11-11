import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { React } from "../../vendor/react-runtime.js";
import { IndividualSticker, stickerStyles } from "./IndividualSticker.jsx";

export async function printIndividualStickers(cards) {
  if (!cards.length || cards.length > 100 || cards.some(card => !card.code)) {
    throw new Error("Choose between 1 and 100 generated QR stickers.");
  }
  const frame = document.createElement("iframe");
  frame.title = "Individual QR sticker print";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:2.4in;height:3.2in;border:0";
  document.body.appendChild(frame);
  const popup = frame.contentWindow;
  const doc = popup?.document;
  if (!doc) {
    frame.remove();
    throw new Error("Unable to prepare sticker printing.");
  }
  doc.title = "Bridges Individual QR stickers";
  const style = doc.createElement("style");
  style.textContent = "@page{size:2.4in 3.2in;margin:0}html,body{margin:0;padding:0;background:white}" + stickerStyles;
  doc.head.appendChild(style);
  const container = doc.createElement("div");
  doc.body.appendChild(container);
  const root = createRoot(container);
  let timer;
  function cleanup() {
    clearTimeout(timer);
    root.unmount();
    frame.remove();
  }
  try {
    flushSync(() => root.render(<>{cards.map(card => <IndividualSticker key={card.id} card={card} />)}</>));
    await Promise.all(Array.from(doc.images, img => img.decode()));
    await new Promise(resolve => popup.requestAnimationFrame(() => popup.requestAnimationFrame(resolve)));
    popup.addEventListener("afterprint", cleanup, { once: true });
    timer = setTimeout(cleanup, 300000);
    popup.focus();
    popup.print();
  } catch {
    cleanup();
    throw new Error("Printing could not open. Try Print again.");
  }
}
