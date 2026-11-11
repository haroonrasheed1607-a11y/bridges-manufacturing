import { React } from "../../vendor/react-runtime.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { ManufacturingBoxQr } from "../work-orders/BoxQr.js";
import { formatDate } from "../../utils/dates.js";

export const stickerStyles = `
.individual-sticker{box-sizing:border-box;width:2.4in;height:4.8in;display:flex;flex-direction:column;padding:.08in .1in;background:#fff;color:#000;font:9pt Arial,sans-serif;text-align:center;overflow:hidden;break-after:page}
.individual-sticker:last-child{break-after:auto}
.individual-sticker-qr{height:2.32in;flex:none;display:flex;align-items:center;justify-content:center}
.individual-sticker-qr svg{width:2.15in;height:2.15in;max-width:none;flex:none}
.individual-sticker-name{font-weight:700;font-size:12pt;line-height:1.15;margin:.03in 0 .05in;overflow-wrap:anywhere;max-height:.55in;overflow:hidden}
.individual-sticker-number{font-weight:700;font-size:10pt;margin:0 0 .03in}
.individual-sticker-date{font-size:8pt;line-height:1.35;margin:0}
.individual-sticker-logo{width:1.15in;height:.36in;object-fit:contain;filter:grayscale(1) brightness(0);margin:.07in auto .03in}
.individual-sticker-website{margin:auto 0 0;font-size:9pt;font-weight:700}
`;

export function IndividualSticker({ card }) {
  return <article className="individual-sticker" aria-label={"QR sticker for " + card.name}>
    <div className="individual-sticker-qr"><ManufacturingBoxQr value={card.code} label="Individual Job QR" /></div>
    <div className="individual-sticker-name">{card.name}</div>
    {card.number && <p className="individual-sticker-number">ID {card.number}</p>}
    <p className="individual-sticker-date">Generated {card.generatedOn ? formatDate(card.generatedOn) : "Not recorded"}</p>
    <p className="individual-sticker-date">Expires {card.expiresOn ? formatDate(card.expiresOn) : "No expiry"}</p>
    <img className="individual-sticker-logo" src={manufacturingWorkLogo} alt="Bridges" />
    <p className="individual-sticker-website">www.bridgestulsa.org</p>
  </article>;
}
