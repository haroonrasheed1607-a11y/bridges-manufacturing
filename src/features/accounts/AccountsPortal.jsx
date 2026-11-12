import { AccountsRates } from "./AccountsRates.jsx";
import { React } from "../../vendor/react-runtime.js";
import { createApiClient } from "../../api/supabaseClient.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { AuthGate, ManufacturingSession, SessionActions } from "../auth/AuthGate.js";
import { TimesheetsPage } from "../timesheets/TimesheetsPage.jsx";
import { PayrollReport } from "./PayrollReport.jsx";
import { ManufacturingContext } from "../../state/ManufacturingContext.jsx";

function accountsLogin(value) {
  const username = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username)) throw new Error("Enter your Accounts username.");
  return username + "@bridges-accounts.local";
}

const accountsApi = createApiClient({
  sessionKey: "bridges-accounts-session-v1",
  loginEmail: accountsLogin,
});

function AccountsTimesheets() {
  const profile = React.useContext(ManufacturingSession);
  const [people, setPeople] = React.useState(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let live = true;
    accountsApi.rpc("app_accounts_people").then(rows => {
      if (live) setPeople(rows);
    }).catch(problem => {
      if (live) setError(problem.message);
    });
    return () => { live = false; };
  }, []);

  if (error) return <p role="alert" className="alert">{error}</p>;
  if (!people) return <p role="status">Loading individuals…</p>;
  if (!people.length) return <p>No individuals are available for timesheets.</p>;
  return <ManufacturingContext.Provider value={{ profile, workforce: { people } }}>
    <TimesheetsPage api={accountsApi} />
  </ManufacturingContext.Provider>;
}

function AccountsWorkspace() {
  const { signOut } = React.useContext(SessionActions);
  const [view, setView] = React.useState("payroll");

  return <div id="manufacturing-app">
    <header className="top"><img className="brand-logo" src={manufacturingWorkLogo} alt="Bridges" />
      <h1>Accounts</h1><button className="header-sign-out" type="button" onClick={signOut}>Sign out</button>
    </header>
    <main className="work">
      <nav className="accounts-nav" aria-label="Accounts views">
        <button type="button" aria-pressed={view === "payroll"} onClick={() => setView("payroll")}>Payroll report</button>
        <button type="button" aria-pressed={view === "timesheets"} onClick={() => setView("timesheets")}>Weekly timesheets</button>
        <button type="button" aria-pressed={view === "rates"} onClick={() => setView("rates")}>Clients &amp; items</button>
      </nav>
      {view === "rates" ? <AccountsRates api={accountsApi} /> : view === "payroll" ? <PayrollReport api={accountsApi} /> : <AccountsTimesheets />}
    </main>
  </div>;
}

export function AccountsPortal() {
  return <AuthGate api={accountsApi} portal="accounts"><AccountsWorkspace /></AuthGate>;
}
