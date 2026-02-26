# Property Enumeration Mobile App

**Version:** 1.5.0  
**Last Updated:** February 12, 2026  
**Platform:** iOS & Android (Capacitor)

---

## Overview

The Property Enumeration Mobile App is a field data collection tool designed for property surveyors and enumerators. It enables offline-first building registration with GPS capture, photo documentation, customer linking, and automatic sync when connectivity is restored.

---

## Features

### ✅ Core Features

- **User Authentication** - Secure login with JWT tokens
- **Building Registration** - Capture building details with GPS coordinates
- **Photo Documentation** - Take up to 4 photos per building (auto-compressed)
- **Customer Linking** - Search and link customers to buildings
- **Offline Mode** - Full functionality without internet connection
- **Automatic Sync** - Queue pending buildings and sync when online
- **Session Tracking** - Track enumeration sessions with statistics
- **Multi-Company Support** - Data isolation between companies

### 🆕 New Features (v1.5.0)

#### 1. Enhanced Photo Upload
- **Automatic Compression** - Photos compressed if > 5MB
- **Size Validation** - Maximum 5MB per photo
- **Type Validation** - JPEG, PNG, WebP only
- **Visual Feedback** - Loading indicators and size display
- **Photo Tips** - Helpful guidance for users

#### 2. Offline Queue Visibility
- **Dedicated Queue Screen** - View all pending buildings
- **Expandable Details** - Full building information
- **Manual Sync** - Trigger sync anytime
- **Individual Removal** - Remove buildings from queue
- **Sync Progress** - Real-time sync status

#### 3. Session Statistics
- **Live Duration Counter** - Real-time session timer
- **Buildings Count** - Track registered buildings
- **Performance Metrics** - Average time per building, buildings per hour
- **Recent Buildings** - View last 5 registered buildings
- **Session History** - Access to past sessions

#### 4. Comprehensive Error Handling
- **Toast Notifications** - Professional, non-intrusive alerts
- **Error Boundary** - Graceful error recovery
- **Retry Logic** - Automatic retry for network failures
- **User-Friendly Messages** - Clear, actionable error messages
- **Error Logging** - Detailed logs for debugging

---

## Technology Stack

- **Framework:** React 18 + TypeScript
- **Mobile Runtime:** Capacitor 6
- **UI Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Camera:** @capacitor/camera
- **Geolocation:** @capacitor/geolocation
- **Storage:** LocalStorage (offline queue)

---

## Project Structure

```
src/
├── api/
│   └── client.ts                 # API client and endpoints
├── components/
│   ├── BuildingForm.tsx          # Building registration form
│   ├── CustomerSearch.tsx        # Customer search component
│   ├── ErrorBoundary.tsx         # Global error boundary
│   ├── Login.tsx                 # Login screen
│   ├── OfflineQueue.tsx          # Offline queue management
│   ├── SessionBanner.tsx         # Active session banner
│   ├── SessionManagement.tsx     # Session dashboard
│   ├── SessionStatistics.tsx     # Session metrics
│   ├── SimpleLocationPicker.tsx  # GPS location capture
│   └── Toast.tsx                 # Toast notification system
├── utils/
│   ├── errorHandler.ts           # Error handling utilities
│   └── photoUtils.ts             # Photo validation & compression
└── App.tsx                       # Main app component
```

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android builds)
- Xcode (for iOS builds)

### Install Dependencies

```bash
npm install
```

### Development

```bash
# Run in browser
npm run dev

# Build for mobile
npm run build

# Sync with Capacitor
npx cap sync

# Open in Android Studio
npx cap open android

# Open in Xcode
npx cap open ios
```

---

## Configuration

### API Endpoint

Update the API base URL in `src/api/client.ts`:

```typescript
const API_BASE_URL = 'https://upwork.kowope.xyz';
```

### Environment Variables

No environment variables required. All configuration is in code.

---

## User Guide

### 1. Login

- Enter your email and password
- Tap "Login"
- App will retry automatically if connection fails

### 2. Start Enumeration Session

