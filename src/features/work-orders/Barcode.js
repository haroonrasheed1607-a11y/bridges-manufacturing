// features/work-orders/Barcode.js
import { manufacturingBarcodePatterns } from "../../assets/barcodePatterns.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingBarcode({
  value
}) {
  const h = React.createElement,
    text = String(value || '').replace(/[^\x20-\x7e]/g, '-'),
    codes = [104, ...Array.from(text, char => char.charCodeAt(0) - 32)];
  codes.push(codes.reduce((sum, code, index) => sum + (index ? code * index : code), 0) % 103, 106);
  let offset = 10;
  const bars = [];
  codes.forEach((code, index) => {
    for (const char of manufacturingBarcodePatterns[code]) {
      const width = char.toLowerCase().charCodeAt(0) - 96;
      if (char === char.toUpperCase()) bars.push(h('rect', {
        key: index + '-' + offset,
        x: offset,
        y: 0,
        width,
        height: 42,
        fill: '#000'
      }));
      offset += width;
    }
  });
  return h('figure', {
    className: 'work-barcode'
  }, h('svg', {
    viewBox: '0 0 ' + (offset + 10) + ' 42',
    role: 'img',
    'aria-label': 'Code 128 barcode ' + text,
    preserveAspectRatio: 'none'
  }, bars), h('figcaption', null, text));
}

export { ManufacturingBarcode };
