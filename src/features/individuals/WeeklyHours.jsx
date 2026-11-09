import { React } from "../../vendor/react-runtime.js";
import { weeklyAvailability } from "../../domain/workforce.js";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function WeeklyHours({ person, onChange }) {
  const hours = person.weeklyHours ?? weeklyAvailability(person);
  return <fieldset>
    <legend>Repeating weekly availability</legend>
    <p className="quiet">Enter available hours for each day. Use 0 for a day off. The pattern repeats every week.</p>
    <div className="form-grid">
      {days.map((day, index) => <label key={day} className="field">
        {day} hours
        <input type="number" min="0" max="24" step="0.01" required value={hours[index]}
          onChange={e => onChange(hours.map((h, i) => i === index ? e.target.value : h))} />
      </label>)}
    </div>
    {person.weeklyHours && <button type="button" onClick={() => onChange(null)}>Use default weekday hours</button>}
  </fieldset>;
}
