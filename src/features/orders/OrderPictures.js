// features/orders/OrderPictures.js
import { React } from "../../vendor/react-runtime.js";

function ManufacturingOrderPictures({
  pictures
}) {
  const h = React.createElement;
  if (!pictures?.length) return null;
  return h('section', {
    className: 'panel order-reference-pictures'
  }, h('h3', null, 'Order pictures'), h('div', {
    className: 'order-picture-grid'
  }, pictures.map(picture => h('figure', {
    key: picture.id
  }, h('a', {
    href: picture.src,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': 'Open ' + picture.name
  }, h('img', {
    src: picture.src,
    alt: picture.name,
    loading: 'lazy'
  })), h('figcaption', null, picture.name)))));
}

export { ManufacturingOrderPictures };
