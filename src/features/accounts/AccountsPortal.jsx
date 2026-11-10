import { React } from "../../vendor/react-runtime.js";
import { createApiClient } from "../../api/supabaseClient.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { AuthGate, ManufacturingSession, SessionActions } from "../auth/AuthGate.js";
import { TimesheetsPage } from "../timesheets/TimesheetsPage.jsx";
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

function AccountsWorkspace() {
  const profile = React.useContext(ManufacturingSession);
  const { signOut } = React.useContext(SessionActions);
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

  return <div id="manufacturing-app">
    <header className="top"><img className="brand-logo" src={manufacturingWorkLogo} alt="Bridges" />
      <h1>Accounts</h1><button className="header-sign-out" type="button" onClick={signOut}>Sign out</button>
    </header>
    <main className="work">
      {error ? <p role="alert" className="alert">{error}</p> : !people ? <p role="status">Loading Accounts…</p>
        : people.length ? <ManufacturingContext.Provider value={{ profile, workforce: { people } }}>
          <TimesheetsPage api={accountsApi} />
        </ManufacturingContext.Provider> : <p>No individuals are available for timesheets.</p>}
    </main>
  </div>;
}

export function AccountsPortal() {
  return <AuthGate api={accountsApi} portal="accounts"><AccountsWorkspace /></AuthGate>;
}
