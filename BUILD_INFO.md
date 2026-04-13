# Build Info — Property Enumeration Mobile App

## Current Build

| Field | Value |
|-------|-------|
| **Version** | v1.65.7 |
| **versionCode** | 165007 |
| **Build Date** | April 13, 2026 |
| **APK Size** | 8.17 MB |
| **APK URL** | https://upwork.kowope.xyz/mottainai-property-enum-v1.65.7-debug.apk |
| **Git Commit** | `523d04c` (chore: bump version to 1.65.7) |

## What Changed in v1.65.7

**Fix:** `normaliseCustomer()` in `src/api/client.ts` now correctly maps `fullName → name`.

The MongoDB `customerdatas` collection stores the customer display name as `fullName`. The previous normalisation function only checked `raw.name ?? raw.customerName`, causing the Link Customer dropdown to display phone numbers and "null" entries instead of customer names.

```ts
// Before (broken)
name: raw.name ?? raw.customerName ?? ''

// After (fixed)
name: raw.fullName ?? raw.name ?? raw.customerName ?? ''
```

## Previous Builds

| Version | Date | Key Change |
|---------|------|-----------|
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
# Deploy:
sshpass -p '1muser123456@A' scp -o StrictHostKeyChecking=no \
  app/build/outputs/apk/debug/app-debug.apk \
  root@upwork.kowope.xyz:/var/www/html/mottainai-property-enum-v{VERSION}-debug.apk
```
