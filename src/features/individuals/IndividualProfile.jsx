import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { weeklyAvailability } from "../../domain/workforce.js";
import { manufacturingToday, formatDate } from "../../utils/dates.js";
import { IndividualSticker, stickerStyles } from "./IndividualSticker.jsx";
import { printIndividualStickers } from "./individualStickerPrint.jsx";

export function IndividualProfile({ person, onBack, onEdit }) {
  const [card, setCard] = React.useState(null);
  const [expiry, setExpiry] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setCard(null);
    setError("");
    manufacturingApi.rpc("app_individual_qr_cards", { p_people: [person.id], p_issue: false })
      .then(rows => {
        if (!active) return;
        setCard(rows[0]);
        setExpiry(rows[0].expiresOn ?? "");
      }).catch(problem => { if (active) setError(problem.message); });
    return () => { active = false; };
  }, [person.id]);

  async function act(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  const expired = card?.expiresOn && card.expiresOn < manufacturingToday();
  const canPrint = Boolean(card?.active && !expired && card.expiresOn === (expiry || null));
  return <section className="individual-profile">
    <style>{stickerStyles}</style>
    <nav aria-label="Individual profile breadcrumb"><button type="button" className="text-link" onClick={onBack}>Individuals</button> / {person.name}</nav>
    <header className="section-heading"><div><h2>{person.name}</h2><p className="quiet">Individual profile{person.sourceNumber && " · ID " + person.sourceNumber}</p></div>
      <button type="button" onClick={onEdit}>Edit individual</button>
    </header>
    {error && <p role="alert" className="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="individual-profile-grid">
      <section className="panel"><h3>Individual details</h3>
        <dl className="individual-profile-facts">
          <dt>Code</dt><dd>{person.sourceNumber || "Pending confirmation"}</dd>
          <dt>Status</dt><dd>{person.active === false ? "Disabled" : "Active"}</dd>
          <dt>Role / skills</dt><dd>{person.role || "—"}</dd>
          <dt>Services</dt><dd>{person.services === "state" ? "State" : "Waiver"}</dd>
          <dt>Billing</dt><dd>{{ hourly: "Hourly", piece: "By piece", both: "Both" }[person.billing ?? "piece"]}</dd>
          <dt>Average billable hours</dt><dd>{person.averageWorkingHours ?? 3.5} h/day</dd>
        </dl>
        <h3>Weekly availability</h3>
        <ul className="individual-profile-week">{weeklyAvailability(person).map((hours, i) =>
          <li key={i}><span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span><strong>{hours} h</strong></li>)}</ul>
      </section>
      <section className="panel"><h3>Personal QR sticker</h3>
        <p className="quiet">2.4 inches wide × 4.8 inches high · One sticker per individual</p>
        {!card ? !error && <p role="status">Loading QR details…</p> : <>
          <form onSubmit={event => {
            event.preventDefault();
            act(async () => {
              const updated = await manufacturingApi.rpc("app_set_individual_qr_expiry", { p_person: person.id, p_expiry: expiry || null });
              setCard(updated);
              setNotice("QR expiry saved.");
            });
          }}>
            <label className="field">QR expiry (optional)<input type="date" value={expiry} disabled={busy} onChange={e => setExpiry(e.target.value)} /></label>
            <button type="submit" disabled={busy || card.expiresOn === (expiry || null)}>Save expiry</button>
          </form>
          {expired && <p role="alert">This QR has expired. Review the expiry before printing.</p>}
          <div className="form-actions">
            {!card.code && <button type="button" disabled={busy || !canPrint} onClick={() => act(async () => {
              const rows = await manufacturingApi.rpc("app_individual_qr_cards", { p_people: [person.id], p_issue: true });
              setCard(rows[0]);
            })}>Generate QR</button>}
            <button type="button" className="primary" disabled={busy || !canPrint} onClick={() => act(async () => {
              const rows = await manufacturingApi.rpc("app_individual_qr_cards", { p_people: [person.id], p_issue: true });
              setCard(rows[0]);
              await printIndividualStickers(rows);
            })}>{busy ? "Preparing…" : card.code ? "Print sticker" : "Generate & print sticker"}</button>
          </div>
          {card.code ? <div className="individual-sticker-preview"><IndividualSticker card={card} /></div> : <p>Generate the individual’s personal QR to preview their sticker.</p>}
          {card.generatedOn && <p className="quiet">QR generated {formatDate(card.generatedOn)}.</p>}
        </>}
      </section>
    </div>
  </section>;
}
