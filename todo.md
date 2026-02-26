# Property Enumeration Mobile App - Development TODO

**Current Version:** v1.5.8 (Backend Developer Approved Fixes)  
**Baseline:** v1.2.0 (LOCKED)  
**Status:** READY FOR TESTING  
**Date:** February 23, 2026

---

## 🎉 v1.5.8 - Backend Developer Approved Fixes (COMPLETED - READY FOR TESTING)

### Critical Fixes Implemented (Per Backend Developer - Source of Truth)
- [x] **Fix #1:** Removed `vitePluginManusRuntime()` from vite.config.ts (was causing blank screen)
- [x] **Fix #2:** Corrected API endpoints per Backend Developer specifications:
  - Login: `/users/login` → `/api/mobile/users/login`
  - Session end: `/sessions/{id}/end` → `/sessions/end` (no ID parameter)
  - Customer search: `/customers/search?q=` → `/customers?search=`
- [x] **Fix #3:** Cleaned up project structure:
  - Removed `/server`, `/drizzle`, `/shared` directories (mobile-only app)
  - Removed tRPC, Express, Drizzle, MySQL, bcryptjs dependencies
  - Simplified package.json scripts for mobile-only deployment
  - Updated version to 1.5.8 (Build 158)
- [x] Rebuilt web assets without Manus runtime plugin
- [x] Synced to Android and built APK (7.6 MB)
- [ ] Test login with corrected endpoint
- [ ] Test session start/end functionality
- [ ] Test customer search functionality
- [ ] Create checkpoint after successful testing

### What Changed
**vite.config.ts:**
- Removed `vitePluginManusRuntime()` plugin that was inlining 501KB of JavaScript into HTML

**client/src/api/client.ts:**
- Updated login endpoint to `/api/mobile/users/login`
- Updated session end to `/sessions/end` (removed sessionId parameter)
- Updated customer search to use `search` query parameter instead of `q`

