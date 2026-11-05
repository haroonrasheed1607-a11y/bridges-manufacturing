import {React} from '../../vendor/react-runtime.js';
import {useManufacturing} from '../../state/ManufacturingContext.jsx';
export function ConfigurationsPage(){
 const {profile,setView}=useManufacturing();
 if(profile?.role!=='admin')return null;
 return <><div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h2>Configurations</h2></div></div>
 <section className="panel"><h3>QR code approvals</h3><p>Mark previous box codes complete or close reusable QR assignments, individually or in bulk.</p><button className="primary" onClick={()=>setView('barcodeapprovals')}>Open QR approvals</button></section>
 <section className="panel"><h3>Windows Shop Floor app</h3><p>Box setup, reusable dumping QR scans, bulk labels, previews and direct Brother QL-800 label printing, connected to your existing manufacturing data.</p>
 <p><a className="primary" href="https://github.com/haroonrasheed1607-a11y/bridges-manufacturing/releases/download/shop-floor-v1/Bridges-Shop-Floor-Windows-x64.zip" target="_blank" rel="noopener noreferrer">Download for Windows (64-bit)</a></p>
 <p className="quiet">Version 1.6 · About 73 MB · Direct download · No GitHub login required.</p>
 <ol><li>Extract the entire ZIP into a folder.</li><li>Install the Brother QL-800 Windows driver and connect the printer by USB.</li><li>Run BridgesShopFloor.exe. Install Microsoft Edge WebView2 Runtime if prompted.</li><li>Select the QL-800 and choose Test printer before printing production labels.</li></ol>
 <p>Use a 62 mm continuous roll with automatic label length. The desktop app prints without browser tabs or a print dialog; b-PAC is not required.</p>
 <p className="quiet">Version 1.6 checks for updates automatically on startup. Install this version once to enable future automatic updates. The Windows app is unsigned. Physical label sizing and QR readability should be checked on the printer. Internet is required.</p>
 <a href="https://github.com/haroonrasheed1607-a11y/bridges-manufacturing/actions/workflows/shop-floor-windows.yml" target="_blank" rel="noopener noreferrer">Windows builds and downloads</a>
 </section></>;
}
