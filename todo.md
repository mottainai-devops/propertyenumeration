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
