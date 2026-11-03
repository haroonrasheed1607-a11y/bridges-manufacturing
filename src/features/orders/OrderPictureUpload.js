// features/orders/OrderPictureUpload.js
import { manufacturingReadOrderPicture } from "../../utils/pictures.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingOrderPictureUpload({
  pictures,
  onChange,
  onBusy
}) {
  const h = React.createElement,
    [error, setError] = React.useState(''),
    [busy, setBusy] = React.useState(false);
  async function upload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    if (pictures.length + files.length > 6) {
      setError('Add up to 6 pictures per order.');
      return;
    }
    setBusy(true);
    onBusy(true);
    try {
      const added = [];
      for (const file of files) added.push(await manufacturingReadOrderPicture(file));
      const next = [...pictures, ...added];
      if (next.reduce((sum, picture) => sum + picture.src.length, 0) > 2 * 1024 * 1024) throw new Error('These pictures are too large to save together. Choose fewer or smaller pictures.');
      onChange(next);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return h('div', {
    className: 'order-picture-upload'
  }, h('label', {
    className: 'field'
  }, h('span', null, 'Order pictures (optional)'), h('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    multiple: true,
    disabled: busy || pictures.length >= 6,
    onChange: upload
  }), h('small', null, 'Add up to 6 product, sample or reference pictures. JPG, PNG or WebP.')), busy && h('p', {
    role: 'status'
  }, 'Preparing pictures…'), error && h('p', {
    className: 'alert',
    role: 'alert'
  }, error), h('div', {
    className: 'order-picture-grid'
  }, pictures.map(picture => h('figure', {
    key: picture.id
  }, h('img', {
    src: picture.src,
    alt: picture.name
  }), h('figcaption', null, picture.name), h('button', {
    type: 'button',
    disabled: busy,
    onClick: () => onChange(pictures.filter(item => item.id !== picture.id)),
    'aria-label': 'Remove ' + picture.name
  }, 'Remove')))));
}

export { ManufacturingOrderPictureUpload };
