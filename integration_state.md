# Integration State — Property Enumeration Mobile App

**Last Updated:** April 9, 2026
**Current Version:** v1.64.4 (versionCode 185)
**GitHub Repo:** https://github.com/mottainai-devops/propertyenumeration
**Backend API Base:** https://upwork.kowope.xyz
**Latest Build:** Build #185 ✅ (April 9, 2026)
**Joint API Contract:** v1.2.0 ✅ Signed off by both teams (March 6, 2026)

> **Consolidation Note (April 9, 2026):** The `mottainaisurvey/old-survey-web-app` repository has been archived and is no longer active. The authoritative backend is `mottainai-devops/mottainai-platform-backend` (https://upwork.kowope.xyz). All integration work targets that repo exclusively.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Native wrapper | Capacitor 6 (Android) |
| Map | Leaflet + React-Leaflet |
| Polygon source | ArcGIS REST Feature Service (`Nigeria_Building_Footprints`) |
| Polygon cache | IndexedDB (polygonCacheService.ts) |
| Offline queue | localStorage (user-scoped keys as of v1.55.0) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| HTTP client | CapacitorHttp / OkHttp (src/api/nativeHttp.ts + client.ts) |
| Notifications | @capacitor/local-notifications@8.0.1 |

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

## Completed Features (v1.0 → v1.64.4)

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
- [x] Start session: captures GPS, calls `POST /property-enumeration/sessions`
- [x] Map centred on lot geographic area when starting enumeration (v1.64.x)
- [x] End session: captures GPS, calls `POST /property-enumeration/sessions/:id/end`
- [x] Session summary modal on end
- [x] Active session persisted in localStorage (`activeSession`)
- [x] Daily target input with progress ring (localStorage-persisted)
- [x] "Clear Surveyed History" button (two-step confirmation)
- [x] Session dashboard with stats cards (buildings, photos, duration)

### Session History Screen
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

### Building Edit Screen
- [x] Bottom-sheet modal opened from expanded card in BuildingsList
- [x] Edit: address, building name, property type, number of units, notes
- [x] Calls `PATCH /property-enumeration/buildings/:id`
- [x] Read-only display: lot code, GPS coordinates, photo count, created date
- [x] Inline error display; saving spinner
- [x] Photo management section — shows existing photos, "Add Photos" button opens BuildingPhotoUpload

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

## Version History (v1.56.0 → v1.64.4)

| Version | Build | Key Change |
|---------|-------|-----------|
| v1.56.0 | 119 | Session start URL corrected; user-scoped localStorage keys |
| v1.57.16 | — | Joint API Contract v1.2.0 signed off |
| v1.58.3 | — | Last version before ArcGIS migration work |
| v1.62.0 | — | ArcGIS Customer Layer in bottom sheet; green polygons for customer buildings |
| v1.63.0 | — | Auto-resolve lotCode from ArcGIS polygon Zone |
| v1.64.0 | — | Switch to `Nigeria_Building_Footprints` layer; remove Web Mercator conversion |
| v1.64.4 | 185 | feat: improve map UX — declutter labels, merge toolbar, floating legend, GPS dot, smaller FABs, zoom hint, better selection highlight |

---

## API Endpoints Wired

| Method | Path | Used in |
|--------|------|---------|
| `POST` | `/api/mobile/users/login` | Login screen |
| `POST` | `/property-enumeration/buildings` | BuildingForm (create) |
| `GET` | `/property-enumeration/buildings` | BuildingsList |
| `PATCH` | `/property-enumeration/buildings/:id` | BuildingEdit |
| `POST` | `/property-enumeration/buildings/:id/photos` | BuildingPhotoUpload |
| `POST` | `/property-enumeration/sessions` | SessionManagement |
| `POST` | `/property-enumeration/sessions/:id/end` | SessionManagement |
| `GET` | `/property-enumeration/sessions` | SessionHistory |
| `GET` | `/property-enumeration/sessions/:id` | (available, not yet used in UI) |
| `GET` | `/property-enumeration/sessions/:id/buildings` | BuildingsList (session drill-down) |
| `DELETE` | `/property-enumeration/buildings/:id/photos/:ref` | BuildingEdit (delete photo) |
| `GET` | `/property-enumeration/sessions/statistics` | SessionStatistics |
| `GET` | `/api/property-enumeration/customers` | BuildingForm step 2 (search) |
| `POST` | `/api/property-enumeration/customers/:id/link` | BuildingForm step 2 |
| `DELETE` | `/api/property-enumeration/customers/:id/unlink` | BuildingsList (unlink button) |
| `POST` | `/api/property-enumeration/customers/bulk` | CustomerImport (JSON bulk import) |

---

## Known Issues

| Issue | Status | Workaround |
|-------|--------|-----------|
| `surveyedBuildingIds` and `serverSessionId` shared across users on same device | ✅ Fixed v1.56.0 | User-scoped keys |
| Admin user (`admin@admin.com`) has `company: null` in database | Open (backend) | Assign admin to a company or allow admin role to bypass company requirement |
| Users with ObjectId `companyId` (not string code) see empty session lists | Open (backend) | One-time data migration to replace ObjectId with string company code |
| Bundle size 893 KB (unminified) | Open | Consider lazy-loading Leaflet and ArcGIS service |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main routing, screen state machine, session + building handlers |
| `src/api/client.ts` | CapacitorHttp client + all typed API methods and interfaces |
| `src/components/EnhancedLocationMapWithPolygons.tsx` | Map, polygon layer, search, GPS badge, auto-select |
| `src/components/LocationPickerWithMap.tsx` | Location screen wrapper, building confirmation card |
| `src/components/BuildingForm.tsx` | 2-step registration form, photo capture, offline queue |
| `src/components/BuildingEdit.tsx` | Edit building bottom-sheet with photo management |
| `src/components/BuildingPhotoUpload.tsx` | Photo upload overlay for existing buildings |
| `src/components/BuildingsList.tsx` | Buildings list with server fetch, expand panel, edit, unlink, pagination |
| `src/components/SessionManagement.tsx` | Session dashboard, daily target, clear history |
| `src/components/SessionStatistics.tsx` | Stats screen, chart, CSV export, share |
| `src/components/SessionHistory.tsx` | Past sessions list with empty state message |
| `src/components/OfflineQueue.tsx` | Offline queue panel with GPS + photo count badges |
| `src/components/CustomerImport.tsx` | CSV template download, file upload, preview, bulk import result |
| `src/services/arcgisService.ts` | ArcGIS `Nigeria_Building_Footprints` polygon fetch |
| `src/services/polygonCacheService.ts` | IndexedDB polygon cache |

---

## Ecosystem Reference

For the full project ecosystem overview, see:
`mottainai-platform-backend/docs/MOTTAINAI_ECOSYSTEM_OVERVIEW.md`

For the authoritative API contract, see:
`JointAPIContract—MottainaiPropertyEnumerationSystem.md` (v1.2.0)

For GIS layer migration details, see:
`mottainai-platform-backend/docs/GIS_LAYER_MIGRATION_NOTICE.md`
