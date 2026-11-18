import { useState } from 'react';
import { manufacturingApi } from '../../api/supabaseClient.js';
import { usePersonalQrTypes } from '../individuals/personalQrTypes.js';

export function PersonalQrTypes() {
  const { types, typeError } = usePersonalQrTypes();
  const [saved, setSaved] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add(event) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try {
      setSaved(await manufacturingApi.rpc('app_personal_qr_types', { p_name: name.trim() }));
      setName('');
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <h3>Personal QR types</h3>
    <ul><li>Generic</li>{(saved ?? types).map(type => <li key={type.id}>{type.name} · Time In and Time Out</li>)}</ul>
    <form onSubmit={add}>
      <label className="field">New Attendance type name<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} /></label>
      <button disabled={busy}>Add type</button>
    </form>
    {(error || typeError) && <p role="alert">{error || typeError}</p>}
  </section>;
}
