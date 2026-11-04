// domain/boxLabels.js
import { manufacturingQrTemplate } from "../assets/qrTemplate.js";

function manufacturingQrMatrix(text) {
  const bytes = Array.from(String(text), char => char.charCodeAt(0));
  if (bytes.length > 32 || bytes.some(value => value > 127)) throw Error('Box QR identifiers must be ASCII and at most 32 characters.');
  const bits = [0, 1, 0, 0],
    push = (value, count) => {
      for (let i = count - 1; i >= 0; i--) bits.push(value >>> i & 1);
    };
  push(bytes.length, 8);
  bytes.forEach(value => push(value, 8));
  for (let i = 0; i < 4 && bits.length < 272; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((value, bit) => value << 1 | bit, 0));
  for (let i = 0; data.length < 34; i++) data.push(i % 2 ? 17 : 236);
  function multiply(a, b) {
    let result = 0;
    while (b) {
      if (b & 1) result ^= a;
      a <<= 1;
      if (a & 256) a ^= 285;
      b >>= 1;
    }
    return result;
  }
  let generator = [1],
    root = 1;
  for (let i = 0; i < 10; i++) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((value, j) => {
      next[j] ^= value;
      next[j + 1] ^= multiply(value, root);
    });
    generator = next;
    root = multiply(root, 2);
  }
  const message = [...data, ...Array(10).fill(0)];
  for (let i = 0; i < 34; i++) {
    const factor = message[i];
    generator.forEach((value, j) => message[i + j] ^= multiply(value, factor));
  }
  const code = [...data, ...message.slice(34)],
    matrix = manufacturingQrTemplate.map(row => [...row]);
  let row = 24,
    direction = -1,
    bit = 0;
  for (let col = 24; col > 0; col -= 2) {
    if (col === 6) col--;
    while (true) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (matrix[row][x] === null) {
          let dark = bit < code.length * 8 ? !!(code[Math.floor(bit / 8)] >>> 7 - bit % 8 & 1) : false;
          if ((row + x) % 2 === 0) dark = !dark;
          matrix[row][x] = dark;
          bit++;
        }
      }
      row += direction;
      if (row < 0 || row >= 25) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
  return matrix;
}
function manufacturingQrPath(value) {
  return manufacturingQrMatrix(value).flatMap((row, y) => row.flatMap((dark, x) => dark ? ['M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z'] : [])).join('');
}
function manufacturingPrintBox(order, work, job, box, person) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]),
    frame = document.createElement('iframe');
  frame.title = 'Box label print';
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:62mm;height:20.32mm;border:0;pointer-events:none';
  document.body.appendChild(frame);
  const popup = frame.contentWindow;
  if (!popup) {frame.remove();return 'Unable to prepare printing. Use Reprint label to try again.';}
  const cleanup = () => frame.remove();
  popup.addEventListener('afterprint',cleanup,{once:true});
  const timeout = setTimeout(cleanup,300000);
  frame.addEventListener('load',()=>{
    try {popup.focus();popup.print();}
    catch {clearTimeout(timeout);cleanup();window.alert('Printing could not open. Use Reprint label to try again.');}
  },{once:true});
  popup.document.open();
  popup.document.write('<!doctype html><html><head><title>Box ' + escape(box.id) + '</title><style>@page{size:62mm 20.32mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#000;background:white}body{font:7pt Arial}.label{width:62mm;height:20.32mm;padding:1mm 2mm;display:flex;align-items:center;gap:1mm;overflow:hidden}svg{width:18mm;height:18mm;flex:none}.text{flex:1;min-width:0;line-height:1.15}.line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}strong{font-size:8pt}.code{font:5.5pt monospace;margin-top:.5mm}</style></head><body><section class="label"><svg viewBox="0 0 33 33" shape-rendering="crispEdges"><rect width="33" height="33" fill="white"/><path d="' + manufacturingQrPath(box.id) + '" fill="black"/></svg><div class="text"><div class="line"><strong>' + escape(person?.name || 'Unassigned') + '</strong></div><div class="line">' + escape(order.title) + '</div><div class="line">' + escape(order.id) + ' / ' + escape(work.id) + '</div><div class="line">' + escape(job.name) + ' · ' + escape(box.quantity) + ' pcs</div><div class="line code">' + escape(box.id) + '</div></div></section></body></html>');
  popup.document.close();
  return '';
}

export { manufacturingQrMatrix, manufacturingQrPath, manufacturingPrintBox };
