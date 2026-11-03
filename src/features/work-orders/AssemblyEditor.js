// features/work-orders/AssemblyEditor.js
import { FormField } from "../../components/common/FormField.js";
import { createId } from "../../utils/ids.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingAssemblyFlow } from "./AssemblyFlow.js";

function ManufacturingAssemblyEditor({
  parts,
  onChange
}) {
  const h = React.createElement,
    [error, setError] = React.useState('');
  function move(index, delta) {
    const next = [...parts];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  function update(index, values) {
    onChange(parts.map((part, i) => i === index ? {
      ...part,
      ...values
    } : part));
  }
  function upload(index, file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1500000) {
      setError('Choose a JPG, PNG or WebP picture up to 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update(index, {
        image: String(reader.result)
      });
      setError('');
    };
    reader.onerror = () => setError('Unable to load this picture. Try another file.');
    reader.readAsDataURL(file);
  }
  return h('div', {
    className: 'assembly-editor'
  }, h('p', {
    className: 'paper-section-note'
  }, 'Add a picture of each part, name it, and set the assembly order. The first part shown goes in first.'), h(ManufacturingAssemblyFlow, {
    parts
  }), h('div', {
    className: 'assembly-part-editors'
  }, parts.map((part, index) => h('div', {
    key: part.id,
    className: 'assembly-part-editor'
  }, h(FormField, {
    label: 'Part ' + (index + 1) + ' name'
  }, h('input', {
    required: true,
    value: part.name,
    maxLength: 80,
    onChange: event => update(index, {
      name: event.target.value
    })
  })), h('label', {
    className: 'part-upload-label'
  }, 'Part picture', h('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    onChange: event => upload(index, event.target.files?.[0])
  })), h('div', {
    className: 'assembly-part-actions'
  }, h('button', {
    type: 'button',
    disabled: index === 0,
    onClick: () => move(index, -1),
    'aria-label': 'Move ' + part.name + ' earlier'
  }, '← Earlier'), h('button', {
    type: 'button',
    disabled: index === parts.length - 1,
    onClick: () => move(index, 1),
    'aria-label': 'Move ' + part.name + ' later'
  }, 'Later →'), part.image && h('button', {
    type: 'button',
    onClick: () => update(index, {
      image: ''
    })
  }, 'Use illustration'), parts.length > 1 && h('button', {
    type: 'button',
    onClick: () => onChange(parts.filter((_, i) => i !== index))
  }, 'Remove'))))), h('button', {
    type: 'button',
    onClick: () => onChange([...parts, {
      id: createId('PART'),
      name: 'Part ' + (parts.length + 1),
      kind: 'bolt',
      image: ''
    }])
  }, '＋ Add part'), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error));
}

export { ManufacturingAssemblyEditor };
