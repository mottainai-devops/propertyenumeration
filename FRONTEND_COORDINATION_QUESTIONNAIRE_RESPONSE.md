# Frontend Coordination Questionnaire — Response
**From:** Frontend Developer (Mobile App v1.55.0)  
**To:** Backend Developer  
**Date:** March 4, 2026  
**Re:** Full alignment on API contracts before further feature development

---

## Section 1 — Authentication & Token Management

**1.1** Which backend do you send login requests to?
- [x] `upwork.kowope.xyz` (port 3000 — legacy Node.js backend)
- [ ] `admin.kowope.xyz` (port 3003 — mottainai-dashboard backend)
- [ ] Both, depending on user type

**Answer:** Currently sending to `upwork.kowope.xyz/api/mobile/users/login`. However, the questionnaire indicates login should go to `admin.kowope.xyz/api/mobile/users/`. This is a **discrepancy** — the app is using the wrong backend for auth. This needs to be corrected in the next build.

**1.2** After login, which fields do you read from the response and store locally?

| Field you store | Variable name in your code | Where you store it |
|---|---|---|
| `user` object (full) | `user` | AsyncStorage key: `user` |
| `token` (JWT) | `token` | AsyncStorage key: `token` |
| `ownerCompanyId` | (read from `user.ownerCompanyId`) | Derived from `user` object |
| `user.id` | (read from `user._id`) | Derived from `user` object |

**Answer:** The app stores the entire `user` object and the JWT `token`. The `ownerCompanyId` is read from `user.ownerCompanyId` when needed (e.g., for import requests). The user ID is stored as `user._id` (MongoDB ObjectId).

**1.3** How do you handle token expiry? Does the app silently refresh, redirect to login, or show an error?

**Answer:** The app does **not** currently implement token refresh. When a 401 response is received, the app shows a toast message "Please login (10001)" and redirects to the login screen. The user must log in again manually. There is no silent refresh mechanism.

**1.4** The login response now includes `ownerCompanyId` (the string code like `URBAN-SPIRIT`). Are you reading this field? If yes, what do you store it as?

**Answer:** Yes, the app reads `ownerCompanyId` from the login response. It is **not** stored separately — it is read directly from `user.ownerCompanyId` when needed (e.g., when building import requests). The entire `user` object is stored in AsyncStorage, so `ownerCompanyId` is implicitly stored as part of that object.

**1.5** For admin users, `ownerCompanyId` is `null` in the login response. How does your import screen handle this case?

**Answer:** The import screen has a manual input field labeled "Company ID (ownerCompanyId)" where the user can type the company code (e.g., `URBAN-SPIRIT`). When `ownerCompanyId` is `null`, the field is empty and the user must fill it in. For non-admin users, the field is pre-filled with `user.ownerCompanyId` and is read-only.

---

## Section 2 — Endpoint Routing (Critical)

**2.1** For each feature in the table, confirm which base URL you are currently calling. Mark any that differ from the table.

| Feature | Expected Backend | Current App Implementation | ✅/❌ Match |
|---|---|---|---|
| Login / logout / profile | `admin.kowope.xyz/api/mobile/users/` | `upwork.kowope.xyz/api/mobile/users/` | ❌ MISMATCH |
| Buildings (CRUD, photos) | `upwork.kowope.xyz/property-enumeration/buildings` | `upwork.kowope.xyz/property-enumeration/buildings` | ✅ |
| Sessions (start, end, list, stats) | `upwork.kowope.xyz/property-enumeration/sessions` | `upwork.kowope.xyz/property-enumeration/sessions` | ✅ |
| Customers (search, import) | `upwork.kowope.xyz/property-enumeration/customers` | `upwork.kowope.xyz/property-enumeration/customers` | ✅ |
| Customer bulk import (JSON) | `upwork.kowope.xyz/property-enumeration/customers/bulk` | `upwork.kowope.xyz/property-enumeration/customers/bulk` | ✅ |
| Customer bulk import (CSV) | `upwork.kowope.xyz/property-enumeration/customers/import` | `upwork.kowope.xyz/property-enumeration/customers/import` | ✅ |