- From the session dashboard, tap "Start Enumeration Session"
- Capture GPS location
- Tap "Use This Location"

### 3. Register Building

**Step 1: Building Details**
- Fill in address (required)
- Enter building name (optional)
- Enter lot code (required)
- Select property type
- Set number of units
- Take up to 4 photos
- Add notes (optional)
- Tap "Next: Link Customer"

**Step 2: Customer Linking**
- Search for customer (optional)
- Select customer from results
- Or tap "Skip" to register without customer
- Tap "Submit"

### 4. Offline Mode

When offline:
- Buildings are saved to local queue
- Banner shows "Offline Mode" status
- Continue registering buildings normally
- Buildings sync automatically when online

### 5. View Offline Queue

- Tap the offline queue banner
- Or access from session dashboard
- View pending buildings
- Tap "Sync All" to manually sync
- Remove individual buildings if needed

### 6. View Session Statistics

- From session dashboard, tap "View Statistics"
- See real-time session duration
- Track buildings registered
- View performance metrics
- Check recent buildings

---

## Features in Detail

### Photo Upload

**Validation:**
- Maximum 4 photos per building
- Maximum 5MB per photo
- Supported formats: JPEG, PNG, WebP

**Automatic Compression:**
- Photos > 5MB are automatically compressed
- Target resolution: 1920px max dimension
- Quality: 80%
- Compression happens before upload

**User Feedback:**
- Loading spinner during capture/compression
- Photo size display on each thumbnail
- Total size counter
- Remaining photo count
- Helpful tips for first-time users

### Offline Queue

**Features:**
- View all pending buildings
- Expandable cards with full details
- GPS coordinates with accuracy
- Photo count and sizes
- Timestamp (e.g., "2 hours ago")
- Manual sync trigger
- Individual building removal

**Sync Behavior:**
- Automatic sync when connection restored
- Retry logic for failed syncs
- Success/failure notifications
- Remaining buildings after sync

### Session Statistics

**Metrics:**
- Session duration (HH:MM:SS)
- Buildings registered count
- Lot code
- Session start time
- Average time per building
- Buildings per hour rate

**Recent Buildings:**
- Last 5 registered buildings
- Building name and address
- Property type and units
- Registration status

### Error Handling

**Toast Notifications:**
- Success (green) - Operation completed
- Error (red) - Operation failed
- Warning (yellow) - Retry in progress
- Info (blue) - General information

**Error Boundary:**
- Catches all React errors
- Prevents app crashes
- Shows user-friendly error screen
- Provides restart option
- Logs technical details

**Retry Logic:**
- Automatic retry for network failures
- Exponential backoff (1s, 2s, 4s)
- Maximum 3 retries
- User notification on retry
- Skip retry for validation errors

---

## API Integration

### Endpoints Used

**Authentication:**
- `POST /users/login` - User login

**Buildings:**
- `POST /property-enumeration/buildings` - Create building
- `GET /property-enumeration/buildings` - List buildings

**Customers:**
- `GET /property-enumeration/customers` - List customers
- `GET /property-enumeration/customers/search` - Search customers
- `POST /property-enumeration/customers/link` - Link customer to building

**Sessions:**
- `POST /property-enumeration/sessions/start` - Start session
- `POST /property-enumeration/sessions/end` - End session

### Authentication

All API requests include JWT token in Authorization header:

```
Authorization: Bearer <token>
```

Token is stored in localStorage after login.

---

## Offline Storage

### LocalStorage Keys

- `authToken` - JWT authentication token
- `user` - User profile data
- `pendingBuildings` - Array of buildings waiting to sync
- `activeSession` - Current enumeration session data
- `recentBuildings` - Recently registered buildings

### Data Persistence

- Buildings saved offline include all data (photos, GPS, details)
- Photos stored as File objects in memory
- Automatic sync on reconnection
- Manual sync available anytime

---

## Testing

### Test Accounts

**TESTCO Company:**
- supervisor1@test.com / Test@123
- supervisor2@test.com / Test@123
- supervisor3@test.com / Test@123

