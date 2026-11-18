export function IndividualDirectory({ people, search, onSearch, status, onStatus, onEdit, onProfile, onStatusChange }) {
  return <section className="panel individual-directory">
    <div className="form-grid">
      <label className="field">Search individuals<input type="search" value={search} onChange={e => onSearch(e.target.value)} placeholder="Name, role or skill…" /></label>
      <label className="field">Status<select value={status} onChange={e => onStatus(e.target.value)}>
        <option value="active">Active</option><option value="disabled">Disabled</option><option value="all">All statuses</option>
      </select></label>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Individual</th><th>Type / role</th><th>Services</th><th>Payroll basis</th><th>Billable hours/day</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{people.map(person => <tr key={person.id}>
        <th scope="row">{person.name}{person.sourceNumber != null && person.sourceNumber !== "" && <small className="individual-directory-id"> · ID {person.sourceNumber}</small>}</th><td>{person.role || (person.kind === 'coach' ? 'Job Coach' : 'Individual')}</td>
        <td>{person.services === 'state' ? 'State' : 'Waiver'}</td><td>{{piece:'By piece',hourly:'Hourly',both:'Both'}[person.billing || 'piece']}</td>
        <td>{person.averageWorkingHours ?? 3.5}</td><td>{person.active === false ? 'Disabled' : 'Active'}</td>
        <td><div className="individual-directory-actions"><button type="button" aria-label={"Edit " + person.name} aria-haspopup="dialog" onClick={() => onEdit(person)}>Edit</button>
          {person.kind === 'individual' && person.active !== false && <button type="button" aria-label={"Job QR for " + person.name} onClick={() => onProfile(person.id)}>Profile / QR</button>}
          {person.kind !== 'coach' && <button onClick={() => onStatusChange(person)}>{person.active === false ? 'Enable' : 'Disable'}</button>}
        </div></td>
      </tr>)}</tbody></table></div>
    {!people.length && <p className="quiet">No individuals match your filters.</p>}
  </section>;
}
