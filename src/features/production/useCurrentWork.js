import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
export function useCurrentWork(personId, orders) {
  const [state, setState] = React.useState({ busy: false, items: [] }),
    [checking, setChecking] = React.useState(false),
    [error, setError] = React.useState("");
  const generation = React.useRef(0);
  async function reload() {
    const ticket = ++generation.current;
    if (!personId) {
      setState({ busy: false, items: [] });
      setChecking(false);
      return;
    }
    setChecking(true);
    setError("");
    try {
      const value = await manufacturingApi.rpc("app_person_current_work", {
        p_person: personId,
      });
      if (ticket === generation.current) setState(value);
    } catch (e) {
      if (ticket === generation.current) {
        setState({ busy: true, items: [] });
        setError(e.message);
      }
    } finally {
      if (ticket === generation.current) setChecking(false);
    }
  }
  React.useEffect(() => {
    setState({ busy: !!personId, items: [] });
    reload();
    return () => {
      generation.current++;
    };
  }, [personId, orders]);
  return { ...state, checking, error, reload };
}
