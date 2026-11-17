import { React } from '../../vendor/react-runtime.js';
import { manufacturingApi } from '../../api/supabaseClient.js';
import { useManufacturing } from '../../state/ManufacturingContext.jsx';
import { downloadBackup } from './backupDownload.js';

export function Backups() {
  const { profile } = useManufacturing();
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [last, setLast] = React.useState(null);
  const running = React.useRef(false);
  if (profile?.role !== 'admin') return null;
  async function create(kind) {
    if (running.current) return;
    running.current = true; setBusy(kind); setError('');
    try {
      const backup = await manufacturingApi.rpc('app_database_backup', { p_kind: kind });
      const filename = downloadBackup(backup);
      setLast({ ...backup, sql: undefined, filename });
    } catch (problem) { setError(problem.message || 'The backup could not be created.'); }
    finally { running.current = false; setBusy(''); }
  }
  return <section className="panel" aria-labelledby="backup-heading">
    <h3 id="backup-heading">Database backup</h3>
    <p>Download the setup scripts and data separately. Keep a matching pair with the same schema fingerprint for recovery.</p>
    <div className="form-grid">
      <section><h4>Database setup</h4>
        <p>Current application tables, functions, views, triggers, indexes, security policies and permissions. No business records.</p>
        <button type="button" disabled={Boolean(busy)} onClick={() => create('setup')}>{busy === 'setup' ? 'Preparing setup…' : 'Download setup SQL'}</button>
      </section>
      <section><h4>Database data</h4>
        <p>All application records, including inactive work, scans, rates, attendance and private audit history, from one consistent snapshot.</p>
        <button type="button" disabled={Boolean(busy)} onClick={() => create('data')}>{busy === 'data' ? 'Preparing data…' : 'Download data SQL'}</button>
      </section>
    </div>
    {busy && <p role="status">Preparing your download. Keep this page open.</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    {last && <div role="status"><strong>Download prepared: {last.filename}</strong>
      <p>{last.environment} · {new Date(last.createdAt).toLocaleString()} · {(last.bytes / 1024).toFixed(1)} KiB</p>
      <p>Schema fingerprint: <code>{last.schemaFingerprint}</code></p>
      {last.kind === 'data' && <p>{Object.keys(last.tableCounts).length} tables · {Object.values(last.tableCounts).reduce((sum, count) => sum + Number(count), 0).toLocaleString()} records</p>}
      <small>Store the downloaded file securely. These downloads contain confidential application information.</small>
    </div>}
    <hr />
    <h4>Recovery order</h4>
    <ol><li>Create a fresh Supabase project and recover staff authentication users with their original IDs.</li>
      <li>Run the setup SQL as the database owner.</li><li>Run the matching data SQL against empty application tables. Existing data is never overwritten.</li>
      <li>Recover uploaded files and deploy the backend functions and application separately.</li></ol>
    <p className="quiet">Auth passwords and sessions, uploaded files, Vault secrets and Edge Function deployments are not included. Restore is an operator task; there is no restore button. Downloads currently support up to 16 MiB per SQL file.</p>
  </section>;
}
