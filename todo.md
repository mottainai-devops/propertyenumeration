# Property Enumeration Mobile App - TODO

**Current Version:** v1.3.2 (Login Fix)  
**Baseline:** v1.2.0 (LOCKED)  
**Status:** URGENT - Login Failure  
**Date:** February 8, 2026

---

## 🚨 v1.3.2 - Login Failure Fix (URGENT - IN PROGRESS)

### Issue: Login Still Failing After v1.3.1 Fixes
- [x] Diagnose why login fails despite backend endpoint working
- [x] Check Login component implementation
- [x] Verify API client axios configuration
- [x] Check for CORS or network errors (backend CORS is configured correctly)
- [x] Update Android network security config to allow upwork.kowope.xyz domain
- [x] Build v1.3.2 APK with fix (7.7 MB)
- [ ] Test login with correct credentials (requires physical device)
- [ ] Create checkpoint

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
