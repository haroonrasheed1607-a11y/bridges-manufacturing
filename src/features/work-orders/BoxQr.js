// features/work-orders/BoxQr.js
import { manufacturingQrPath } from "../../domain/boxLabels.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingBoxQr({
  value
}) {
  return React.createElement('svg', {
    viewBox: '0 0 33 33',
    className: 'box-qr',
    role: 'img',
    'aria-label': 'QR code for box ' + value,
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
