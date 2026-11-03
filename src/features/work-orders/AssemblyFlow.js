// features/work-orders/AssemblyFlow.js
import { manufacturingDefaultParts } from "../../domain/workOrders.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingPartIllustration } from "./PartIllustration.js";

function ManufacturingAssemblyFlow({
  parts
}) {
  const h = React.createElement,
    items = parts?.length ? parts : manufacturingDefaultParts();
  return h('div', {
    className: 'assembly-flow',
    'aria-label': 'Assembly order: ' + items.map(part => part.name).join(', ') + ', finished output'
  }, ...items.flatMap((part, index) => [index > 0 && h('span', {
    key: 'plus-' + part.id,
    className: 'assembly-operator',
    'aria-hidden': true
  }, '+'), h('figure', {
    key: part.id,
    className: 'assembly-part'
  }, h('span', {
    className: 'assembly-step-number'
  }, 'STEP ' + (index + 1)), part.image ? h('img', {
    src: part.image,
    alt: part.name
  }) : h(ManufacturingPartIllustration, {
    kind: part.kind || 'bolt'
  }), h('figcaption', null, part.name))]), h('span', {
    className: 'assembly-operator',
    'aria-hidden': true
  }, '='), h('figure', {
    className: 'assembly-part assembly-output'
  }, h('span', {
    className: 'assembly-step-number'
  }, 'OUTPUT'), h(ManufacturingPartIllustration, {
    kind: 'output'
  }), h('figcaption', null, 'Finished assembly')));
}

export { ManufacturingAssemblyFlow };
