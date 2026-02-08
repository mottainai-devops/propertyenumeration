# Property Enumeration Mobile App - TODO

**Current Version:** v1.3.5 (Cache Fix)  
**Baseline:** v1.2.0 (LOCKED)  
**Status:** URGENT - APK Caching Issue  
**Date:** February 8, 2026

---

## 🚨 v1.3.5 - Cache Fix (URGENT - IN PROGRESS)

### Issue: APK Not Showing New UI (Caching Problem)
- [x] Increment app version number (package.json: 1.3.5, build.gradle: versionCode 135)
- [x] Add version display to login screen ("Version 1.3.5 (Build 135)")
- [x] Clear Capacitor cache and android build directory
- [x] Rebuild APK with fresh assets (4.9 MB - clean build)
- [ ] Verify version number displays on login screen (requires device test)
- [ ] Create checkpoint

---

## ❌ v1.3.4 - Direct Fetch Test (FAILED - APK CACHING ISSUE)

### What Was Added
- [x] Added 3 diagnostic buttons to Login component
- [x] Build v1.3.4 APK (7.7 MB)
- [x] Create checkpoint (version: 206225c3)

### Result
- ❌ APK installed but showing old UI (only 1 button instead of 3)
- ❌ Capacitor/Android caching the old WebView assets

---

## ✅ v1.3.3 - Login Debugging (COMPLETED BUT ALERT NOT SHOWING)

### What Was Added
- [x] Added comprehensive error logging to Login component
- [x] Added alert() to show error messages
- [x] Build v1.3.3 APK with enhanced logging (7.7 MB)
- [x] Create checkpoint (version: a754f10f)

### Result
- ❌ Alert dialog not showing on device
- ❌ Still showing generic error message

---

## ✅ v1.3.2 - Login Failure Fix (COMPLETED BUT STILL FAILING)

### What Was Fixed
- [x] Updated Android network security config to allow upwork.kowope.xyz domain
- [x] Disabled cleartext traffic for production (HTTPS only)
- [x] Build v1.3.2 APK with fix (7.7 MB)
- [x] Create checkpoint (version: 8d33e6bc)

### Result
- ❌ Login still failing on device

---

## ✅ v1.3.1 - Critical Fixes (COMPLETED)

### Issue #1: Wrong API Base URL (BLOCKER)
- [x] Change API base URL from `http://172.232.24.180:3003` to `https://upwork.kowope.xyz`
- [x] Verify HTTPS protocol (not HTTP)
- [x] Remove port number (use default HTTPS port 443)

### Issue #2: Remove sessionId Parameter (HIGH PRIORITY)
- [x] Remove `sessionId` from building creation request body
- [x] Backend automatically finds active session
- [x] Backend automatically increments buildingsEnumerated counter

### Testing Checklist
- [x] Test 1: Connectivity check (✅ Backend accessible at https://upwork.kowope.xyz)
- [x] Test 2: Login flow (✅ Login successful via curl, ❌ Login failing in mobile app)
- [ ] Test 3: Start session (lot code: TEST01)
- [ ] Test 4: Register building (verify submission works)
- [ ] Test 5: Verify auto-increment (counter updates automatically)
- [ ] Test 6: View statistics (session metrics display correctly)
- [ ] Test 7: End session (GPS capture and completion)

### Build & Deployment
- [x] Build v1.3.1 APK with fixes (7.7 MB)
- [x] Test APK on device (❌ Login failing)
- [x] Create checkpoint (version: 58938c87)
- [ ] Update release notes

---

## v1.3.0 - Session Management Integration (COMPLETED)
- [x] Session Management Screen
- [x] Session Statistics Screen
- [x] Session-aware building registration
- [x] Offline session end queueing
- [x] APK v1.3.0 built (7.7 MB)
- [x] Release notes created

---

## v1.2.0 Baseline (LOCKED - Do Not Modify)
- [x] Login Screen with custom authentication
- [x] Location Picker with GPS capture
- [x] Building Form with photo capture
- [x] Customer Search with autocomplete
- [x] Offline support with automatic sync
- [x] Login fix (fullName field mapping)
