// Keep legacy conflict handling while older deployments finish updating.
export function isConflictError(error) {
  return error?.code === "PT409" || error?.code === "40001";
}
