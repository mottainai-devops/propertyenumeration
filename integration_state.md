# Integration State — Property Enumeration Mobile App

**Last Updated:** March 4, 2026  
**Current Version:** v1.56.0 (versionCode 119)  
**GitHub Repo:** https://github.com/mottainai-devops/propertyenumeration  
**Backend API Base:** https://upwork.kowope.xyz  
**Latest Build:** Build #119  
**Backend Version:** v4.5.0 (ArcGIS sync bug fix)  
**Joint API Contract:** v1.0.0 ✅ Signed off by frontend team (March 4, 2026)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Native wrapper | Capacitor 6 (Android) |
| Map | Leaflet + React-Leaflet |
| Polygon source | ArcGIS REST Feature Service |
| Polygon cache | IndexedDB (polygonCacheService.ts) |
| Offline queue | localStorage (user-scoped keys as of v1.55.0) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| HTTP client | CapacitorHttp / OkHttp (src/api/nativeHttp.ts + client.ts) |
| Notifications | @capacitor/local-notifications@8.0.1 |

---

## Completed Features (v1.0 → v1.55.0)

### Authentication
- [x] Login screen with email + password (base64-encoded password per backend spec)
- [x] JWT token stored in localStorage (`authToken`)
- [x] Auto-logout on token expiry / 401 response
- [x] User info (name, role, assignedLots) stored in localStorage (`userData`)

### Map & Polygon Layer
- [x] Leaflet map centred on user GPS at zoom 18
- [x] ArcGIS Feature Service polygons fetched and rendered (2000+ buildings)
- [x] 15-colour hash-based polygon colouring
- [x] Tap polygon → building confirmation card (address, business name, zone, lot code)
- [x] "Proceed with this Building" button → form auto-fill
- [x] Auto-select: if GPS lands inside a polygon on map open, card appears immediately
- [x] Search bar (building ID / business name / address) → pan + select
- [x] Building labels at zoom ≥ 18 (business name or building ID, truncated 18 chars)
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
- [x] `buildingId` field in `CreateBuildingRequest` (ArcGIS polygon ID, separate from notes)

### Session Management
- [x] Start session: captures GPS, calls `POST /property-enumeration/sessions/start`
- [x] End session: captures GPS, calls `POST /property-enumeration/sessions/:id/end`
- [x] Session summary modal on end
- [x] Active session persisted in localStorage (`activeSession`)
- [x] Daily target input with progress ring (localStorage-persisted)
- [x] "Clear Surveyed History" button (two-step confirmation)
- [x] Session dashboard with stats cards (buildings, photos, duration)

### Session History Screen
- [x] Accessible from session dashboard
- [x] Calls `GET /property-enumeration/sessions` to list past sessions
- [x] Shows date, duration, building count per session
- [x] Tap to expand session details (lot code, start/end time, areas covered)
- [x] Empty state message with administrator contact guidance (v1.52.0+)

### Statistics Screen
- [x] Calls `GET /property-enumeration/sessions/statistics` for server-side data
- [x] Property type horizontal bar chart
- [x] Lot breakdown table
- [x] Total photos stat
- [x] Daily target progress ring
- [x] Export CSV (building ID, address, name, lot, type, units, GPS, zone, notes, timestamp, sync status, photo count)
- [x] Share Report button (Web Share API → Android native share sheet; CSV fallback)
- [x] Sync All banner when online + pending buildings exist

### Buildings List Screen
- [x] Calls `GET /property-enumeration/buildings` (server, all sessions/devices)
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
- [x] One-time migration to clean stale recentBuildings (v1.54.0+)

### Building Edit Screen
- [x] Bottom-sheet modal opened from expanded card in BuildingsList
- [x] Edit: address, building name, property type, number of units, notes
- [x] Calls `PATCH /property-enumeration/buildings/:id`
- [x] Read-only display: lot code, GPS coordinates, photo count, created date
- [x] Inline error display; saving spinner
- [x] Photo management section — shows existing photos, "Add Photos" button opens BuildingPhotoUpload
- [x] `propertyType` normalised to title-case on save (matches backend expectation)

