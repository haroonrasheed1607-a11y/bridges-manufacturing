// components/common/Badge.js
import { jsxRuntime } from "../../vendor/jsx-runtime.js";

function Badge({
  children: e,
  tone: t = ``
}) {
  return (0, jsxRuntime.jsx)(`span`, {
    className: `badge ` + t,
    children: e
  });
}

export { Badge };
