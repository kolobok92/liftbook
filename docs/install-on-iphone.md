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

## Troubleshooting

- **"AltServer could not sign in with your Apple ID" (-80045 / -80046), October 2026:** Apple
  changed its sign-in and every free sideloading tool (AltStore, SideStore, Sideloadly,
  iLoader) broke at once; it's not the .ipa or your PC. Wait for an AltServer update
  ([altstoreio/AltStore#1840](https://github.com/altstoreio/AltStore/issues/1840)). Don't
  delete AltStore or Liftbook meanwhile: the installed app keeps working until its 7-day
  signing runs out.
- **Moving from an install with a different app id** (before `io.liftbook.app`): the new one
  installs next to it. Old app → Profile → **Backup**, new app → Profile → **Restore**, then
  delete the old one.

## What to try

- **Logging (Boostcamp-style):** start the Push day. Fields start blank; the Previous column
  shows last time. Tap a set's circle to log last time's numbers in one tap, or tap a field to
  type on the in-app keypad (Next walks weight → reps → next set; RPE tab for RPE). Each set
  below hints the set above's numbers in grey, so the next circle is one tap. Checking a set
  doesn't move or open anything; a finished exercise folds to "✓ name".
- **Current set:** the orange pill + circle marks the set you're on; it follows you if you do
  exercises out of order.
- **Supersets:** ••• → Superset with… → pick any exercise. It becomes one card with a tab per
  exercise that flips to the set you're due (A1 → B1 → A2).
- **Notes:** an exercise's note (e.g. machine settings) carries into the next session by itself.
- **Live Activity:** start a workout and lock the phone. The lock screen shows the exercise
  you're on (with its photo), "Set 1 of 4 (5–8 reps)" and a clock counting up; with a Dynamic
  Island, swipe home to see the clock in the island. Pause in the app → "Paused" with a progress
  bar. Finish → the card ends. Tapping it opens the workout. If nothing appears: Settings →
  Liftbook → **Live Activities** must be on.
- **Light mode:** Profile → Appearance → System / Light / Dark; "System" follows the phone.

Please send a screenshot of anything that looks off.

## Smoothest: paid Apple Developer account ($99/yr)

`npx eas-cli build -p ios` then TestFlight: installs like any app, updates in place, no expiry.
