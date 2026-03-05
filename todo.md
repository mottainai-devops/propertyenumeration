# Property Enumeration Mobile App - TODO

## ✅ v1.9.9 - Working Base App (COMPLETED)
- [x] Fixed AndroidManifest usesCleartextTraffic conflict
- [x] App launches successfully
- [x] User authentication works
- [x] SimpleLocationPicker functional

---

## 🗺️ v1.10.0 - Add Map Visualization with Error Handling

### Phase 1: Add Leaflet Dependencies
- [x] Install leaflet, react-leaflet, @types/leaflet
- [x] Create ErrorBoundary component for map
- [x] Create EnhancedLocationMap component with error handling

### Phase 2: Bundle Leaflet Icons Locally
- [x] Download Leaflet marker icons to public/leaflet-icons/
- [x] Configure Leaflet to use local icon paths
- [ ] Verify icons are bundled in build output

### Phase 3: Integrate Map with Fallback
- [x] Update App.tsx to use EnhancedLocationMap
- [x] Wrap map in ErrorBoundary with SimpleLocationPicker fallback
- [ ] Test error handling locally

### Phase 4: Build and Deploy
- [x] Build web assets (753KB bundle, 206KB gzip)
- [x] Sync to Android
- [x] Update version to 1.10.0 (versionCode 1100)
- [x] Push to GitHub for automated build (Build #68 triggered)

### Phase 5: User Testing
- [ ] User tests Build #68 APK
- [ ] Verify map loads correctly
- [ ] Verify fallback works if map fails
- [ ] Confirm no crashes

---

## 🔧 v1.14.0 - Polygon Interaction Fixes (IN PROGRESS)

- [x] Fix polygon click handlers - polygons not showing building selection card when tapped
- [x] Auto-load polygons on map open (no manual refresh needed)
- [x] Set initial zoom to level 18 so buildings are large enough to tap
- [x] Make refresh and location buttons larger (52px touch targets)
- [x] Auto-fit map to polygons after loading (removed - was causing zoom-out to show all 2000 buildings)
- [x] Ensure building selection card appears when polygon is tapped

---

## 🔧 v1.15.0 - Auto-Fill Fix (IN PROGRESS)

- [x] Fix: polygon click goes directly to form without building data - need to show confirmation card first
- [x] Fix: onLocationChange must NOT navigate to form when a building is selected
- [x] Fix: "Proceed with this Building" button must pass building data (address, businessName) to form
- [x] Verify address and building name auto-fill in BuildingForm when selectedBuilding prop is set

---

## 🔧 v1.16.0 - Map UI Polish (IN PROGRESS)

- [x] Hide "None" string for Business field in building selection card
- [x] Reduce map label font size and only show labels at zoom >= 20 (labels hidden at zoom 18-19)
- [x] Remove excess whitespace below building selection card
- [x] Tighten location screen layout: smaller header, removed info box, compact padding

---

## 🔧 v1.17.0 - Polygon Labels (IN PROGRESS)

- [x] Show polygon labels at zoom >= 18 (was 20)
- [x] Label shows business name if available (not 'None'), otherwise building ID
- [x] Label text truncated at 18 chars with ellipsis
- [x] Labels remain non-interactive (pointer-events: none) so tapping the label still selects the polygon

---

## 🔧 v1.18.0 - Auto-Select, Search Bar, Surveyed Indicator (IN PROGRESS)

- [x] Auto-select building when GPS position falls inside a known polygon on map open
- [x] Show confirmation card immediately when GPS auto-match found
- [x] Search bar above map: type building ID or business name to pan and select
- [x] Search results dropdown showing up to 6 matches
- [x] Grey-out already-surveyed polygons with reduced opacity, dashed border, and checkmark label
- [x] Track surveyed buildings in localStorage (keyed by buildingId)
- [x] Pass surveyed building IDs from App.tsx down to map component

---

## 🔧 v1.19.0 - Clear History, Progress Counter, Offline Download

- [x] Add "Clear surveyed history" button in session screen to reset grey indicators
- [x] Show session progress counter in location screen header (e.g., "12 surveyed today")
- [x] Add "Download area data" button when polygon cache is empty for offline use
- [x] Show download progress indicator while fetching area polygons
- [x] Offline search and auto-select work from cached data without internet

---

## 🔧 v1.20.0 - Timestamp, CSV Export, Back Button

- [x] Show "Area data: saved Xh ago" timestamp below map
- [x] Add "Back to session" button on location screen header
- [x] Add CSV export button in Statistics screen
- [x] CSV includes building ID, address, GPS, lot code, timestamp per row
- [x] CSV downloads via browser download API (Android saves to Downloads folder)

---

## 🔧 v1.21.0 - Photo Count CSV, Sync-All Button, Property Type Chart

- [x] Add photo count column to CSV export
- [x] Add "Sync All Pending" button to Statistics screen when online and pending > 0
- [x] Add horizontal bar chart showing Residential/Commercial/Industrial breakdown
- [x] Chart uses recentBuildings + pendingBuildings data, also shows total photos in Performance section

---

## 🔧 v1.22.0 - Session API, Buildings List, Server-Side Statistics

### Session Start/End API
- [x] Call sessionApi.start() when surveyor begins enumeration (capture GPS + lot code)
- [x] Store server session ID in localStorage for subsequent calls
- [x] Add "End Session" button in SessionBanner that calls sessionApi.end() with GPS
- [x] Show session summary modal after ending (duration, buildings count, photos count)
- [x] Update session buildingsRegistered count on each successful building submission

### Buildings List Screen
- [x] New BuildingsList screen showing all buildings registered in current session
- [x] Each card shows: address, building name, property type, units, GPS, photo count, timestamp
- [x] Photo thumbnails shown on each card (first photo)
- [x] Filter by property type (All / Residential / Commercial / Industrial / Pending)
- [x] Navigate to BuildingsList from session dashboard and success screen
- [x] Add "View Registered Buildings" button to session dashboard

### Server-Side Statistics
- [x] Call sessionApi.getStatistics() in SessionStatistics screen
- [x] Show server stats: total sessions, total buildings, average per session, avg duration
- [x] Show lot breakdown table from server data
- [x] Fallback to localStorage data when offline or API fails

---

## 🔧 v1.23.0 - Safe-Area Inset Fix

- [x] viewport-fit=cover already present in index.html (confirmed)
- [x] Add padding-top: env(safe-area-inset-top) to #root in index.css
- [x] Safe-area handled at #root level - all headers inherit correct offset
- [x] safe-bottom utility class already existed; added safe-top utility class too

---

## 🔧 v1.24.0 - Daily Target, GPS Accuracy Badge, Share Report

### Daily Target Tracker
- [x] Add daily target input field to session setup screen (default 50, stepper +/-)
- [x] Store daily target in localStorage per session
- [x] Show progress ring in Statistics screen (completed / target)
- [x] Progress ring also shown in session dashboard before starting

### GPS Accuracy Warning
- [x] Monitor GPS accuracy in EnhancedLocationMapWithPolygons via watchPosition
- [x] Show amber badge when accuracy > 15m: "GPS ±Xm — wait for fix"
- [x] Badge auto-hides when accuracy improves to <= 15m

### Native Share Sheet for CSV
- [x] Add green Share button next to Export CSV in SessionStatistics header
- [x] Uses Web Share API with file sharing (Android native share sheet)
- [x] Falls back to browser download if Web Share API not available

---

## 🔧 v1.25.0 - Remaining Modules (buildingApi.list, session history, customer unlink, building edit, UI polish)

### High Priority
- [ ] Wire buildingApi.list() to BuildingsList screen (replace localStorage-only data)
- [ ] Add dedicated buildingId field to building submission (not just in notes)
- [ ] Add session history browser screen (list past sessions from sessionApi.list())
- [ ] Add customer unlink button in BuildingForm step 2
- [ ] Add building edit screen (open registered building and edit fields)

### Low Priority Polish
- [ ] Success screen: add photo thumbnails for the registered building
- [ ] Building screen header: tighten padding to match location screen
- [ ] Offline queue: show photo count and GPS per pending building
- [ ] Session end GPS: add fallback when GPS unavailable

---

## 🔧 v1.56.0 - Joint API Contract Alignment (IN PROGRESS)

### Contract Discrepancy Fixes
- [x] Fix session start endpoint: use POST /sessions (not /sessions/start)
- [x] Fix photo upload field name: use `photo` (singular) not `photos` per contract Section 3.5
- [x] Add `Industrial` to BulkCustomer.customerType union type (was missing)
- [x] Scope surveyedBuildingIds in localStorage by userId (cross-account fix)
- [x] Scope serverSessionId in localStorage by userId (cross-account fix)
- [x] Update LoginResponse interface to match contract flat user shape (companyId, ownerCompanyId at root)

### New Features (Backend Endpoints Exist)
- [x] Photo delete button in BuildingEdit photo grid (DELETE /buildings/:id/photos/:index)
- [x] Customer profile view: change password screen already existed; Clear My Data added to ProfileSettings
- [x] Session statistics: existing screen wired to /sessions/statistics endpoint (no additional changes needed)
- [x] Change password screen already existed and wired; error handling updated to use response.error per contract §6

### Documentation
- [x] Update integration_state.md with v1.56.0 changes
- [x] Sign off Joint API Contract on behalf of frontend team
- [x] Copy Joint API Contract to project directory

## 🔧 v1.56.1 - Lot Code Regression Fix

- [x] Fix LotDropdown to read from user-scoped assignedLots_<userId> key (regression from v1.56.0)
- [x] Fix App.tsx getDefaultLotCode to read from user-scoped key with backwards compatibility
- [x] Fix ProfileSettings to read from user-scoped key with backwards compatibility
- [x] Add backwards compatibility fallback to unscoped key for existing data
- [x] Rebuild and sync web assets to Android


## 🔧 v1.57.10 - Home Screen Fixes

- [x] Fix "Registered" count on home screen (reads from legacy localStorage, always shows 0 for server-session users)
- [x] Add prominent "View All Registered Buildings" button on home screen (accessible without starting a session)
- [x] Make buildings list accessible from home screen even when no active session
