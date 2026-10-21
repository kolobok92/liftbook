# Running Liftbook on your iPhone (from Windows)

## Install with AltStore (free Apple ID, refreshes itself)

One-time setup on the PC:

1. Install **iTunes** and **iCloud for Windows** from Apple's direct installers, not the
   Microsoft Store versions (uninstall those first if present; AltServer can't use them):
   - iTunes: https://www.apple.com/itunes/download/win64
   - iCloud: https://updates.cdn-apple.com/2020/windows/001-39935-20200911-1A70AA56-F448-11EA-8CC0-99D41950005E/iCloudSetup.exe
   (Links from AltStore's Windows guide; the older iCloud version is intentional.)
2. Download **AltServer for Windows** from altstore.io, install it and run it (it sits in the
   system tray; set it to start with Windows so refreshes keep working).
3. Plug in the iPhone, unlock it, tap **Trust**. In iTunes, select the phone and tick
   **Sync with this iPhone over Wi-Fi** (lets AltStore refresh without the cable).
4. Tray icon → **Install AltStore** → your iPhone → sign in with your Apple ID (a spare Apple
   ID is safer; you type it into AltServer yourself).
5. On the iPhone: Settings → General → **VPN & Device Management** → trust your Apple ID; and
   Settings → Privacy & Security → **Developer Mode** → on (it restarts) if prompted.

Install Liftbook:

6. Get the .ipa: GitHub → Actions → **iOS unsigned build** → latest run → Artifacts →
   `Liftbook-unsigned-ipa`, unzip → `Liftbook-unsigned.ipa`. Put it in your **iCloud Drive**
   folder on the PC (iCloud for Windows syncs it to the phone).
7. On the iPhone: AltStore → **My Apps** → **+** → pick the .ipa from iCloud Drive. Done.

Staying signed: AltStore re-signs Liftbook in the background whenever the phone is on the same
Wi-Fi as the PC with AltServer running; you can also open AltStore → My Apps → **Refresh All**.
If the PC is off for more than 7 days, Liftbook won't open until you refresh (data is kept).
To update, install the newer .ipa the same way (step 7); data is kept.

The app includes a Live Activity widget, so signing uses two app IDs (app + `….LiveActivity`)
out of the free account's 10 per week; AltStore itself counts as one of the 3 active apps.

(Alternatives: Sideloadly does a one-off install without auto-refresh; SideStore refreshes on
the phone with no PC after a fiddlier setup.)

## What to try

- **Core loop:** start the Push day, log a few sets (tap a row to prefill, check it, focus
  moves on), finish, then Repeat it from Home: Previous should show what you just did.
- **Live Activity:** start a workout and lock the phone. The lock screen should show the
  current exercise (with its photo), "Set N of M · Push" and a clock counting up; on an iPhone
  with a Dynamic Island, swipe home to see the clock in the island (long-press it to expand).
  Check a set → the card moves to the next set. Pause in the app → the card shows "Paused"
  with a progress bar. Finish → the card ends. Tapping the card opens the workout.
  If nothing appears: Settings → Liftbook → **Live Activities** must be on.
- **Light mode:** Profile → Appearance → System / Light / Dark; "System" follows the phone.
- **Keyboard:** while typing a weight, the number pad shouldn't cover the set you're editing,
  and in the exercise picker the Add button should be reachable.

Please send a screenshot of anything that looks off.

## Smoothest: paid Apple Developer account ($99/yr)

`npx eas-cli build -p ios` then TestFlight: installs like any app, updates in place, no expiry.
