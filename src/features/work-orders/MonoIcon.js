// features/work-orders/MonoIcon.js
import { React } from "../../vendor/react-runtime.js";

function ManufacturingMonoIcon({
  kind
}) {
  const h = React.createElement;
  return h('svg', {
    viewBox: '0 0 32 32',
    className: 'work-mono-icon',
    'aria-hidden': true,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }, kind === 'box' ? [h('path', {
    key: 'box',
    d: 'M4 9l12-6 12 6v15l-12 6-12-6zM4 9l12 6 12-6M16 15v15M10 6l12 6v7'
  })] : [h('circle', {
    key: 'head',
    cx: 16,
    cy: 7,
    r: 4
  }), h('path', {
    key: 'body',
    d: 'M9 29v-9H6v-7h20v7h-3v9M12 13v16M20 13v16'
  })]);
}

export { ManufacturingMonoIcon };
