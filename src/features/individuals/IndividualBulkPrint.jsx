import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingToday } from "../../utils/dates.js";
import { IndividualSticker, stickerStyles } from "./IndividualSticker.jsx";
import { printIndividualStickers } from "./individualStickerPrint.jsx";

export function IndividualBulkPrint({ people, onBack }) {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState([]);
  const [cards, setCards] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const active = people.filter(person => person.kind === "individual" && person.active !== false);
  const visible = active.filter(person => (person.name + " " + (person.sourceNumber ?? "")).toLowerCase().includes(search.toLowerCase()));
  const allSelected = visible.length > 0 && visible.every(person => selected.includes(person.id));
  const validSelected = selected.filter(id => active.some(person => person.id === id));

  function changeSelection(ids) { setSelected(ids); setCards([]); setError(""); }
  async function prepare(print) {
    if (busy || !validSelected.length) return;
    setBusy(true);
    setError("");
    try {
      const rows = await manufacturingApi.rpc("app_individual_qr_cards", { p_people: validSelected, p_issue: true });
      if (rows.some(card => card.expiresOn && card.expiresOn < manufacturingToday())) throw new Error("Review expired QRs before printing.");
      setCards(rows);
      if (print) await printIndividualStickers(rows);
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  return <section>
    <style>{stickerStyles}</style>
    <nav aria-label="Bulk sticker breadcrumb"><button type="button" className="text-link" onClick={onBack}>Individuals</button> / Bulk stickers</nav>
    <header className="section-heading"><div><h2>Print individual QR stickers</h2><p className="quiet">2.4 × 4.8 inches · {validSelected.length} selected</p></div></header>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="individual-profile-grid">
      <section className="panel">
        <label className="field">Search name or code<input type="search" value={search} disabled={busy} onChange={e => setSearch(e.target.value)} /></label>
        <label className="individual-bulk-person"><input type="checkbox" checked={allSelected} disabled={busy || !visible.length}
          onChange={() => changeSelection(allSelected ? selected.filter(id => !visible.some(p => p.id === id)) : [...new Set([...selected, ...visible.map(p => p.id)])])} />
          <strong>Select all shown</strong></label>
        <div className="individual-bulk-list">{visible.map(person => <label className="individual-bulk-person" key={person.id}>
          <input type="checkbox" checked={selected.includes(person.id)} disabled={busy} onChange={e => changeSelection(e.target.checked ? [...selected, person.id] : selected.filter(id => id !== person.id))} />
          <span>{person.name}{person.sourceNumber && <small className="quiet"> · ID {person.sourceNumber}</small>}</span>
        </label>)}</div>
        {!visible.length && <p>No matching individuals.</p>}
        <div className="form-actions">
          <button type="button" disabled={busy || !validSelected.length || validSelected.length > 100} onClick={() => prepare(false)}>Preview stickers</button>
          <button type="button" className="primary" disabled={busy || !validSelected.length || validSelected.length > 100} onClick={() => prepare(true)}>
            {busy ? "Preparing…" : "Print " + validSelected.length + " stickers"}</button>
        </div>
      </section>
      <section className="panel"><h3>Sticker preview</h3><p className="quiet">Select individuals, then preview or print. Each sticker uses their existing personal QR.</p>
        <div className="individual-sticker-gallery">{cards.map(card => <div className="individual-sticker-preview" key={card.id}><IndividualSticker card={card} /></div>)}</div>
      </section>
    </div>
  </section>;
}
