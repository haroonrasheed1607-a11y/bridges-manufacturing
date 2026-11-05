# Bridges Shop Floor for Windows

A compact Windows desktop app for Bridges Manufacturing. Uses the current online Shop Floor and shared Supabase data, with native QL-800 printing. No browser tab, extension, b-PAC template or print dialog is needed. Internet is required for sign-in and database operations; there is no offline queue.

## Download and run
1. Download from https://github.com/haroonrasheed1607-a11y/bridges-manufacturing/releases/download/shop-floor-v1/Bridges-Shop-Floor-Windows-x64.zip (no login required).
2. Extract the entire ZIP into a permanent folder.
3. Install Brother's QL-800 Windows driver and connect the printer by USB.
4. Install Microsoft Edge WebView2 Evergreen Runtime if Windows does not already have it.
5. Run **BridgesShopFloor.exe**. Keep all files in the extracted folder together. The app includes .NET, so a separate .NET installation is not needed.
6. Select your QL-800 at the top. The choice is saved for this Windows user.
7. Use **Test printer** before printing production labels.
8. Choose **Log in as boxer**, select a job and individual, then **Create & print box**. For a connected keyboard barcode scanner, choose **Log in as scanner**; scan and confirm completion.

## Roll setup
Use a **62 mm continuous DK roll**, not die-cut labels. In Brother Printing Preferences select 62 mm continuous tape, approximately **40.64 mm length**, no scaling, and automatic cutting. The app requests this size; the driver and roll settings must agree. QR is left; person, order/work order, sub-job, pieces and box ID are right. Long text is shortened to fit. Confirm QR readability with a real label.

The native print command submits to the Windows spooler. “Sent” means queued, not physical proof of printing. If a cable/roll error occurs, inspect the Windows print queue before reprinting to avoid duplicates. Reprint uses the same box ID and does not create another box.

## Installation notes
The build is unsigned; Windows may show an unknown-publisher notice. This is not a signed installer. Only obtain the app from this repository. Production deployment should add code signing and a managed installer.

WebView2 stores the login session under the current Windows user's LocalAppData/BridgesShopFloor/Browser. Use Sign out on shared PCs. Native printing accepts structured labels only from the fixed Bridges Manufacturing HTTPS origin. External navigation and popup windows are blocked; camera permission is disabled in the desktop app (use a keyboard scanner).

## Build
Windows developer command: `dotnet publish desktop/BridgesShopFloor/BridgesShopFloor.csproj -c Release -r win-x64 --self-contained true -o desktop-output`.
The GitHub workflow builds the portable x64 package automatically. Printer hardware and Windows driver validation must be done on the actual station. Keep the web deployment current before using native printing.
