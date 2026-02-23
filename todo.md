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
