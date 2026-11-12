let updating = false;
const listeners = new Set();
export function setSystemUpdating(value) {
  updating = Boolean(value);
  for (const listener of listeners) listener(updating);
}
export function subscribeSystemUpdating(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function assertSystemAvailable() {
  if (!updating) return;
  const error = new Error("System under update, please wait");
  error.status = 503; error.code = "PT503";
  throw error;
}
