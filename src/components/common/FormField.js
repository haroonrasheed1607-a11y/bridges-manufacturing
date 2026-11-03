// components/common/FormField.js
import { jsxRuntime } from "../../vendor/jsx-runtime.js";

function FormField({
  label: e,
  children: t,
  hint: n
}) {
  return (0, jsxRuntime.jsxs)(`label`, {
    className: `field`,
    children: [(0, jsxRuntime.jsx)(`span`, {
      children: e
    }), t, n && (0, jsxRuntime.jsx)(`small`, {
      children: n
    })]
  });
}

export { FormField };