**TEST-FRANCHISOR Company:**
- supervisor4@test.com / Test@123
- supervisor5@test.com / Test@123

### Test Scenarios

1. **Login Flow**
   - Valid credentials
   - Invalid credentials
   - Network failure during login

2. **Building Registration**
   - Complete form with all fields
   - Minimum required fields only
   - With photos
   - Without photos
   - With customer linking
   - Without customer linking

3. **Offline Mode**
   - Register building while offline
   - Multiple buildings offline
   - Sync when online
   - Failed sync retry

4. **Photo Upload**
   - Small photos (< 1MB)
   - Large photos (> 5MB, auto-compress)
   - Multiple photos
   - Remove photos
   - Invalid file types

5. **Session Tracking**
   - Start session
   - Register buildings in session
   - View statistics
   - End session

6. **Error Handling**
   - Network errors
   - Validation errors
   - Server errors
   - Unauthorized access

---

## Troubleshooting

### Common Issues

**1. Login fails with "Network Error"**
- Check internet connection
- Verify API endpoint is accessible
- Check if backend server is running

**2. Photos not uploading**
- Check photo size (must be < 5MB after compression)
- Verify photo format (JPEG, PNG, WebP only)
- Check camera permissions

**3. Buildings not syncing**
- Verify internet connection
- Check authentication token validity
- View offline queue for sync errors
- Try manual sync

**4. GPS location not accurate**
- Enable location services
- Grant location permissions
- Wait for GPS signal to stabilize
- Move to open area for better signal

**5. App crashes on startup**
- Clear app data and cache
- Reinstall the app
- Check device compatibility
- View error logs in console

---

## Performance Optimization

### Photo Compression

- Automatic compression for photos > 5MB
- Target resolution: 1920px max dimension
- Quality: 80% (good balance between size and quality)
- Compression happens client-side (no server load)

### Offline Queue

- Buildings stored in localStorage (persistent)
- Automatic cleanup after successful sync
- Maximum recommended: 100 buildings in queue
- Sync in batches to avoid timeout

### Network Optimization

- Retry logic with exponential backoff
- Request timeout: 30 seconds
- Automatic retry for failed requests
- Skip retry for validation errors

---

## Known Limitations

1. **Photo Storage** - Photos stored in memory, cleared on app restart
2. **Offline Queue Size** - LocalStorage limit ~5-10MB (varies by device)
3. **GPS Accuracy** - Depends on device hardware and signal strength
4. **Session Persistence** - Active session lost on app restart
5. **Customer Search** - Requires internet connection

---

## Future Enhancements

- [ ] Background sync service
- [ ] Push notifications for sync completion
- [ ] Bulk photo upload with progress
- [ ] Export buildings to CSV
- [ ] Offline maps integration
- [ ] Voice notes support
- [ ] Barcode/QR code scanning
- [ ] Multi-language support

---

## Version History

### v1.5.0 (February 12, 2026)
- ✨ Enhanced photo upload with validation and compression
- ✨ Offline queue visibility and management
- ✨ Session statistics with real-time metrics
- ✨ Comprehensive error handling with toast notifications
- ✨ Error boundary for graceful error recovery
- ✨ Retry logic for network failures
- 🐛 Fixed GPS field names (gpsLatitude/gpsLongitude)
- 🐛 Fixed customer endpoints ObjectId casting
- 🐛 Fixed session end endpoint
- 🐛 Fixed multi-company data isolation

### v1.4.8 (February 12, 2026)
- 🐛 Fixed GPS field names in BuildingForm
- 🐛 Fixed SimpleLocationPicker GPS coordinates

### v1.4.0 (February 11, 2026)
- ✨ Initial release
- ✨ Building registration
- ✨ Customer linking
- ✨ Offline mode
- ✨ Session tracking

---

## Support

For issues, questions, or feature requests:
- Email: support@mottainai.com
- GitHub: [Repository URL]
- Documentation: [Docs URL]

---

## License

Proprietary - Mottainai Property Enumeration System  
© 2026 All Rights Reserved
