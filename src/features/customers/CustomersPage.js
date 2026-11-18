import { ClientCatalog } from "./ClientCatalog.jsx";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingCustomers() {
  const { customerCatalog = [], saveCustomerItem, addCustomer, profile } = useManufacturing();
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const saving = React.useRef(false);
  const h = React.createElement;

  async function register(event) {
    event.preventDefault();
    if (saving.current) return;
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!name) { setError("Enter a client name."); return; }
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const problem = await addCustomer(name);
      if (problem) setError(problem);
      else { setAdding(false); setNotice("Client registered."); }
    } catch (problem) { setError(problem.message); }
    finally { saving.current = false; setBusy(false); }
  }

  return h(React.Fragment, null,
    profile?.role === "admin" && h("div", { className: "section-heading" },
      h("h2", null, "Clients"),
      !adding && h("button", { type: "button", onClick: () => { setAdding(true); setNotice(""); } }, "Register client")),
    adding && h("form", { className: "panel", onSubmit: register },
      h("label", { className: "field" }, "Client name",
        h("input", { name: "name", required: true, maxLength: 200, disabled: busy, autoFocus: true })),
      h("div", { className: "form-actions" },
        h("button", { type: "submit", className: "primary", disabled: busy }, busy ? "Saving…" : "Save client"),
        h("button", { type: "button", disabled: busy, onClick: () => { setAdding(false); setError(""); } }, "Cancel"))),
    error && h("p", { className: "alert", role: "alert" }, error),
    notice && h("p", { role: "status" }, notice),
    h(ClientCatalog, { clients: customerCatalog, onSaveItem: saveCustomerItem }));
}

export { ManufacturingCustomers };
