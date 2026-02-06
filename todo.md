# Mottainai APK Distribution - TODO

## Custom Authentication System (v1.5)
- [x] Design custom authentication system architecture
- [x] Add password field to users table schema
- [x] Implement backend login endpoint (email/password authentication)
- [x] Implement backend session management (cookie-based sessions)
- [x] Implement backend logout endpoint
- [x] Implement backend "check session" endpoint (me)
- [x] Create custom Login page UI
- [x] Update useAuth hook to use custom authentication
- [x] Update App.tsx routing with /login route
- [x] Update getLoginUrl to return /login path
- [x] Update DashboardLayout to use wouter navigation
- [x] Test login flow with test credentials
- [x] Verify successful authentication and redirect to dashboard
- [x] Confirm user information displays correctly in sidebar
- [x] Build web assets for production
- [x] Sync Capacitor with Android
- [x] Build Android APK v1.5 (28MB)

## Bug Fixes (v1.5.1)
- [x] Investigate JSON parsing error in login endpoint
- [x] Check backend response format and headers
- [x] Verify tRPC endpoint is returning proper JSON
- [x] Test login endpoint with curl/Postman
- [x] Fix backend authentication endpoint response (configured server URL)
- [x] Test login flow in development browser (already confirmed working)
- [ ] Test login flow in APK
- [x] Rebuild APK v1.5.1 with fixes (28MB, configured with dashboard.kowope.xyz)

## Bug Fixes (v1.5.2 - Blank Screen Issue)
- [x] Investigate blank screen in APK v1.5.1
- [x] Check if dashboard.kowope.xyz is accessible (SSL cert issue found)
- [x] Reconfigure Capacitor to bundle web assets locally
- [x] Remove server.url to use local assets
- [x] Update tRPC client to use absolute production URL for API calls
- [x] Test API connectivity with production server (configured for dashboard.kowope.xyz)
- [x] Rebuild APK v1.5.2 with hybrid configuration (28MB)
- [ ] Verify APK loads UI and can connect to backend (user testing required)

## API Endpoint Fixes (v1.0.0 - Property Enumeration)
- [x] Fix auth login endpoint from /auth/login to /users/login
- [x] Update API response parsing to match backend specification
- [x] Verify building creation API matches backend format
- [x] Test GPS coordinates format (gpsCoordinates object vs separate fields)
- [x] Update property type values to lowercase (residential vs Residential)
- [x] Update form fields to match backend (contactName, contactPhone instead of buildingName, numberOfUnits, notes)
- [x] Rebuild APK with corrected API endpoints (v1.0.1 - 4.1MB)
- [ ] Test login flow with test credentials (test.supervisor@mottainai.com)
- [ ] Test building registration with backend

## HTTP/HTTPS Mixed Content Fix (v1.0.2)
- [x] Change androidScheme from 'https' to 'http' in capacitor.config.ts
- [x] Create network_security_config.xml to allow cleartext HTTP traffic
- [x] Update AndroidManifest.xml to reference network security config
- [x] Rebuild APK with HTTP support (v1.0.2 - 4.4MB)
- [ ] Test login with new APK
- [ ] Verify building registration works

## Blank Screen After Login Fix (v1.0.3)
- [x] Identified root cause: Invalid Google Maps API key
- [x] User provided valid Google Maps API key (AIzaSyDT6p1kGrmkpYsk5Zwtjc6zo43FwTP4veA)
- [x] Updated MapView component with new API key
- [x] Rebuild web assets with new API key (468.57 kB)
- [x] Sync to Android platform
- [x] Build APK v1.0.3 (4.4 MB)
- [ ] Test map interface loads after login
