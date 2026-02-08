# Property Enumeration Mobile App - TODO

**Current Version:** v1.3.3 (Login Debugging)  
**Baseline:** v1.2.0 (LOCKED)  
**Status:** URGENT - Login Still Failing  
**Date:** February 8, 2026

---

## 🚨 v1.3.3 - Login Debugging (URGENT - IN PROGRESS)

### Issue: Login Still Failing After Network Security Config Fix
- [x] Add comprehensive error logging to Login component
- [x] Log full error object, response data, and request details
- [x] Add alert() to show actual error message on device
- [x] Check axios configuration (appears correct)
- [x] Verify Content-Type headers (set to application/json)
- [x] Build v1.3.3 APK with enhanced logging (7.7 MB)
- [ ] Test on device to see actual error message
- [ ] Create checkpoint

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