**Project Structure:**
- Removed all server-side code (Express, tRPC, Drizzle ORM, database)
- Removed 15+ unused dependencies (@trpc/*, express, drizzle-orm, mysql2, bcryptjs, jose, cookie, dotenv, superjson, streamdown)
- Simplified to pure mobile Capacitor app architecture

**package.json:**
- Version updated from 1.5.0 to 1.5.8
- Removed all server/database dependencies
- Simplified scripts: `dev` (vite), `build` (vite build), `android` (cap sync + open)
- Removed: `start`, `test`, `db:push` scripts

### Expected Results
✅ **No more blank screen** - App loads properly without inlined JavaScript  
✅ **Login works** - Correct endpoint `/api/mobile/users/login`  
✅ **Session management works** - Correct endpoints with proper parameters  
✅ **Customer search works** - Correct query parameter format (`search=` not `q=`)  

### Test Credentials
- Email: adeyadewuyi@gmail.com
- Password: 123456
- Assigned Lot: LOT-6 (G R A Ikeja)

### Coordination Flow
- **Frontend Manus AI Developer:** Implements mobile app (this project)
- **Backend Manus AI Developer:** Source of truth for API specifications
- **Project Owner:** Coordinates between both developers

---

## ❌ v1.5.7 - API Endpoint Fix Attempt (FAILED - Blank Screen)
- [x] Reverted API base URL to original
- [x] Added `/api` prefix to property-enumeration endpoints only
- ❌ Result: Blank screen (vitePluginManusRuntime issue not yet identified)

---

## ❌ v1.5.6 - API Base URL Fix Attempt (FAILED - Broke Login)
- [x] Updated API_BASE_URL to include `/api` prefix
- [x] Fixed session endpoints (HTTP 403 → should work)
- ❌ Result: Broke login endpoint (needs `/api/mobile` prefix, not just `/api`)

---

## ✅ v1.4.0 - Fetch API Implementation (COMPLETED)
- [x] Replaced Axios with native Fetch API
- [x] Implemented proper JWT token handling
- [x] Added error handling and 401 redirect
- [x] Test login on device (✅ Login working)
- [x] Create checkpoint (version: 4d13075e)

---

## ✅ v1.3.0 - Session Management API Integration (COMPLETED)
- [x] Implemented session start/end functionality
- [x] Added active session tracking
- [x] Integrated with building enumeration workflow
- [x] Added session history view
- [x] GPS location capture for session start/end

---

## ✅ v1.2.0 - Core Features (BASELINE - LOCKED)
- [x] User authentication (login/logout)
- [x] Building registration with photo upload
- [x] Customer search and linking
- [x] GPS coordinates capture
- [x] Operational lots dropdown
- [x] Basic navigation and UI

---

## 📝 Architecture Notes

**This is a mobile-only Capacitor app:**
- React 18 + Capacitor 8 + Vite 7
- Calls external REST API at https://upwork.kowope.xyz
- No backend server in this project
- No database in this project

**Do NOT add:**
- Server-side frameworks (Express, Fastify, etc.)
- Database ORMs (Drizzle, Prisma, TypeORM, etc.)
- tRPC or GraphQL servers
- Server-side authentication libraries

**Key Learnings:**
1. `vitePluginManusRuntime()` is for Manus web apps, not mobile apps
2. Login endpoint uses different prefix (`/api/mobile`) than other endpoints (`/api/property-enumeration`)
3. Always verify API endpoint specifications with Backend Developer before implementing
4. Mobile apps should not include server-side dependencies

---

## ✅ v1.5.9 - Package Name Change to Bypass Android Cache (COMPLETED)

### Issue Identified
- [x] Android showing "Mottainai Survey Admin" with default Capacitor icon
- [x] App size 12.33 MB (should be 7.6 MB)
- [x] Login screen showing v1.5.0 despite APK being v1.5.8
- [x] Android loading cached web app template instead of mobile build
- [x] WebView cache tied to package name `com.mottainai.survey.admin`

### Solution
- [x] Change package name to `com.propertyenum.mobile.v2`
- [x] Update capacitor.config.ts appId
- [x] Update android/app/build.gradle applicationId
- [x] Update AndroidManifest.xml package references
- [x] Rebuild APK v1.5.9 with new package name
- [ ] Test installation (should show "Property Enumeration" with green icon)
- [ ] Verify version shows 1.5.9 on login screen
- [ ] Test login functionality
- [ ] Create checkpoint


---

## 🗺️ v1.9.0 - Map Visualization with Building Polygons (IN PROGRESS)

### Phase 1: Setup & Dependencies ✅
- [x] Install Leaflet and react-leaflet
- [x] Install localforage for IndexedDB caching
- [x] Install @turf/turf for geospatial calculations
- [x] Add Leaflet CSS to index.html

### Phase 2: Core Models & Utilities ✅
- [x] Create BuildingPolygon TypeScript interface
- [x] Create coordinate conversion utilities (Web Mercator ↔ WGS84)
- [x] Create point-in-polygon detection (ray casting algorithm)

### Phase 3: ArcGIS Integration ✅
- [x] Create arcgisService.ts for fetching building polygons
- [x] Implement fetchPolygonsNearLocation function
- [x] Implement fetchPolygonByBuildingId function
- [x] Add ArcGIS API key and endpoint configuration

### Phase 4: Polygon Caching ✅
- [x] Create polygonCacheService.ts with IndexedDB
- [x] Implement syncPolygonsForLocation function
- [x] Implement getCachedPolygonsNearLocation function
- [x] Add cache statistics and expiry logic (7 days)
- [x] Add formatCacheAge helper function

### Phase 5: Enhanced Location Map Component ✅
- [x] Create EnhancedLocationMap.tsx with Leaflet
- [x] Add ArcGIS satellite imagery tile layer
- [x] Add ArcGIS labels overlay tile layer
- [x] Implement GPS location initialization
- [x] Add current location marker with accuracy display
- [x] Add GPS accuracy warning (> 50m threshold)
- [x] Implement polygon rendering with unique colors (15-color palette)
- [x] Add polygon tap detection and selection
- [x] Add selected location marker
- [x] Add cache info display
- [x] Add recenter button
- [x] Add loading and error states

### Phase 6: App Integration ✅
- [x] Replace SimpleLocationPicker with EnhancedLocationMap in App.tsx
- [x] Add three-zone layout (header/map/action area)
- [x] Add Back button to return to session management
- [x] Add Confirm Location button with safe-area padding
- [x] Pass selected building to BuildingForm
- [x] Auto-fill building data in BuildingForm (ID, address, zone, business name, phone)

### Phase 7: Advanced Features (IN PROGRESS)
- [x] Add building labels on polygons (showing building ID or business name)
- [x] Implement customer labels (e.g., "BuildingID-R1,R2,B1")
- [x] Add polygon label tap interactions (clickable, same as polygon)
- [x] Implement green labels for occupied buildings vs blue for empty
- [ ] Add building info popup with duplicate detection
- [ ] Fetch existing customers from backend API
- [ ] Add reverse geocoding for address lookup

### Phase 8: Backend Integration (TODO)
- [ ] Create backend endpoint: GET /api/property-enumeration/buildings/check?buildingId=B001
- [ ] Create backend endpoint: GET /api/property-enumeration/customers?buildingId=B001
- [ ] Add polygon_geometry column to buildings table
- [ ] Add label column to customers table (R1, R2, B1, etc.)
- [ ] Update building creation to save polygon geometry
- [ ] Update customer creation to generate and save labels

### Phase 9: Testing & Polish (TODO)
- [ ] Test map in browser (dev server)
- [ ] Test on Android device with real GPS
- [ ] Test polygon tap detection accuracy
- [ ] Test offline caching functionality
- [ ] Test with 1000+ polygons for performance
- [ ] Test safe-area layout on devices with navigation bar
- [ ] Add loading skeleton for polygon sync
- [ ] Optimize polygon rendering for large datasets
- [ ] Add error handling for ArcGIS API failures

### Phase 10: APK Build & Deployment (IN PROGRESS)
- [x] Update version to 1.9.0 in package.json
- [x] Update version in android/app/build.gradle
- [x] Create BUILD_INSTRUCTIONS.md with testing checklist
- [ ] Build APK: npm run build && npx cap sync && cd android && ./gradlew assembleDebug
- [ ] Test APK on physical device
- [ ] Verify map loads correctly in WebView
- [ ] Verify polygons render correctly
- [ ] Verify GPS location works
- [ ] Save checkpoint and create release notes

### Known Issues
- TypeScript library errors (lib.esnext.d.ts not found) - Does not affect runtime, app compiles successfully
- Need to test polygon rendering performance with large datasets
- Need to implement customer label fetching from backend

### Next Steps
1. Test map visualization in browser
2. Implement building labels on polygons
3. Add customer label fetching
4. Create backend endpoints for duplicate detection
5. Test on Android device
6. Build and deploy APK v1.9.0
