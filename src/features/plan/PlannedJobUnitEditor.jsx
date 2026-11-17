import { React } from '../../vendor/react-runtime.js';

export function PlannedJobUnitEditor({ row, busy, isAdmin, onSave }) {
  const state = row.unitEditState;
  const saved = state?.billableUnitsPerScan ?? row.billableUnitsPerScan;
  const [value, setValue] = React.useState(saved ?? '');
  React.useEffect(() => setValue(saved ?? ''), [row.jobId, saved, state?.revision]);
  const enabled = Boolean(isAdmin && row.billableMode && state?.canEditUnits);
  const reset = Boolean(state?.requiresDayReset);
  const quantity = Number(value);
  const valid = Number.isInteger(quantity) && quantity > 0 && quantity <= Number(state?.totalBillableUnits);
  const reason = state?.unitEditReason || (!isAdmin ? 'Only an admin can change BU/Scan' : !state ? 'Refresh this plan to check scanning progress' : '');
  const hint = 'plan-unit-hint-' + row.jobId;
  return <div className="planned-unit-editor">
    <form onSubmit={event => { event.preventDefault(); if(enabled && valid && !busy) onSave(row, quantity); }}>
      <input aria-label={'BU per Scan for ' + row.title} aria-describedby={hint} type="number" min="1"
        max={state?.totalBillableUnits ?? row.quantity} step="1" value={value} placeholder="—"
        disabled={busy || !enabled} onChange={event => setValue(event.target.value)} />
      {isAdmin && <button type="submit" disabled={busy || !enabled || !valid || (!reset && quantity === Number(saved))}>
        {reset ? 'Reset day & save' : 'Save'}
      </button>}
    </form>
    <small id={hint}>{enabled ? reset
      ? `${state.dayBillableUnits.toLocaleString()} BU scanned today · below 10%. Reset confirmation required.`
      : 'No scans on this day.' : reason}</small>
  </div>;
}
