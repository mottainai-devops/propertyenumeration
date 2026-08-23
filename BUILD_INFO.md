# Build Info — Property Enumeration Mobile App

## Current Verified Build

| Field | Value |
|-------|-------|
| **Release identity** | Build #211 — restored June Build #209 baseline + ArcGIS public-map fix |
| **Baseline** | `f92f939` — June Build #209 / v3.5.0 customer-ID composite UX |
| **Hotfix commit** | `1b97fd5` — preserve June design and remove invalid ArcGIS map token |
| **Baseline package version** | v1.65.8 |
| **Build date** | August 23, 2026 |
| **Artifact** | `app-debug-v211` (GitHub Actions) |
| **Artifact size** | 6,816,673 bytes |
| **Artifact SHA-256** | `ac26bdf54350c59eec266ca659ccca78ceef9b626c976c48c5632f399deb9f0e` |
| **Workflow run** | https://github.com/mottainai-devops/propertyenumeration/actions/runs/32626247832 |
| **Acceptance** | Confirmed working on a field device: June design, login, and map flow |
| **Production download status** | Not copied to `/var/www/html`; distribution remains approval-gated |

## What Changed in Build #211

**Release recovery:** Build #210 was generated from a regressed `master` line that had reverted significant June functionality and UI. Build #211 starts from the known-good June Build #209 commit and applies only the required ArcGIS public-map correction.

**ArcGIS correction:** All public map-read flows omit the invalid static token. `npm run verify:arcgis` confirms that public map-read code does not send a token and that the live `Nigeria_Building_Footprints` service returns a valid count response.

**Login correction:** The production `/api/mobile/users` Nginx route no longer adds duplicate CORS headers. A browser/WebView-visible synthetic login now receives the expected authentication response rather than a false connection error. This server-only correction does not require an APK rebuild.

## Previous Builds

| Version | Date | Key Change |
|---------|------|-----------|
| Build #209 | June 11, 2026 | ArcGIS-native Customer ID composite and the working June design baseline |
| Build #210 | August 12, 2026 | Regressed `master` line; do not distribute |
| Build #211 | August 23, 2026 | Restored Build #209 baseline plus ArcGIS public-map token fix; verified on-device |
| v1.65.6 | April 13, 2026 | Backend: added all `/api/property-enumeration/*` routes (were missing — caused "Pending Retry" on all buildings) |
| v1.65.5 | ~April 12, 2026 | Fix base URL (was hardcoded `http://172.232.24.180:3000`) |
| v1.64.4 | April 9, 2026 | Map UX improvements — declutter labels, merge toolbar, floating legend |
| v1.64.0 | April 9, 2026 | Switch to `Nigeria_Building_Footprints` ArcGIS layer |

## Build Process

```bash
# From /home/ubuntu/propertyenumeration:
npm run build
npx cap sync android
# IMPORTANT: cap sync resets capacitor.build.gradle to VERSION_21; patch it:
sed -i 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' \
  android/app/capacitor.build.gradle \
  android/capacitor-cordova-android-plugins/build.gradle
cd android && ./gradlew assembleDebug
# Approval-gated production download-directory deployment:
scp -o StrictHostKeyChecking=yes \
  app/build/outputs/apk/debug/app-debug.apk \
  root@upwork.kowope.xyz:/var/www/html/mottainai-property-enum-v{VERSION}-debug.apk
```
