import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { setSystemUpdating, subscribeSystemUpdating } from "./systemAvailability.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";

export function SystemUpdateGate({ children }) {
  const [state, setState] = React.useState("checking");
  React.useEffect(() => {
    let active = true, serial = 0;
    const unsubscribe = subscribeSystemUpdating(value => { if (active) setState(value ? "updating" : "ready"); });
    async function check() {
      const ticket = ++serial;
      try {
        const status = await manufacturingApi.systemStatus();
        if (!status || typeof status.updating !== "boolean") throw new Error("Invalid system status");
        if (active && ticket === serial) setSystemUpdating(status.updating);
      } catch { if (active && ticket === serial) setState(current => current === "updating" ? current : "unavailable"); }
    }
    check();
    const timer = setInterval(check, 10000);
    return () => { active = false; unsubscribe(); clearInterval(timer); };
  }, []);
  return state === "ready" ? children : <SystemUpdateScreen state={state} />;
}
export function SystemUpdateScreen({ state }) {
  return <main className="system-update-screen"><section role="status" aria-live="polite">
    <img src={manufacturingWorkLogo} alt="Bridges" />
    <h1>{state === "updating" ? "System under update, please wait" : state === "checking" ? "Checking system availability…" : "Unable to connect. Please wait."}</h1>
    <p>{state === "updating" ? "A backend update is in progress. The application will resume automatically when it is ready." : "Checking again automatically…"}</p>
  </section></main>;
}
