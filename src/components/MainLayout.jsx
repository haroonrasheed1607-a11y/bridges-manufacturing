import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import {useManufacturing} from '../state/ManufacturingContext.jsx';
export default function MainLayout({children}){const {storageError}=useManufacturing();return <div id="manufacturing-app"><Navbar/><div className="draft-banner"><span className="status-dot"/> Screen draft <span className="banner-divider">/</span> Sample data · saved in this browser only</div>{storageError&&<div role="alert" className="alert">{storageError}</div>}<div className="shell"><main id="main-content" className="work">{children}</main></div><Footer/></div>;}