### Photo Upload
- [x] BuildingPhotoUpload component — bottom-sheet overlay
- [x] Shows existing photos + new photo previews in 3-column grid
- [x] Image compression (canvas, 1280px max, 75% JPEG quality) before upload
- [x] Calls `POST /property-enumeration/buildings/:id/photos` (multipart/form-data)
- [x] Enforces max 4 photos per building (slot counter)
- [x] Per-photo remove button before upload
- [x] Upload progress indicator; error display

### Customer Unlink UI
- [x] "Unlink" button shown in expanded building card when `linkedCustomerId` is present
- [x] Calls `DELETE /api/property-enumeration/customers/:customerId/unlink`
- [x] Optimistic local state update (removes link from card)
- [x] Inline error display if unlink fails

### Customer Bulk Import
- [x] CSV template download (data URI anchor for Android WebView reliability, v1.55.0)
- [x] CSV file upload + local parsing + validation preview
- [x] JSON bulk import via `/api/property-enumeration/customers/bulk` (v1.50.0+)
- [x] Import result summary (created, updated, failed counts)
- [x] Detailed error display for failed rows
- [x] Admin/cherry_picker/superadmin role gating
- [x] Stale token hint on 401 errors (logout/login refresh)
- [x] `customerType` capitalisation (Residential/Commercial)
- [x] Lot code format guidance (LOT-27 not just 27)

### Data Isolation & Multi-User Support
- [x] Per-user localStorage keys for `pendingBuildings` and `recentBuildings` (scoped by userId, v1.55.0)
- [x] One-time migration on first launch to move existing unscoped data to user-scoped keys
- [x] Prevents cross-account data leakage on shared devices
- [x] Each user on the same device has isolated queue and history

### Session & Building Scoping
- [x] Backend company scoping fixed (v4.4.0) — all 58 queries now use `req.companyId` string code
- [x] Sessions and buildings now correctly filtered by logged-in user's company
- [x] Empty session state message with administrator contact guidance
- [x] "Sync Now" button on pending buildings banner for manual sync trigger (v1.54.0)
- [x] Deduplication of offline/synced buildings (prevents "one synced, one not synced" duplicates, v1.53.0)
- [x] One-time migration on first launch to clean stale `recentBuildings` entries (v1.54.0)

### Android / Native
- [x] Transparent status bar + `SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN`
- [x] `env(safe-area-inset-top)` padding on `#root` (no header overlap)
- [x] `styles.xml`: `android:statusBarColor transparent`, `windowLayoutInDisplayCutoutMode shortEdges`
- [x] CSV export to Downloads folder via Capacitor Filesystem
- [x] Native share sheet via Web Share API

### Offline / Resilience
- [x] Offline queue (localStorage) with photo count + GPS shown in card header
- [x] Auto-sync on network reconnect
- [x] IndexedDB polygon cache (offline map browsing + search)
- [x] Offline download banner on map when cache is empty
- [x] Manual "Sync Now" button on pending buildings banner (v1.54.0)

---

## API Endpoints Wired

| Method | Path | Used in |
|---|---|---|
| POST | `/api/mobile/users/login` | Login screen |
| POST | `/property-enumeration/buildings` | BuildingForm (create) |
| GET | `/property-enumeration/buildings` | BuildingsList |
| PATCH | `/property-enumeration/buildings/:id` | BuildingEdit |
| POST | `/property-enumeration/buildings/:id/photos` | BuildingPhotoUpload |
| POST | `/property-enumeration/sessions` | SessionManagement (v1.56.0: corrected from /sessions/start) |
| POST | `/property-enumeration/sessions/:id/end` | SessionManagement |
| GET | `/property-enumeration/sessions` | SessionHistory |
| GET | `/property-enumeration/sessions/:id` | (available, not yet used in UI) |
| GET | `/property-enumeration/sessions/:id/buildings` | BuildingsList (session drill-down) |
| DELETE | `/property-enumeration/buildings/:id/photos/:ref` | BuildingEdit (delete photo) |
| GET | `/property-enumeration/sessions/statistics` | SessionStatistics |
| GET | `/api/property-enumeration/customers` | BuildingForm step 2 (search) |
| POST | `/api/property-enumeration/customers/:id/link` | BuildingForm step 2 |
| DELETE | `/api/property-enumeration/customers/:id/unlink` | BuildingsList (unlink button) |
| POST | `/api/property-enumeration/customers/bulk` | CustomerImport (JSON bulk import, v1.50.0+) |

