# Property Enumeration Mobile App - Development TODO

**Current Version:** v2.0.0 (Complete App Identity Reset)  
**Baseline:** v1.2.0 (LOCKED)  
**Status:** BUILDING v2.0.0  
**Date:** February 23, 2026

---

## 🚀 v2.0.0 - Complete App Identity Reset (IN PROGRESS)

### Issue: Persistent Android Caching
- Android showing "Mottainai Survey Admin" even after ADB force install
- App crashes immediately on launch
- WebView cache persists despite:
  - Changing package name (v1.5.9: com.propertyenum.mobile.v2)
  - Clearing app storage/cache
  - Clearing System WebView cache
  - Uninstalling and reinstalling
  - ADB force install with -r flag

### Root Cause Analysis
Android is associating new installations with old cached data based on:
- App signing certificate
- App name metadata
- WebView cache tied to multiple identifiers beyond just package name

### Solution: Complete App Identity Reset
- [ ] Change package name to `io.propertyenum.field.app` (completely different format)
- [ ] Change app name to "Field Enumeration" (completely different name)
- [ ] Add programmatic WebView cache clearing on app startup
- [ ] Add version check to detect and clear old cached data
- [ ] Update version to 2.0.0 (Build 200)
- [ ] Build APK and install via ADB
- [ ] Verify app shows "Field Enumeration" (not "Mottainai Survey Admin")
- [ ] Verify version shows 2.0.0 on login screen
- [ ] Test complete workflow (login → session → building → customer)

---

## ✅ v1.5.9 - Package Name Change Attempt (COMPLETED - FAILED)
- [x] Changed package name to `com.propertyenum.mobile.v2`
- [x] Built APK v1.5.9 (Build 159)
- [x] Installed via ADB force install
- ❌ Result: Still shows "Mottainai Survey Admin" and crashes

---

## ✅ v1.5.8 - Backend Developer Approved Fixes (COMPLETED)

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
5. Android WebView caching is extremely aggressive and tied to multiple identifiers
6. Package name changes alone are insufficient to bypass Android cache
7. Complete app identity reset (package name + app name + cache clearing) required

---

## Test Credentials
- Email: adeyadewuyi@gmail.com
- Password: 123456
- Assigned Lot: LOT-6 (G R A Ikeja)

---

## Coordination Flow
- **Frontend Manus AI Developer:** Implements mobile app (this project)
- **Backend Manus AI Developer:** Source of truth for API specifications
- **Project Owner:** Coordinates between both developers
