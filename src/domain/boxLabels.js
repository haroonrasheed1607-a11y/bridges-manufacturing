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
    popup = window.open('', '_blank');
  if (!popup) return 'Allow the label print window to open and use Print QR label again.';
  popup.document.open();
  popup.document.write('<!doctype html><html><head><title>Box ' + escape(box.id) + '</title><style>@page{size:100mm 150mm;margin:8mm}body{font:14px Arial;color:#000}h1{font-size:20px}svg{width:65mm;height:65mm;display:block;margin:10mm auto}p{line-height:1.6}small{font-family:monospace;overflow-wrap:anywhere}</style></head><body><h1>BRIDGES · BOX LABEL</h1><svg viewBox="0 0 33 33" shape-rendering="crispEdges"><rect width="33" height="33" fill="white"/><path d="' + manufacturingQrPath(box.id) + '" fill="black"/></svg><small>' + escape(box.id) + '</small><p><b>' + escape(order.title) + '</b><br>' + escape(work.description) + '<br>' + escape(job.name) + '</p><p>Individual: <b>' + escape(person?.name || 'Unassigned') + '</b><br>Pieces: ' + escape(box.quantity) + '<br>Job Coach: ' + escape(work.coachName || '—') + '</p></body></html>');
  popup.document.close();
  popup.focus();
  popup.print();
  return '';
}

export { manufacturingQrMatrix, manufacturingQrPath, manufacturingPrintBox };