---

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Main routing, screen state machine, session + building handlers, user-scoped localStorage (v1.55.0) |
| `src/api/client.ts` | CapacitorHttp client + all typed API methods and interfaces |
| `src/components/EnhancedLocationMapWithPolygons.tsx` | Map, polygon layer, search, GPS badge, auto-select |
| `src/components/LocationPickerWithMap.tsx` | Location screen wrapper, building confirmation card |
| `src/components/BuildingForm.tsx` | 2-step registration form, photo capture, offline queue |
| `src/components/BuildingEdit.tsx` | Edit building bottom-sheet with photo management |
| `src/components/BuildingPhotoUpload.tsx` | Photo upload overlay for existing buildings |
| `src/components/BuildingsList.tsx` | Buildings list with server fetch, expand panel, edit, unlink, pagination, deduplication (v1.53.0+) |
| `src/components/SessionManagement.tsx` | Session dashboard, daily target, clear history |
| `src/components/SessionStatistics.tsx` | Stats screen, chart, CSV export, share |
| `src/components/SessionHistory.tsx` | Past sessions list with empty state message (v1.52.0+) |
| `src/components/OfflineQueue.tsx` | Offline queue panel with GPS + photo count badges, "Sync Now" button (v1.54.0+) |
| `src/components/CustomerImport.tsx` | CSV template download (data URI, v1.55.0), file upload, preview, bulk import result |
| `src/services/arcgisService.ts` | ArcGIS Feature Service polygon fetch |
| `src/services/polygonCacheService.ts` | IndexedDB polygon cache |
| `android/app/src/main/java/com/propertyenumeration/MainActivity.java` | Transparent status bar |
| `android/app/src/main/res/values/styles.xml` | Status bar + cutout config |

---

## Known Issues & Workarounds

| Issue | Status | Workaround |
|---|---|---|
| `surveyedBuildingIds` and `serverSessionId` shared across users on same device | ✅ Fixed v1.56.0 | User-scoped keys: `surveyedBuildingIds_<userId>`, `serverSessionId_<userId>` |
| Admin user (`admin@admin.com`) has `company: null` in database | Backend | Assign admin to a company or allow admin role to bypass company requirement |
| Users with ObjectId `companyId` (not string code) see empty session lists | Backend | One-time data migration to replace ObjectId with string company code |
| Bundle size 893 KB (unminified); 229 KB gzip | Open | Consider lazy-loading Leaflet and ArcGIS service into separate chunks |
| 13 Dependabot vulnerabilities (12 high, 1 moderate) | Open | Most are Android Gradle/Java deps; Node.js audit shows zero vulnerabilities |

---

## Build History (recent)

| Build | Version | Key Changes |
|---|---|---|
| #119 | v1.56.0 | Joint API Contract v1.0.0 alignment: session start endpoint fix, photo field name fix, Industrial customerType, user-scoped surveyedBuildingIds + serverSessionId, LoginResponse interface update |
| #118 | v1.55.0 | Per-user localStorage keys (fixes cross-account data leakage); data URI CSV download (Android fix); backend v4.4.0 company scoping verified |
| #117 | v1.54.0 | One-time stale recentBuildings deduplication; "Sync Now" button; LOT-27 format hint in CSV template |
| #116 | v1.53.0 | Duplicate buildings fix (removed offline/error paths adding to both pendingBuildings and recentBuildings); CSV template download via navigator.share + blob fallback |
| #115 | v1.52.0 | Empty session state message; CSV template download fix (append to DOM); building deduplication logic |
| #114 | v1.51.0 | Backend v4.3.0 compatibility: capitalised `customerType`, normalised import result shape, stale token hint |
| #113 | v1.50.0 | JSON bulk import via `/api/property-enumeration/customers/bulk`; removed multipart CSV approach |
| #112 | v1.49.0 | Manual multipart body construction for CSV import (CapacitorHttp bypass) |
| #101 | v1.39.0 | Customer bulk import screen (CSV upload + template download + result summary); `ownerCompanyId` in login response; backend v4.2.1 company scoping |
| #100 | v1.38.0 | Add `@capacitor/local-notifications` for sync failure alerts; update Capacitor plugins to 8.1.x |
| #99 | v1.37.0 | Wire `GET /sessions/:id/buildings` for session detail drill-down; backend v4.0.0 reconciliation |

