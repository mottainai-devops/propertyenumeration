# Property Enumeration Mobile App - TODO

**Current Version:** v1.3.0 (In Development)  
**Baseline:** v1.2.0 (LOCKED)  
**Status:** Implementation Phase - Plan APPROVED & LOCKED  
**Date:** February 8, 2026

---

## v1.3.0 - Session Management Integration (Week 4)

### Approved Invariants
- Only one active session per user/device allowed at any time
- Session context passed into UI components is read-only

### API Client Updates
- [ ] Add session API endpoints (start, end, list, details, statistics)
- [ ] Update building creation API to include sessionId parameter
- [ ] Add TypeScript interfaces for session types
- [ ] Add error handling for session-specific errors (409 conflicts, etc.)

### New Screens
- [ ] Create Session Management Screen
  - [ ] Active session card with session info and action buttons
  - [ ] No active session card with start session form
  - [ ] ArcGIS sync status banner (read-only)
  - [ ] GPS location capture for session start
  - [ ] Lot code dropdown from user's company operational lots
  - [ ] Session notes textarea (optional)
  - [ ] End session confirmation dialog
  - [ ] Navigation to Location Picker, Session Statistics

- [ ] Create Session Statistics Screen
  - [ ] Tab navigation (Current Session, History)
  - [ ] Current Session Tab with performance metrics
  - [ ] History Tab with paginated session list
  - [ ] Session details modal
  - [ ] Pull-to-refresh functionality
  - [ ] Offline cache display with banner

### Modified Screens (Session Context)
- [ ] Modify Location Picker
  - [ ] Add session context banner at top
  - [ ] Display session ID, lot code, buildings count
  - [ ] Verify active session exists on mount
  - [ ] Redirect to Session Management if no active session

- [ ] Modify Building Form
  - [ ] Add session context header at top
  - [ ] Display session ID, lot code, building number
  - [ ] Pre-fill lot code from session
  - [ ] Include sessionId in building creation request
  - [ ] Verify active session exists on mount
  - [ ] Update local session building count after successful creation

- [ ] Modify Success Screen
  - [ ] Add session progress display
  - [ ] Show total buildings in session
  - [ ] Update action buttons (Register Another, End Session, View Statistics)
  - [ ] Navigation to Session Statistics

### State Management
- [ ] Add activeSession to localStorage
- [ ] Add session validation on app startup
- [ ] Add session history cache in Capacitor Preferences
- [ ] Add session statistics cache in Capacitor Preferences
- [ ] Update offline building queue to include sessionId
- [ ] Add pending session end queue for offline support
- [ ] Implement cache expiry logic (statistics: 2 min, history: 5 min, details: 7 days)
- [ ] Implement cache cleanup on logout

### Offline Support
- [ ] Queue session end requests when offline
- [ ] Sync queued session end when connection restored
- [ ] Include sessionId in offline building queue
- [ ] Show offline banners on Session Management and Statistics screens
- [ ] Disable session start when offline

### Navigation Updates
- [ ] Update app routing to include new screens
- [ ] Set Session Management as entry point after login
- [ ] Add navigation guards to verify active session
- [ ] Update navigation flows from Success Screen

### Testing
- [ ] Test session start flow with GPS validation
- [ ] Test building registration with active session
- [ ] Test session end flow with GPS capture
- [ ] Test session statistics display
- [ ] Test session history pagination
- [ ] Test offline session end queueing
- [ ] Test session validation on app startup
- [ ] Test navigation guards (redirect when no active session)
- [ ] Test cache expiry and refresh
- [ ] Test logout cleanup

### Build & Deployment
- [ ] Build React app for production
- [ ] Sync Capacitor with Android platform
- [ ] Build Android APK v1.3.0
- [ ] Test APK on device
- [ ] Verify all v1.3.0 features work correctly
- [ ] Create checkpoint

---

## v1.2.0 Baseline (LOCKED - Do Not Modify)
- [x] Login Screen with custom authentication
- [x] Location Picker with GPS capture (SimpleLocationPicker)
- [x] Building Form with photo capture (up to 4 photos)
- [x] Customer Search with autocomplete and filters
- [x] Offline building registration queue
- [x] Automatic sync on network restore
- [x] GPS coordinate capture with accuracy indicator
- [x] Photo upload functionality
- [x] Recent customers display
- [x] Digitalization status and property type filters
- [x] Professional gradient UI design
- [x] Login fix (fullName field mapping)

---

## Version History

### v1.2.0 (Current Baseline - LOCKED)
- Custom authentication system
- Offline support with automatic sync
- Enhanced customer search with filters
- Recent customers functionality
- Professional gradient UI
- Login fix (API response structure)

### v1.1.0
- Week 2 API integration
- Customer search and linking
- Photo upload (up to 4 photos)
- Customer autocomplete

### v1.0.6
- Gradient design fix (Tailwind v4)
- Week 2 API integration preparation

### v1.0.5
- Geolocation plugin integration
- Professional UI redesign
- Card-based layout

### v1.0.4
- Fallback UI without Google Maps
- Direct GPS capture via Capacitor

### v1.0.3
- Google Maps API key update

### v1.0.2
- HTTP/HTTPS mixed content fix

### v1.0.1
- API endpoint corrections

### v1.0.0
- Initial Property Enumeration app


## Progress Tracking

### API Client Updates
- [x] Add session API endpoints (start, end, list, details, statistics)
- [x] Update building creation API to include sessionId parameter
- [x] Add TypeScript interfaces for session types
- [x] Add error handling for session-specific errors (409 conflicts, etc.)

### New Screens
- [x] Create Session Management Screen
  - [x] Active session card with session info and action buttons
  - [x] No active session card with start session form
  - [x] ArcGIS sync status banner (read-only)
  - [x] GPS location capture for session start
  - [x] Lot code dropdown from user's company operational lots
  - [x] Session notes textarea (optional)
  - [x] End session confirmation dialog
  - [x] Navigation to Location Picker, Session Statistics

- [x] Create Session Statistics Screen
  - [x] Tab navigation (Current Session, History)
  - [x] Current Session Tab with performance metrics
  - [x] History Tab with paginated session list
  - [x] Session details modal
  - [x] Pull-to-refresh functionality
  - [x] Offline cache display with banner

### Modified Screens (Session Context)
- [x] Modify Location Picker
  - [x] Add session context banner at top
  - [x] Display session ID, lot code, buildings count
  - [x] Verify active session exists on mount

- [x] Modify Building Form
  - [x] Add session context header at top
  - [x] Display session ID, lot code, building number
  - [x] Pre-fill lot code from session
  - [x] Include sessionId in building creation request
  - [x] Update local session building count after successful creation

### State Management
- [x] Add activeSession to localStorage
- [x] Add session validation on app startup
- [x] Add session history cache in Capacitor Preferences
- [x] Add session statistics cache in Capacitor Preferences
- [x] Implement cache expiry logic (statistics: 2 min, history: 5 min)
- [x] Implement cache cleanup on logout

### Navigation Updates
- [x] Update app routing to include new screens
- [x] Set Session Management as entry point after login
- [x] Add navigation guards to verify active session
- [x] Update navigation flows from Success Screen

### Build & Deployment
- [x] Build React app for production
- [x] Sync Capacitor with Android platform
- [x] Build Android APK v1.3.0 (7.7 MB)
