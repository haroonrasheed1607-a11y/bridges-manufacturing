import MainLayout from './components/MainLayout.jsx';
import Orders from './features/orders/Orders.jsx';
import NewOrder from './features/orders/NewOrder.jsx';
import OrderWorkspace from './features/orders/OrderWorkspace.jsx';
import Workflow from './features/orders/Workflow.jsx';
import {useManufacturing} from './state/ManufacturingContext.jsx';
export default function App(){const {view,order}=useManufacturing();return <MainLayout>{view==='new'?<NewOrder/>:view==='workflow'?<Workflow/>:view==='detail'&&order?<OrderWorkspace key={order.id}/>:<Orders/>}</MainLayout>;}