---

## Environment / Secrets

All secrets are injected automatically by the Manus platform. No `.env` file is committed.

| Key | Purpose |
|---|---|
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API (server-side) |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API URL |
| `JWT_SECRET` | Session cookie signing |
| `OAUTH_SERVER_URL` | Manus OAuth backend |
| `VITE_APP_ID` | Manus OAuth app ID |
| `VITE_APP_LOGO` | App logo URL |
| `VITE_APP_TITLE` | App title |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal (frontend) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Manus API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Manus API URL |

---

## ArcGIS Integration

- **Feature Service URL:** `https://services2.arcgis.com/mEOyXWnj8qfpS7Xo/arcgis/rest/services/...`
- **Polygon properties used:** `building_id`, `address`, `business_name`, `zone`, `lot_code`
- **Spatial query:** bounding box around current GPS ± 0.02 degrees
- **Cache:** IndexedDB via `polygonCacheService.ts`; timestamp shown on map
- **Point-in-polygon:** custom algorithm in `arcgisService.ts` for GPS auto-match

---

## Backend Reconciliation Summary (March 3, 2026)

Backend developer AI delivered v4.4.0 with all company scoping fixes verified. The following issues were resolved in v1.49.0–v1.55.0:

| Issue | Root Cause | Fix | Version |
|---|---|---|---|
| CSV import returns 403 for admin | Admin `company: null` in JWT | Backend: assign admin to company or bypass for admin role | v4.3.0 |
| Customer ID generation crashes | Static method never defined on model | Backend: replaced with inline ID generation | v4.3.0 |
| Sessions/buildings visible across companies | Queries used `req.user.companyId` (ObjectId) instead of `req.companyId` (string code) | Backend: 58 queries updated to use `req.companyId` | v4.4.0 |
| CSV template download unresponsive on Android | `navigator.share` loses gesture context in async handlers | App: switched to data URI anchor (v1.55.0) | v1.55.0 |
| Buildings appear twice (one synced, one not) | Same building added to both `pendingBuildings` and `recentBuildings` on offline save | App: removed offline/error paths from adding to `recentBuildings` (v1.53.0) | v1.53.0 |
| Cross-account data leakage on shared devices | `pendingBuildings` and `recentBuildings` keys not scoped by user | App: user-scoped keys with one-time migration (v1.55.0) | v1.55.0 |

---

## Notes for Next Session

1. Start from **v1.56.0** (Build #119) — Joint API Contract v1.0.0 fully implemented.
2. **All localStorage keys are now user-scoped** — complete cross-account isolation.
3. **Joint API Contract signed off** — see `JointAPIContract—MottainaiPropertyEnumerationSystem.md`.
4. **Next recommended work:**
   - Implement token refresh mechanism (30-day tokens mitigate urgency)
   - Customer edit/delete UI (`PATCH/DELETE /customers/:id`)
   - Session analytics/reports dashboard
   - ObjectId → string code migration for legacy users (backend task)
   - "Clear my data" option in Profile Settings
   - Add pending count badge to Offline Queue nav item
   - Per-building retry button in offline queue for failed syncs
   - Detailed import error breakdown screen (show which rows failed and why)
5. **Backend coordination:** Confirm admin user company assignment and ObjectId → string code migration for existing users.
6. **Testing checklist:** Multi-user device test (two accounts logging in/out), cross-account data isolation, pending sync on reconnect, CSV import with error rows.
