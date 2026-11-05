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
Use a **62 mm continuous DK roll**, not die-cut labels. In Brother Printing Preferences select 62 mm continuous tape, automatic/variable length, no scaling, and automatic cutting. The app measures the label contents and requests a matching cut length. The driver must allow custom lengths; a fixed driver paper size can override the request. QR is left; person, order/work order, sub-job, pieces and box ID are right. Long text is shortened to fit. Confirm QR readability with a real label.

The native print command submits to the Windows spooler. “Sent” means queued, not physical proof of printing. If a cable/roll error occurs, inspect the Windows print queue before reprinting to avoid duplicates. Reprint uses the same box ID and does not create another box.

## Installation notes
The build is unsigned; Windows may show an unknown-publisher notice. This is not a signed installer. Only obtain the app from this repository. Production deployment should add code signing and a managed installer.

WebView2 stores the login session under the current Windows user's LocalAppData/BridgesShopFloor/Browser. Use Sign out on shared PCs. Native printing accepts structured labels only from the fixed Bridges Manufacturing HTTPS origin. External navigation and popup windows are blocked; camera video is allowed only for the trusted app origin; audio remains disabled.

## Build
Windows developer command: `dotnet publish desktop/BridgesShopFloor/BridgesShopFloor.csproj -c Release -r win-x64 --self-contained true -o desktop-output`.
The GitHub workflow builds the portable x64 package automatically. Printer hardware and Windows driver validation must be done on the actual station. Keep the web deployment current before using native printing.


## Version 1.3: updates, preview and batches
Install v1.3 once by replacing all extracted files. On future launches the app checks the fixed GitHub release for a newer version, downloads it over HTTPS, verifies its SHA-256 against the release manifest, stages files, and restarts with the update. Updates require write permission to the app folder. Keep it in a user-owned permanent folder. If the check fails the current version remains usable. Online screens update with the website. Native app version numbers must increase for future desktop releases.

Use **Preview before printing** to inspect a single label or whole batch. **Preview last batch** shows the most recent submitted labels; the preview toolbar can print them again, so avoid printing the same batch twice accidentally.

**Bulk box labels** lets you choose a work order, sub-job and individuals. Available means active non-coaches without open boxes or active unfinished dumping work; it is not a guarantee of attendance or free booked hours. Individuals with unfinished box or dumping work cannot receive another barcode. One box is saved per person; the last can contain fewer pieces. The backend checks remaining capacity. Saving is sequential, not all-or-nothing: on a failure, already saved boxes are listed and can be printed without creating them again. No physical print success is inferred from a successful save or spool submission.

Top clearance is approximately 6 mm. Test actual cutting and clipping with the Brother driver before production.

## Security status
Public download/source code does not itself grant admin access. However, the currently enabled passwordless scanner/boxer login endpoint intentionally grants those restricted roles to anyone who can reach it. This is a testing/shared-device configuration, not production-ready access control. Before going live, replace it with staff authentication or enrolled devices and remove the weak test admin password. The executable and updater are not code-signed: HTTPS and checksums protect transfer integrity but do not protect against compromise of the publishing GitHub account. Protect that account and add signing before a wider rollout. Sessions remain scoped to each Windows user; sign out on shared PCs. The app only accepts native print messages from its fixed website origin, validates label structure and restricts printer selection to QL-800 drivers. This is a targeted review, not a complete security audit.


## Version 1.4: availability, attendance and dumping
The shared Shop Floor supports box tracking and reusable dumping assignments in both web and desktop. Boxer setup can create a reusable QR for an individual/sub-job and configurable pieces per scan. In scanner mode, presenting that QR records a fresh completion automatically and displays a green named success screen for five seconds. Repeated presentations within five seconds are rejected on the server; retries reuse an event reference. This prevents common duplicate reads but is not proof a physical batch was actually produced. Remove the QR between batches. A smaller final batch can be entered after a capacity error. Closed assignments cannot record further pieces.

Availability and Attendance are under Directory for managers/admins and available to Job Coaches. Managers/coaches enter availability on an individual's behalf; there is no new student login. Unknown days remain unknown. Attendance and dumping totals feed weekly timesheets, with recorded attendance overriding that date's legacy attendance fields. Work hours must be explicitly recorded and are not inferred from production scans.

Bulk box labels and preview are also available in the web app. The web app uses its normal browser print dialog; silent printing remains a Windows driver feature.


Single box setup now shows the selected individual's current barcode alongside the form. A new barcode cannot be created while an unfinished box or active unfinished dumping assignment exists. The database enforces this across single, advanced and bulk setup. Reprinting never creates another assignment. The previous bulk option to include people with open boxes has been removed.


## Version 1.5: dated batches and webcam scanning
Bulk setup follows work date → individuals → job/sub-job. All created boxes in one batch use that same date; each individual must be free of unfinished work. Box assignment currently uses Monday–Friday work dates. To scan with the PC webcam, choose **Scan QR code** and select the camera if more than one is connected. Allow Windows camera access for desktop apps in Privacy & security → Camera. The app requests video only, stops the camera after a scan or closing the scanner, and routes both box and reusable dumping QR codes through the usual completion logic. Test on your actual webcam and printer.


## Version 1.7: recover saved camera denials
On startup the desktop app explicitly grants video camera permission to its fixed app origin in the WebView2 profile, replacing denials saved by older releases. Microphone permission stays denied. The scanner shows Windows-specific instructions and an **Open Windows camera settings** button when camera access fails. Windows privacy controls, administrator/device policies, disconnected hardware and cameras busy in other applications still apply. No Chrome login or Chrome site permission is needed inside this desktop app. Verify the title says v1.7 after updating.
