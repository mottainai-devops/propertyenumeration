# Integration State — Property Enumeration Mobile App

**Last Updated:** August 23, 2026
**Current Release Baseline:** June Build #209 UI/design (`f92f939`) plus Build #211 public-map token fix (`1b97fd5`)
**GitHub Repo:** https://github.com/mottainai-devops/propertyenumeration
**Backend Repo:** https://github.com/mottainai-devops/mottainai-platform-backend
**Backend API Base:** https://upwork.kowope.xyz
**Latest Verified APK:** GitHub Actions Build #211 artifact `app-debug-v211` (6,816,673 bytes; SHA-256 `ac26bdf54350c59eec266ca659ccca78ceef9b626c976c48c5632f399deb9f0e`)
**Artifact Run:** https://github.com/mottainai-devops/propertyenumeration/actions/runs/32626247832
**Production Download Status:** Build #211 is verified on-device but is not copied into `/var/www/html`; the older production-hosted APK must not be treated as the current release.
**Joint API Contract:** v1.2.0 ✅ Signed off by both teams (March 6, 2026)

> **Consolidation Note (April 9, 2026):** The `mottainaisurvey/old-survey-web-app` repository has been archived and is no longer active. The authoritative backend is `mottainai-devops/mottainai-platform-backend` (https://upwork.kowope.xyz). All integration work targets that repo exclusively.

---

## Verified Release State — Build #211

Build #210 was produced from a regressed `master` line (`package.json` version 1.24.0) and did not retain the working June design. The correct recovery was to begin from the successful June Build #209 commit `f92f939` on `main`, which preserves the current customer-ID composite, building-card, map, session, and form UX.

| Item | Verified state |
|-------|----------------|
| Restored UX baseline | June Build #209, commit `f92f939` — `feat(identity): display ArcGIS-native Customer ID composite in building cards (v3.5.0)` |
| Token-only follow-up | Commit `1b97fd5` — `fix: preserve June design and remove invalid ArcGIS map token` |
| Android build | GitHub Actions Build #211 — passed on August 23, 2026 in 2m 52s |
| Map verification | Anonymous ArcGIS public-map regression query passed with 2,475,494 footprint records available |
| Acceptance | Field-device acceptance confirmed: June UI/design, login, and map flow working |
| Distribution | Approval-gated; Build #211 is the artifact to distribute, not the older production-hosted APK or Build #210 |

### Runtime fixes recorded

- **ArcGIS map:** Public map-read requests no longer append the invalid static ArcGIS token. The `Nigeria_Building_Footprints` layer accepts anonymous read queries; the dedicated `npm run verify:arcgis` regression script verifies both source behavior and a live count query.
- **Mobile login:** The `/api/mobile/users` Nginx location was corrected to stop adding duplicate CORS headers. Express is now the single CORS header owner. A neutral browser-origin probe receives the expected HTTP 400 authentication response for a synthetic invalid login instead of `TypeError: Failed to fetch`.
- **Data safety:** Neither fix changed enumeration sessions, user records, credentials, database data, or existing APK artifacts.

> **Follow-up boundary:** Legacy ArcGIS write-back functions remain separate from public map reads. Stale enumeration-session cleanup and Nginx duplicate-server-definition warnings remain approval-gated maintenance items; neither was changed during this release recovery.

---

## Build Method

The canonical build + deploy process (used for all versions v1.65.x):

```bash
# 1. Web assets
cd /home/ubuntu/propertyenumeration
npm run build
npx cap sync android

# 2. Local-only Java compatibility patch (cap sync resets capacitor.build.gradle to VERSION_21; this is only needed on a JDK 17 sandbox)
sed -i 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' \
  android/app/capacitor.build.gradle \
  android/capacitor-cordova-android-plugins/build.gradle

# 3. Build APK
cd android && ./gradlew assembleDebug

# 4. Approval-gated deployment to the production download directory
scp -o StrictHostKeyChecking=yes \
  app/build/outputs/apk/debug/app-debug.apk \
  root@upwork.kowope.xyz:/var/www/html/mottainai-property-enum-v{VERSION}-debug.apk
```

> **Note:** The CI GitHub Actions workflow (`.github/workflows/*.yml`) uses JDK 21, builds the web assets, syncs Capacitor, builds the debug APK, and uploads a retained GitHub Actions artifact. It does **not** deploy to the server. Server download-directory deployment remains an explicit approval-gated SCP action.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Native wrapper | Capacitor 8 (Android) |
| Map | Leaflet + React-Leaflet |
| Polygon source | ArcGIS REST Feature Service (`Nigeria_Building_Footprints`) |
| Polygon cache | IndexedDB (polygonCacheService.ts) |
| Offline queue | localStorage (user-scoped keys as of v1.55.0) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| HTTP client | CapacitorHttp / OkHttp (src/api/nativeHttp.ts + client.ts) |
| Notifications | @capacitor/local-notifications@8.0.2 |

---

## ArcGIS Layer Migration

**Migration Date:** April 9, 2026
**Old Layer:** `New_Footprints_gdb_b1422`
**New Layer:** `Nigeria_Building_Footprints`

| Parameter | Old Value | New Value |
|-----------|-----------|-----------|
| Layer Name | `New_Footprints_gdb_b1422` | `Nigeria_Building_Footprints` |
| Coordinate Fields | `Lat`, `Long` | `latitude`, `longitude` |
| `country` field | From ArcGIS attributes | Hardcoded `'Nigeria'` |

All polygon fetches, building syncs, and geo-update operations now target `Nigeria_Building_Footprints`. See `mottainai-platform-backend/docs/GIS_LAYER_MIGRATION_NOTICE.md` for the full GIS team notice.

---

## Completed Features (v1.0 → v1.65.7)

### Authentication
- [x] Login screen with email + password (base64-encoded password per backend spec)
- [x] JWT token stored in localStorage (`authToken`)
- [x] Auto-logout on token expiry / 401 response
- [x] User info (name, role, assignedLots) stored in localStorage (`userData`)

### Map & Polygon Layer
- [x] Leaflet map centred on lot geographic area at enumeration start (v1.64.x)
- [x] ArcGIS `Nigeria_Building_Footprints` polygons fetched and rendered (2000+ buildings)
- [x] 15-colour hash-based polygon colouring
- [x] Tap polygon → building confirmation card (address, business name, zone, lot code)
- [x] "Proceed with this Building" button → form auto-fill
- [x] Auto-select: if GPS lands inside a polygon on map open, card appears immediately
- [x] Search bar (building ID / business name / address) → pan + select
- [x] Building labels — decluttered, merged toolbar, floating legend (v1.64.4)
- [x] GPS dot indicator, smaller FABs, zoom hint, better selection highlight (v1.64.4)
- [x] "Already surveyed" grey polygons with ✓ prefix (persisted in localStorage)
- [x] GPS accuracy badge (amber when > 15 m)
- [x] IndexedDB polygon cache with timestamp display
- [x] Offline polygon download banner + progress toast

### Building Registration Form
- [x] 2-step form: Step 1 (details) → Step 2 (customer link)
- [x] Auto-fill: address, building name, lot code, zone from selected polygon
- [x] Property type selector (Residential / Commercial / Industrial / Mixed-Use)
- [x] Number of units stepper
- [x] Notes field
- [x] Photo capture: up to 4 photos, canvas compression, size display
- [x] Offline queue: saves to localStorage when offline; auto-syncs on reconnect
- [x] Manual sync button in offline queue panel
- [x] `buildingId` field in `CreateBuildingRequest` (ArcGIS polygon ID)

### Session Management
- [x] Start session: captures GPS, calls `POST /api/property-enumeration/sessions/start`
- [x] Map centred on lot geographic area when starting enumeration (v1.64.x)
- [x] End session: captures GPS, calls `POST /api/property-enumeration/sessions/:id/end`
- [x] Session summary modal on end
- [x] Active session persisted in localStorage (`activeSession`)
- [x] Daily target input with progress ring (localStorage-persisted)
- [x] "Clear Surveyed History" button (two-step confirmation)
- [x] Session dashboard with stats cards (buildings, photos, duration)

### Session History Screen
- [x] Calls `GET /api/property-enumeration/sessions` to list past sessions
- [x] Shows date, duration, building count per session
- [x] Tap to expand session details (lot code, start/end time, areas covered)
- [x] Empty state message with administrator contact guidance (v1.52.0+)

### Statistics Screen
- [x] Calls `GET /api/property-enumeration/sessions/statistics` for server-side data
- [x] Property type horizontal bar chart
- [x] Lot breakdown table
- [x] Total photos stat
- [x] Daily target progress ring
- [x] Export CSV (building ID, address, name, lot, type, units, GPS, zone, notes, timestamp, sync status, photo count)
- [x] Share Report button (Web Share API → Android native share sheet; CSV fallback)
- [x] Sync All banner when online + pending buildings exist

### Buildings List Screen
- [x] Calls `GET /api/property-enumeration/buildings` (server, all sessions/devices)
- [x] Merges server buildings + local synced + pending queue
- [x] Refresh button with loading skeleton
- [x] Server error banner (falls back to local data)
- [x] Search by address / building name / lot code
- [x] Filter tabs: All / Residential / Commercial / Industrial / Mixed-Use / Pending
- [x] Pending count badge on filter tab
- [x] Photo thumbnail on card
- [x] Synced / Pending status badge
- [x] Tap to expand detail panel: photo gallery, GPS, notes, customer link, action buttons
- [x] Infinite scroll pagination (20 per page, IntersectionObserver sentinel)
- [x] Deduplication of offline/synced buildings (v1.53.0+)

### Building Edit Screen
- [x] Bottom-sheet modal opened from expanded card in BuildingsList
- [x] Edit: address, building name, property type, number of units, notes
- [x] Calls `PATCH /api/property-enumeration/buildings/:id`
- [x] Read-only display: lot code, GPS coordinates, photo count, created date
- [x] Inline error display; saving spinner
- [x] Photo management section — shows existing photos, "Add Photos" button opens BuildingPhotoUpload

### Photo Upload
- [x] BuildingPhotoUpload component — bottom-sheet overlay
- [x] Shows existing photos + new photo previews in 3-column grid
- [x] Image compression (canvas, 1280px max, 75% JPEG quality) before upload
- [x] Calls `POST /api/property-enumeration/buildings/:id/photos` (multipart/form-data)
- [x] Enforces max 4 photos per building (slot counter)
- [x] Per-photo remove button before upload
- [x] Upload progress indicator; error display

### Customer Link / Search (v1.65.7)
- [x] "Link Customer" panel in BuildingsList expanded card
- [x] Debounced search calls `GET /api/property-enumeration/customers/search?q=`
- [x] Results display customer **name** (from `fullName` DB field) + phone as subtitle
- [x] Select result → calls `POST /api/property-enumeration/customers/:id/link`
- [x] Linked customer name shown on building card
- [x] "Unlink" button → calls `DELETE /api/property-enumeration/customers/:id/unlink`
- [x] Optimistic local state update on link/unlink

### Customer Bulk Import
- [x] CSV template download (data URI anchor for Android WebView reliability, v1.55.0)
- [x] CSV file upload + local parsing + validation preview
- [x] JSON bulk import via `/api/property-enumeration/customers/bulk` (v1.50.0+)
- [x] Import result summary (created, updated, failed counts)
- [x] Admin/cherry_picker/superadmin role gating

### Data Isolation & Multi-User Support
- [x] Per-user localStorage keys for `pendingBuildings` and `recentBuildings` (scoped by userId, v1.55.0)
- [x] One-time migration on first launch to move existing unscoped data to user-scoped keys
- [x] Prevents cross-account data leakage on shared devices

---

## Version History (v1.56.0 → v1.65.7)

| Version | Key Change |
|---------|-----------|
| v1.56.0 | Session start URL corrected; user-scoped localStorage keys |
| v1.57.16 | Joint API Contract v1.2.0 signed off |
| v1.58.3 | Last version before ArcGIS migration work |
| v1.62.0 | ArcGIS Customer Layer in bottom sheet; green polygons for customer buildings |
| v1.63.0 | Auto-resolve lotCode from ArcGIS polygon Zone |
| v1.64.0 | Switch to `Nigeria_Building_Footprints` layer; remove Web Mercator conversion |
| v1.64.4 | Improve map UX — declutter labels, merge toolbar, floating legend, GPS dot, smaller FABs, zoom hint |
| v1.65.5 | Fix base URL (was hardcoded `http://172.232.24.180:3000`; corrected to `https://upwork.kowope.xyz`) |
| v1.65.6 | **Backend fix:** Add all `/api/property-enumeration/*` routes to server.js (were missing `/api/` prefix — caused all buildings to queue as "Pending Retry" and customer search to return empty) |
| v1.65.7 | **Frontend fix:** `normaliseCustomer()` now maps `fullName → name` (DB stores name as `fullName`; old code showed phone numbers/null in Link Customer dropdown) |

---

## API Endpoints Wired

All endpoints use the `/api/` prefix. Endpoints without `/api/` prefix (legacy) also exist on the server for backward compatibility but are not used by the app.

| Method | Path | Used in |
|--------|------|---------|
| `POST` | `/api/mobile/users/login` | Login screen |
| `GET` | `/api/mobile/users/me` | Auth refresh |
| `POST` | `/api/property-enumeration/buildings` | BuildingForm (create) |
| `GET` | `/api/property-enumeration/buildings` | BuildingsList |
| `GET` | `/api/property-enumeration/buildings/:id` | BuildingsList (single) |
| `PATCH` | `/api/property-enumeration/buildings/:id` | BuildingEdit |
| `POST` | `/api/property-enumeration/buildings/:id/photos` | BuildingPhotoUpload |
| `DELETE` | `/api/property-enumeration/buildings/:id/photos/:ref` | BuildingEdit (delete photo) |
| `POST` | `/api/property-enumeration/sessions/start` | SessionManagement |
| `POST` | `/api/property-enumeration/sessions/:id/end` | SessionManagement |
| `POST` | `/api/property-enumeration/sessions/end` | SessionManagement (body-id variant) |
| `GET` | `/api/property-enumeration/sessions` | SessionHistory |
| `GET` | `/api/property-enumeration/sessions/:id` | (available, not yet used in UI) |
| `GET` | `/api/property-enumeration/sessions/:id/buildings` | BuildingsList (session drill-down) |
| `GET` | `/api/property-enumeration/sessions/statistics` | SessionStatistics |
| `GET` | `/api/property-enumeration/customers/search?q=` | BuildingsList (Link Customer search) |
| `GET` | `/api/property-enumeration/customers` | (list, fallback) |
| `POST` | `/api/property-enumeration/customers/:id/link` | BuildingsList (link customer) |
| `DELETE` | `/api/property-enumeration/customers/:id/unlink` | BuildingsList (unlink button) |
| `POST` | `/api/property-enumeration/customers/bulk` | CustomerImport (JSON bulk import) |

---

## Backend Route Notes (server.js — mottainai-platform-backend)

The following was fixed on April 13, 2026 (commit: `feat: add /api/property-enumeration/* routes`):

- All `/api/property-enumeration/*` routes were **missing** from `server.js`. The app was calling them but getting 404 responses from the Nginx SPA catch-all, causing buildings to queue as "Pending Retry" indefinitely and customer search to return empty results.
- **16 new routes** were added under the `/api/property-enumeration/` prefix.
- Two server-side helpers were added: `extractUserIdFromToken()` (decodes Bearer JWT) and `getCompanyIdForUser()` (looks up `companyId` from DB since JWT does not include it).
- Legacy routes (`/property-enumeration/buildings` without `/api/`) retained for backward compatibility.

---

## Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| `surveyedBuildingIds` and `serverSessionId` shared across users on same device | ✅ Fixed v1.56.0 | User-scoped keys |
| Buildings stuck as "Pending Retry" (all API calls 404) | ✅ Fixed v1.65.6 | Backend: added `/api/property-enumeration/*` routes |
| Customer search showing phone numbers / "null" instead of names | ✅ Fixed v1.65.7 | Frontend: `normaliseCustomer()` maps `fullName → name` |
| Admin user (`admin@admin.com`) has `company: null` in database | Open (backend) | Assign admin to a company or allow admin role to bypass company requirement |
| Users with ObjectId `companyId` (not string code) see empty session lists | Open (backend) | One-time data migration to replace ObjectId with string company code |
| Bundle size ~984 KB (unminified) | Open | Consider lazy-loading Leaflet and ArcGIS service |
| `capacitor.build.gradle` reset to `VERSION_21` on every `cap sync` | Known (build env) | Always run `sed -i 's/VERSION_21/VERSION_17/g'` after `cap sync` (sandbox JDK is 17) |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main routing, screen state machine, session + building handlers |
| `src/api/client.ts` | CapacitorHttp client + all typed API methods, interfaces, and normalisation functions |
| `src/api/nativeHttp.ts` | CapacitorHttp adapter (mirrors axios interface) |
| `src/components/EnhancedLocationMapWithPolygons.tsx` | Map, polygon layer, search, GPS badge, auto-select |
| `src/components/LocationPickerWithMap.tsx` | Location screen wrapper, building confirmation card |
| `src/components/BuildingForm.tsx` | 2-step registration form, photo capture, offline queue |
| `src/components/BuildingEdit.tsx` | Edit building bottom-sheet with photo management |
| `src/components/BuildingPhotoUpload.tsx` | Photo upload overlay for existing buildings |
| `src/components/BuildingsList.tsx` | Buildings list with server fetch, expand panel, edit, link/unlink customer, pagination |
| `src/components/SessionManagement.tsx` | Session dashboard, daily target, clear history |
| `src/components/SessionStatistics.tsx` | Stats screen, chart, CSV export, share |
| `src/components/SessionHistory.tsx` | Past sessions list with empty state message |
| `src/components/OfflineQueue.tsx` | Offline queue panel with GPS + photo count badges |
| `src/components/CustomerImport.tsx` | CSV template download, file upload, preview, bulk import result |
| `src/services/arcgisService.ts` | ArcGIS `Nigeria_Building_Footprints` polygon fetch |
| `src/services/polygonCacheService.ts` | IndexedDB polygon cache |
| `android/app/build.gradle` | versionCode / versionName — bump both for every release |
| `android/app/capacitor.build.gradle` | Auto-generated by `cap sync`; always patch VERSION_21 → VERSION_17 after sync |

---

## Ecosystem Reference

For the full project ecosystem overview, see:
`mottainai-platform-backend/docs/MOTTAINAI_ECOSYSTEM_OVERVIEW.md`

For the authoritative API contract, see:
`JointAPIContract—MottainaiPropertyEnumerationSystem.md` (v1.2.0)

For GIS layer migration details, see:
`mottainai-platform-backend/docs/GIS_LAYER_MIGRATION_NOTICE.md`
