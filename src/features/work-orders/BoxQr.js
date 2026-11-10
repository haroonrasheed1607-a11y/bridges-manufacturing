// features/work-orders/BoxQr.js
import { manufacturingQrPath } from "../../domain/boxLabels.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingBoxQr({
  value, label = "QR code for box"
}) {
  return React.createElement('svg', {
    viewBox: '0 0 33 33',
    className: 'box-qr',
    role: 'img',
    'aria-label': label + " " + value,
    shapeRendering: 'crispEdges'
  }, React.createElement('rect', {
    width: 33,
    height: 33,
    fill: '#fff'
  }), React.createElement('path', {
    d: manufacturingQrPath(value),
    fill: '#000'
  }));
}

export { ManufacturingBoxQr };
