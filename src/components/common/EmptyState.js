// components/common/EmptyState.js
import { jsxRuntime } from "../../vendor/jsx-runtime.js";

function EmptyState({
  children: e
}) {
  return (0, jsxRuntime.jsx)(`div`, {
    className: `empty`,
    children: e
  });
}

export { EmptyState };