**Answer:** **CRITICAL DISCREPANCY:** The app is sending login requests to `upwork.kowope.xyz` instead of `admin.kowope.xyz`. This needs to be corrected. All other endpoints are correct.

**2.2** Are there any features you are calling that are not in the table above? List them with the URL you are using.

**Answer:** Yes, one additional feature:
- **Logout:** `POST /api/mobile/users/logout` on the same backend as login (currently `upwork.kowope.xyz`, should be `admin.kowope.xyz`)

**2.3** Are you using a single `apiClient` instance with a hardcoded base URL, or do you switch base URLs per feature?

**Answer:** The app uses a single `apiClient` instance with a hardcoded base URL. Currently all requests go to `upwork.kowope.xyz`. To support the correct routing (auth on `admin.kowope.xyz`, features on `upwork.kowope.xyz`), the app needs to be updated to use **two separate API client instances** — one for auth and one for features.

---

## Section 3 — Customer Import Screen

**3.1** What is the current state of the import screen?
- [ ] Not started
- [ ] In progress
- [x] Complete but broken
- [ ] Complete and working

**Answer:** The import screen is complete but currently broken due to the auth backend mismatch (Section 2.1). Admin users cannot import because they are logging in to the wrong backend. Once the auth backend is corrected, the import screen should work.

**3.2** Which import method are you using or planning to use?
- [x] JSON bulk (`POST /customers/bulk`) — recommended for Capacitor WebView
- [ ] CSV file upload (`POST /customers/import`) — multipart, less reliable on mobile
- [x] Both

**Answer:** The app currently supports **both** methods:
- **Primary:** JSON bulk import (v1.50.0+) — parses CSV locally, POSTs JSON array
- **Fallback:** CSV multipart upload (legacy, v1.49.0) — still available but not recommended

The JSON bulk method is used by default because it is more reliable on Android WebView.

**3.3** When building the import request, where do you get the `ownerCompanyId` value from?

**Answer:** The `ownerCompanyId` is obtained from:
1. **For non-admin users:** Pre-filled from `user.ownerCompanyId` (read-only field)
2. **For admin users:** Manual input field where the user types the company code

The value is then included in the JSON bulk request body.

**3.4** For the JSON bulk endpoint, the request body must be: [as specified in questionnaire]

Is this the shape you are sending? Note: `customerType` must be capitalised (`Residential`, `Commercial`, or `Industrial`), and `lotCode` must be the bare number (`27`, not `LOT-27`).

**Answer:** The app is sending the correct shape. However, there is a **discrepancy on `lotCode` format**:
- **App sends:** `"lotCode": "LOT-27"` (with prefix)
- **Questionnaire says:** `"lotCode": "27"` (bare number)

This mismatch was discovered during testing. The backend's customer search endpoint requires `LOT-27` format. The import endpoint may accept both formats, but the questionnaire specifies bare numbers. This needs clarification.

**Confirmed correct:**
- `customerType` is capitalised (`Residential`, `Commercial`, `Industrial`)
- Request body shape matches the questionnaire exactly

**3.5** What does your app do with the response `{ "created": N, "updated": M, "failed": K, "errors": [...] }`?

**Answer:** The app displays a result screen showing:
- Green checkmark if `failed === 0`
- Red error icon if `failed > 0`
- Toast message: `"N customers created, M updated, K failed"`
- If errors exist, a scrollable error list showing each failed row with the error message

If the response status is 401 (unauthorized), the app shows "Log out and log back in to refresh your session" instead.

---

## Section 4 — Session Management

**4.1** What is the current state of the session list screen?
- [ ] Not started
- [ ] In progress
- [ ] Complete but broken
- [x] Complete and working

**Answer:** The session list screen is complete and working as of v1.55.0. Company scoping is now correctly implemented on the backend (v4.4.0).

