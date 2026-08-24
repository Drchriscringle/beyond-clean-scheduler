# Mobile app (iOS / Android)

The game is wrapped with [Capacitor](https://capacitorjs.com), so the same React/Vite
codebase ships as a native app on both stores. The `android/` and `ios/` folders are
native project shells that load the built web app (`dist/`) inside a WebView — there's
no separate mobile codebase to maintain.

## Real club names: resolved

Every club across all 16 divisions is now fully fictional — invented names,
grounds and stand names, generated per-nation so the flavour still fits (e.g.
Portuguese-sounding names for the Primeira Liga, German for the Bundesliga).
Player names were already fictionalized before this. Nothing in the shipped
game trades on a real club's identity anymore.

## Rebuilding after a code change

```
npm run cap:android   # builds the web app, syncs it into android/, opens Android Studio
npm run cap:ios       # builds the web app, syncs it into ios/, opens Xcode
```

Or just `npm run cap:sync` to sync both without opening an IDE.

## What you need locally (I can't do this from this sandbox)

- **Android**: [Android Studio](https://developer.android.com/studio) (includes the
  SDK). Open `android/` in it, or run `npm run cap:android`.
- **iOS**: a Mac with [Xcode](https://developer.apple.com/xcode/) installed —
  there's no way around this, Apple only allows iOS builds/signing on macOS. Open
  `ios/App/App.xcworkspace` in Xcode, or run `npm run cap:ios`.

## Google Play

1. In Android Studio: **Build → Generate Signed Bundle/APK**, choose Android App
   Bundle (`.aab`), create/use a keystore (keep it safe — you need the same one for
   every future update).
2. Create a [Google Play Console](https://play.google.com/console) account
   ($25 one-time fee).
3. Create the app listing: title, description, screenshots (phone + optionally
   tablet), a feature graphic, icon, content rating questionnaire, privacy policy
   URL (required even for a simple game — a static page saying what data you do/don't
   collect is enough if there's no backend).
4. Upload the `.aab` to a testing or production track and submit for review.

## Apple App Store

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/)
   ($99/year).
2. In Xcode: set your Team, a unique Bundle Identifier (`capacitor.config.json`'s
   `appId` — currently `com.retropremiermanager.app` — change this if you want
   something else, then re-run `npx cap sync`), and app icons (Xcode's asset
   catalog under `ios/App/App/Assets.xcassets`).
3. **Product → Archive**, then use the Organizer to upload to App Store Connect.
4. In [App Store Connect](https://appstoreconnect.apple.com): create the listing
   (screenshots for each required device size, description, privacy policy URL,
   age rating, pricing), attach the uploaded build, submit for review.

## App icon & splash screen

Capacitor's asset generator can produce every required icon/splash size from one
source image:

```
npm install --save-dev @capacitor/assets
npx capacitor-assets generate
```

Put a 1024×1024 `icon.png` (and optionally a `splash.png`) in an `assets/` folder
at the project root first — see the
[capacitor-assets docs](https://github.com/ionic-team/capacitor-assets) for exact
file names/sizes.

## Offline play

The app currently loads fonts from Google Fonts over the network. It'll still run
without a connection (falls back to a system font), but for a fully offline app,
self-host the two font files instead of linking `fonts.googleapis.com`.
