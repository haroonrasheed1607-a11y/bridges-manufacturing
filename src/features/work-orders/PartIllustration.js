// features/work-orders/PartIllustration.js
import { React } from "../../vendor/react-runtime.js";

function ManufacturingPartIllustration({
  kind
}) {
  const h = React.createElement,
    common = {
      fill: 'none',
      stroke: '#222',
      strokeWidth: 2,
      strokeLinejoin: 'round',
      strokeLinecap: 'round'
    },
    path = d => h('path', {
      ...common,
      d
    });
  return h('svg', {
    viewBox: '0 0 120 90',
    className: 'assembly-part-drawing',
    role: 'img',
    'aria-label': kind === 'output' ? 'Assembled bolt, washer and nut' : kind
  }, kind === 'washer' ? [h('ellipse', {
    key: 'outer',
    ...common,
    cx: 60,
    cy: 45,
    rx: 34,
    ry: 24
  }), h('ellipse', {
    key: 'inner',
    ...common,
    cx: 60,
    cy: 45,
    rx: 13,
    ry: 9
  }), path('M26 45v6c0 13 15 24 34 24s34-11 34-24v-6')] : kind === 'nut' ? [path('M40 19h40l20 26-20 26H40L20 45zM40 71v8h40l20-26v-8M80 71v8'), h('ellipse', {
    key: 'hole',
    ...common,
    cx: 60,
    cy: 45,
    rx: 15,
    ry: 13
  }), path('M48 39l24 8M46 45l24 8')] : kind === 'output' ? [path('M18 29l12-9 12 9v32l-12 9-12-9zM42 36h62v18H42M54 29v32M60 29v32M79 29h16l9 8v18l-9 8H79l-8-8V37zM84 34v24M91 34v24'), path('M46 37l7 17M63 37l7 17')] : [path('M15 25l16-10 16 10v40L31 75 15 65zM47 34h58v22H47M55 34l8 22M65 34l8 22M75 34l8 22M85 34l8 22M95 34l8 22')]);
}

export { ManufacturingPartIllustration };