**4.2** When fetching sessions, what query parameters do you send? (e.g. `?page=1&limit=20&status=active`)

**Answer:** The app sends **no query parameters**. The request is simply:
```
GET /api/property-enumeration/sessions
```

The backend returns all sessions for the logged-in user's company (scoped via JWT token).

**4.3** The sessions endpoint scopes results to the logged-in user's company via the JWT. Are you sending any company filter in the request, or relying entirely on the backend to scope it?

**Answer:** The app relies **entirely on the backend** to scope by company. No company filter is sent in the request. The backend reads the company from the JWT token and returns only that company's sessions.

**4.4** What fields do you read from each session object in the list? List the field names your code uses.

**Answer:** The app reads the following fields from each session object:

| Field Name | Usage |
|---|---|
| `_id` | Unique session ID (React key) |
| `sessionId` | Display in UI (session code) |
| `startTime` | Display start date/time |
| `endTime` | Display end date/time (if session ended) |
| `status` | Display session status (active, completed, etc.) |
| `buildingsRegistered` | Display count of registered buildings |
| `buildingsSurveyed` | Display count of surveyed buildings |
| `companyId` | Verify company scoping (internal check) |

---

## Section 5 — Building Management

**5.1** What is the current state of the building creation screen?
- [ ] Not started
- [ ] In progress
- [ ] Complete but broken
- [x] Complete and working

**Answer:** The building creation screen is complete and working. Buildings can be created online (with immediate sync) or offline (stored locally, synced when reconnected).

**5.2** When creating a building, what fields does your form collect and what field names do you send in the request body?

**Answer:** The app collects and sends the following fields:

| Field Name | Type | Required | Source |
|---|---|---|---|
| `sessionId` | string | Yes | From active session |
| `address` | string | Yes | User input |
| `lotCode` | string | Yes | User input |
| `latitude` | number | Yes | GPS location |
| `longitude` | number | Yes | GPS location |
| `arcgisBuildingId` | string | No | ArcGIS map lookup |
| `buildingType` | string | No | User selection (Residential, Commercial, Mixed) |
| `roofType` | string | No | User selection |
| `wallType` | string | No | User selection |
| `numberOfFloors` | number | No | User input |
| `photoUrls` | string[] | No | Uploaded photos |
| `notes` | string | No | User input |

**5.3** Does your building creation flow include photo upload? If yes:
- How do you upload the photo (multipart form data, base64, S3 pre-signed URL)?
- What field name do you use for the photo in the request?

**Answer:** Yes, photo upload is included. The app uses **multipart form data**:
1. User selects photo from device
2. App creates a multipart request with the photo file
3. Photo is uploaded to the backend
4. Backend returns `photoUrl` (S3 URL)
5. App stores `photoUrl` in the building's `photoUrls` array

**Field name in request:** `photo` (multipart file field)

**5.4** What fields do you read from the building object in the list/detail view?

**Answer:** Same fields as listed in 5.2 above. The app displays all collected fields in the building detail view and uses them for editing/updating.

---

## Section 6 — Error Handling

**6.1** When an API call returns a non-200 status, what does your app do? (Show toast, redirect, log silently, etc.)

**Answer:** The app's error handling varies by status code:

| Status Code | App Behavior |
|---|---|
| 401 | Show toast "Please login (10001)" + redirect to login screen |
| 403 | Show toast with error message (e.g., "Company not found") |
| 404 | Show toast "Endpoint not found" |
| 500 | Show toast "Server error" |
| Network error (no response) | Show toast "Network error — check your connection" |

**6.2** The backend returns errors in this format: `{ "success": false, "error": "Error message here" }`

Are you reading `response.error` or `response.message` or something else for the error text?

**Answer:** The app reads **`response.error`** for error text. However, there is inconsistency in the backend responses:
- Some endpoints return `{ error: "..." }`
- Some return `{ message: "..." }`
- Some return `{ results: { errors: [...] } }` (for bulk operations)

