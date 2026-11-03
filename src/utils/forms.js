// utils/forms.js


function manufacturingFillFields(form, values) {
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    const input = form.elements.namedItem(name);
    if (input && 'value' in input) input.value = String(value);
  }
}

export { manufacturingFillFields };
