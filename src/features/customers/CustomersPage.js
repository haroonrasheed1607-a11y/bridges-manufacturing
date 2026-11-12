import { ClientCatalog } from "./ClientCatalog.jsx";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";
function ManufacturingCustomers() {
 const { customerCatalog = [], saveCustomerItem } = useManufacturing();
 return React.createElement(ClientCatalog,{clients:customerCatalog,onSaveItem:saveCustomerItem});
}
export { ManufacturingCustomers };