The app currently checks for `response.error` first, then falls back to `response.message` if `error` is not present.

**6.3** Have you seen any errors in the app that you have not been able to explain? List them here with the endpoint and the error message shown.

**Answer:** No unexplained errors currently. All errors encountered have been traced to:
1. Auth backend mismatch (Section 2.1)
2. Company scoping issues (now fixed in v4.4.0)
3. Data isolation issues (now fixed in v1.55.0)

---

## Section 7 — Features Not Yet Started

**7.1** Which features from the original spec have not been started on the frontend yet?

**Answer:** Based on the current implementation (v1.55.0), the following features are **not yet started**:

| Feature | Status | Notes |
|---|---|---|
| Photo delete from building | Not started | Backend endpoint exists but app doesn't have a delete button |
| Building transfer between sessions | Not started | No UI for moving a building to a different session |
| Batch building operations | Not started | No bulk edit/delete for multiple buildings |
| Session analytics/reports | Not started | No dashboard showing session metrics |
| Customer profile view | Not started | Search returns customers but no detail view |
| Customer edit/delete | Not started | Only import is implemented |
| Offline mode indicator | Partial | Shows "X pending sync" but no detailed offline status |
| Sync conflict resolution | Not started | If a building is edited online and offline simultaneously, no conflict resolution UI |

---

## Section 8 — Open Issues You Are Blocked On

**8.1** List any issues where you are currently blocked waiting for a backend response or fix.

| Issue | Endpoint | What you expected | What you got | Status |
|---|---|---|---|---|
| Auth backend mismatch | `/api/mobile/users/login` | Should be on `admin.kowope.xyz` | Currently on `upwork.kowope.xyz` | **BLOCKING** |
| Admin company assignment | `/property-enumeration/customers/bulk` | Admin users should be able to import | Admin has `company: null` in JWT | **RESOLVED** (v4.3.0) |
| ObjectId vs string code | `/property-enumeration/sessions` | Users with ObjectId `companyId` should see sessions | Returns empty list | **PENDING** (needs data migration) |
| Lot code format | `/property-enumeration/customers/bulk` | Questionnaire says bare number `27` | App sends `LOT-27` | **NEEDS CLARIFICATION** |

---

## Summary of Discrepancies & Action Items

### 🔴 CRITICAL (Blocking)

1. **Auth backend mismatch** — App sends login to `upwork.kowope.xyz`, should be `admin.kowope.xyz`
   - **Impact:** Admin users cannot log in correctly
   - **Fix required:** Update app to use `admin.kowope.xyz` for auth endpoints

### 🟡 MEDIUM (Needs Clarification)

2. **Lot code format** — Questionnaire says `27`, app sends `LOT-27`
   - **Impact:** Import may fail if backend expects bare number
   - **Fix required:** Clarify which format the backend accepts; update app if needed

### 🟢 LOW (Informational)

3. **Error response format inconsistency** — Some endpoints return `error`, some return `message`, some return nested `results.errors`
   - **Impact:** App has fallback logic but is fragile
   - **Fix required:** Standardise error response format across all endpoints

### ✅ RESOLVED

4. **Admin company assignment** — Fixed in v4.3.0
5. **Company scoping** — Fixed in v4.4.0
6. **Cross-account data leakage** — Fixed in v1.55.0 (per-user localStorage keys)

---

## Recommended Next Steps

1. **Immediate:** Fix the auth backend mismatch (Section 2.1)
2. **Urgent:** Clarify lot code format expectation (Section 3.4)
3. **High:** Complete ObjectId → string code migration (Section 8.1)
4. **Medium:** Standardise error response format across all endpoints
5. **Future:** Implement token refresh mechanism (Section 1.3)

---

*This questionnaire response represents the current state of the mobile app v1.55.0 and backend v4.4.0 as of March 4, 2026. Both teams should review and sign off on this document before proceeding with further feature development.*
