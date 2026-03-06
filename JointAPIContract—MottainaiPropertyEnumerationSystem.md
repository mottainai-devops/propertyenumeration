# Joint API Contract — Mottainai Property Enumeration System

> **Document Version:** v1.1.0
> **Backend Version:** v4.5.4 (deployed March 6, 2026)
> **Mobile App Version:** v1.57.16
> **Status:** ✅ Signed Off — Both Teams
> **Authors:** Backend Team + Frontend Team
> **Date:** March 6, 2026

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0.0 | March 4, 2026 | Backend Team | Initial contract, 4 discrepancies documented |
| v1.1.0 | March 6, 2026 | Both Teams | 5 additional issues resolved (Issues 1–5 from frontend sign-off review); logout endpoint added; customer search endpoint added; `assignedLots` fix deployed; both teams signed off |

---

## Executive Summary

This document is the authoritative, jointly agreed API contract between the mobile app frontend team and the backend team for the Mottainai Property Enumeration System. It supersedes all previous questionnaires, response documents, and informal agreements.

All nine discrepancies and issues identified across both review cycles have been investigated and resolved. The system is now at **v4.5.4 (backend) / v1.57.16 (mobile app)** and both teams have signed off.

---

## 1. System Architecture

The system comprises two Node.js backends behind a single nginx reverse proxy. The mobile app communicates exclusively with `upwork.kowope.xyz`, which routes requests internally to the appropriate backend service.

| Service | Internal Port | PM2 Process | Responsibility |
|---------|--------------|-------------|----------------|
| `mottainai-backend` | 3000 | `mottainai-backend` | Property enumeration API (buildings, sessions, customers) |
| `mottainai-dashboard` | 3003 | `mottainai-dashboard` | Mobile authentication, admin tRPC |
| MongoDB | 27017 | — | Primary data store (`arcgis` database) |
| Nginx | 443 (SSL) | — | Routing, SSL termination, CORS |

**The mobile app uses a single base URL: `https://upwork.kowope.xyz`**

Nginx routes requests to the correct backend service transparently. The frontend does not need to know which internal port handles each request.

---

## 2. Authentication

### 2.1 Login

**Endpoint:** `POST https://upwork.kowope.xyz/api/mobile/users/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "BASE64_ENCODED_PASSWORD"
}
```

> **Note:** Passwords must be base64-encoded before sending. Example: `admin123` → `YWRtaW4xMjM=`.

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "66212f85df2188147c7a81d7",
    "email": "user@example.com",
    "fullName": "Full Name",
    "phone": "08012345678",
    "role": "user",
    "companyId": "67abc123...",
    "ownerCompanyId": "URBAN-SPIRIT",
    "companyName": "Urban Spirit Ltd",
    "defaultLotCode": "6",
    "assignedLots": [
      { "lotCode": "6", "lotName": "Lot 6" }
    ],
    "monthlyBilling": true
  }
}
```

> **v4.5.4 Fix (Issue 1):** `assignedLots` and `defaultLotCode` are now always present in the login, `/me`, and register responses. `defaultLotCode` is the first lot in the company's `operationalLots` array. Admin users (no company) return `assignedLots: []` and `defaultLotCode: null`. If a surveyor's `assignedLots` is `[]`, it means their company has no lots configured in the database — this is a data setup issue, not a code issue.

> **Lot Code Format:** `defaultLotCode` and `lotCode` in `assignedLots` are bare number strings (e.g., `"6"`, `"27"`), not prefixed (e.g., `"LOT-6"`). The building creation endpoint also uses bare numbers.

**Admin User Response (200):**

When `role` is `admin`, `ownerCompanyId` and `companyName` are `null`, and `assignedLots` is `[]`.

```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "66212f85df2188147c7a81d7",
    "email": "admin@admin.com",
    "fullName": "Admin",
    "phone": "123546789",
    "role": "admin",
    "companyId": null,
    "ownerCompanyId": null,
    "companyName": null,
    "defaultLotCode": null,
    "assignedLots": [],
    "monthlyBilling": false
  }
}
```

**Error Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ "success": false, "error": "Email and password are required" }` | Missing fields |
| 401 | `{ "success": false, "error": "Invalid email or password" }` | Bad credentials |
| 500 | `{ "success": false, "error": "Internal server error" }` | Server error |

**Token Characteristics:**
- Algorithm: HS256
- Payload fields: `userId`, `email`, `role`
- Expiry: 30 days
- The token is accepted by all property enumeration endpoints on `upwork.kowope.xyz`

### 2.2 Get Current User

**Endpoint:** `GET https://upwork.kowope.xyz/api/mobile/users/me`

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):** Same shape as the `user` object in the login response (including `assignedLots` and `defaultLotCode`).

### 2.3 Logout

**Endpoint:** `POST https://upwork.kowope.xyz/api/mobile/users/logout`

**Headers:** `Authorization: Bearer <token>`

**Request Body:** `{}` (empty JSON object)

**Success Response (200):**
```json
{ "success": true, "message": "Logged out successfully" }
```

> **v4.5.4 Fix (Issue 2):** This endpoint is now live. The token is added to an in-memory blacklist on the server. All subsequent requests using that token are rejected with `401 { "error": "Unauthorized: Token has been invalidated. Please log in again." }`. The blacklist clears on server restart (acceptable given 30-day token expiry and deliberate deploy cycles).

> **Frontend implementation (v1.57.16):** The app now calls this endpoint before clearing local storage on logout. If the endpoint returns an error (e.g., network offline), the app still clears local state to ensure the user is logged out locally.

### 2.4 Change Password

**Endpoint:** `PATCH https://upwork.kowope.xyz/api/mobile/users/me/password`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "BASE64_ENCODED_CURRENT_PASSWORD",
  "newPassword": "BASE64_ENCODED_NEW_PASSWORD"
}
```

**Success Response (200):**
```json
{ "success": true, "message": "Password updated successfully" }
```

---

## 3. Property Enumeration — Buildings

All building endpoints require `Authorization: Bearer <token>` header. The backend automatically scopes results to the authenticated user's company.

### 3.1 Create Building

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings`

**Request Body (JSON):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `address` | string | ✅ Yes | Full street address |
| `lotCode` | string | ✅ Yes | Bare number format: `"27"` (not `"LOT-27"`) |
| `propertyType` | string | ✅ Yes | One of: `"Residential"`, `"Commercial"`, `"Industrial"`, `"Mixed-Use"` |
| `numberOfUnits` | number | ✅ Yes | Integer ≥ 1 |
| `gpsLatitude` | number | ✅ Yes | Decimal degrees, e.g. `6.5244` |
| `gpsLongitude` | number | ✅ Yes | Decimal degrees, e.g. `3.3792` |
| `buildingName` | string | No | Optional building name |
| `landmarkDescription` | string | No | Nearby landmark |
| `gpsAccuracy` | number | No | GPS accuracy in metres |
| `contactPersonName` | string | No | On-site contact |
| `contactPhoneNumber` | string | No | Contact phone |
| `notes` | string | No | Free-text notes |
| `arcgisBuildingId` | string | No | ArcGIS feature ID if known |

> **Field Name Clarification:** The backend uses `gpsLatitude`/`gpsLongitude` (not `latitude`/`longitude`). This was confirmed as Discrepancy 4 in v1.0.0 and is resolved.

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "buildingId": "URBAN-SPIRIT LOT-6 001",
    "address": "12 Awolowo Road",
    "lotCode": "6",
    "propertyType": "Residential",
    "numberOfUnits": 4,
    "gpsLatitude": 6.5244,
    "gpsLongitude": 3.3792,
    "companyId": "URBAN-SPIRIT",
    "enumeratorId": "66212f85...",
    "createdAt": "2026-03-04T12:00:00.000Z"
  }
}
```

### 3.2 List Buildings

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/buildings`

**Query Parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Max 100 |
| `lotCode` | string | — | Filter by lot (bare number or `LOT-` prefix, both accepted) |
| `propertyType` | string | — | Filter by type |
| `search` | string | — | Search address/buildingId |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "buildings": [...],
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### 3.3 Get Building by ID

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId`

### 3.4 Update Building

**Endpoint:** `PATCH https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId`

The following fields are **protected** and cannot be updated after creation: `lotCode`, `gpsLatitude`, `gpsLongitude`, `unitCode`, `arcgisBuildingId`, `buildingId`, `userId`, `enumeratorId`, `companyId`, `createdAt`.

### 3.5 Building Photos

> **Note (v1.57.16):** The photo capture and upload feature has been **removed from the mobile app** as of v1.57.15. The backend endpoints remain available for future use or other clients.

**Upload:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId/photos`
- Request: `multipart/form-data` with field name `photo`
- Max 4 photos per building

**Delete:** `DELETE https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId/photos/:photoIndex`

---

## 4. Property Enumeration — Sessions

### 4.1 Start Session

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/sessions`

**Request Body:**
```json
{
  "lotCode": "27",
  "startLocation": {
    "latitude": 6.5244,
    "longitude": 3.3792
  },
  "notes": "Optional session notes"
}
```

> **Note:** `startLocation` uses `latitude`/`longitude` (not `gpsLatitude`/`gpsLongitude`). This is intentional — session location uses a nested object with standard field names.

### 4.2 List Sessions

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/sessions`

No query parameters required. The backend scopes results to the authenticated user's company via JWT.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "_id": "67abc123...",
        "sessionId": "SESS-URBAN-SPIRIT-001",
        "startTime": "2026-03-04T08:00:00.000Z",
        "endTime": null,
        "status": "active",
        "buildingsRegistered": 5,
        "buildingsSurveyed": 3,
        "companyId": "URBAN-SPIRIT"
      }
    ],
    "total": 12
  }
}
```

> **Deprecated field:** `photosUploaded` (integer count) is still returned in session responses for backward compatibility. It will be removed in a future version. The `photoUrls` array is the authoritative field.

### 4.3 End Session

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/sessions/:sessionId/end`

**Alternative (sessionId in body):** `POST https://upwork.kowope.xyz/api/property-enumeration/sessions/end`

```json
{ "sessionId": "67abc123...", "notes": "Optional closing notes" }
```

### 4.4 Get Session Buildings

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/sessions/:sessionId/buildings`

---

## 5. Property Enumeration — Customers

### 5.1 List / Filter Customers

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/customers`

**Query Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, max 100 |
| `lotCode` | string | Bare number or `LOT-` prefix, both accepted |
| `isDigitalized` | boolean | Filter by digitalization status |
| `buildingId` | string | Filter by linked building |
| `search` | string | Search name/address/phone |

### 5.2 Search Customers (Autocomplete)

**Endpoint:** `GET https://upwork.kowope.xyz/api/property-enumeration/customers/search`

**Query Parameters:** `q` (min 2 chars), `lotCode` (optional), `limit` (default 10, max 50)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": [ { ...customer fields... } ],
    "count": 3
  }
}
```

> **v4.5.4 Fix (Issue 3):** This dedicated search endpoint is now live. Response uses `count` (not `total`) and has no pagination fields. The frontend (v1.57.16) uses this endpoint with automatic fallback to the list endpoint for backward compatibility with pre-v4.5.4 servers.

### 5.3 JSON Bulk Import

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/customers/bulk`

**Required Roles:** `admin`, `superadmin`, `cherry_picker`

**Request Body:**
```json
{
  "ownerCompanyId": "URBAN-SPIRIT",
  "customers": [
    {
      "customerName": "John Doe",
      "address": "12 Awolowo Road, Ikeja",
      "lotCode": "6",
      "phone": "08012345678",
      "email": "john@example.com",
      "customerType": "Residential"
    }
  ]
}
```

**Field Rules:**

| Field | Required | Format | Notes |
|-------|----------|--------|-------|
| `customerName` | ✅ Yes | string | Full name |
| `address` | ✅ Yes | string | Full address |
| `lotCode` | ✅ Yes | string | **Bare number: `"6"`, not `"LOT-6"`**. The backend also accepts `"LOT-6"` format and strips the prefix automatically. Both formats are safe to send. |
| `phone` | No | string | Phone number |
| `email` | No | string | Email address |
| `customerType` | No | string | `"Residential"` (default), `"Commercial"`, or `"Industrial"`. **Must be capitalised.** |

**Maximum batch size:** 5,000 customers per request.

**Success Response (200):**
```json
{
  "success": true,
  "results": {
    "created": 45,
    "updated": 3,
    "failed": 2,
    "errors": [
      "Row missing required fields (customerName, address, lotCode): {...}",
      "Error processing \"Jane Doe\": duplicate key"
    ]
  }
}
```

### 5.4 CSV File Import

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/customers/import`

**Request:** `multipart/form-data` with field `file` (CSV or Excel). Requires `lotCode` in the request body.

> **Recommendation:** Use the JSON bulk import (Section 5.3) for mobile apps. The CSV endpoint is provided for legacy compatibility only.

### 5.5 Link Customer to Building

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/customers/:customerId/link`

**Request Body:**
```json
{ "buildingId": "URBAN-SPIRIT LOT-6 001" }
```

### 5.6 Unlink Customer from Building

**Endpoint:** `DELETE https://upwork.kowope.xyz/api/property-enumeration/customers/:customerId/unlink`

---

## 6. Error Response Format

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Some endpoints additionally include a `details` field with structured information:

```json
{
  "success": false,
  "error": "Missing required fields",
  "details": {
    "required": ["address", "lotCode"],
    "received": ["address"]
  }
}
```

> **Note on inconsistency (LOW priority, Issue 4):** Some older endpoints in the codebase use `message` instead of `error` as the key for the error text. The standard going forward is `error`. The frontend's current fallback logic (`response.error || response.message`) correctly handles both cases. Standardisation to `error` is tracked as low-priority technical debt for a future cleanup pass.

**Standard HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (missing/invalid fields) |
| 401 | Unauthorized (missing or invalid token, or token blacklisted after logout) |
| 403 | Forbidden (insufficient role or company not found) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal server error |

**Token Expiry / Invalidation Handling:**

When a 401 is received, the app shows a toast and redirects to the login screen. Token refresh is not currently implemented. Tokens have a 30-day expiry. Tokens are also invalidated immediately upon logout (in-memory blacklist, clears on server restart).

---

## 7. Discrepancy Resolution Log

### Discrepancy 1 — Auth Backend Mismatch (RESOLVED ✅)

Both `upwork.kowope.xyz/api/mobile/users/login` and `admin.kowope.xyz/api/mobile/users/login` route to the same backend service (port 3003). The frontend's current implementation using `upwork.kowope.xyz` is correct.

### Discrepancy 2 — Lot Code Format (RESOLVED ✅)

Both `"LOT-27"` and `"27"` are accepted by all endpoints. The bare number format (`"27"`) is the canonical internal format.

### Discrepancy 3 — Error Response Format Inconsistency (TRACKED ⚠️)

`error` is the standard key. `message` appears in 23 legacy places. Frontend fallback handles both. Future cleanup planned.

### Discrepancy 4 — Building GPS Field Names (RESOLVED ✅)

Building creation uses `gpsLatitude`/`gpsLongitude`. Session start uses `startLocation: { latitude, longitude }`. Both are intentional and documented in Sections 3.1 and 4.1.

### Issue 1 — `assignedLots` / `defaultLotCode` Missing from Login Response (RESOLVED ✅ — v4.5.4)

**Root cause:** Login handler was returning `company.operationalLots` as a nested company object instead of mapping it to `user.assignedLots`. **Fix:** Login, `/me`, and register responses now always include `assignedLots` and `defaultLotCode` directly on the user object. Verified live on March 6, 2026.

### Issue 2 — No Logout Endpoint (RESOLVED ✅ — v4.5.4)

**Fix:** `POST /api/mobile/users/logout` is now live with in-memory token blacklisting. Verified live: token is rejected on all subsequent requests after logout. Frontend (v1.57.16) now calls this endpoint on logout.

### Issue 3 — Customer Search Endpoint (RESOLVED ✅ — v4.5.4)

**Fix:** `GET /api/property-enumeration/customers/search?q=<term>` is now live. Response uses `count` (not `total`) and has no pagination. Frontend (v1.57.16) uses this endpoint with automatic fallback to the list endpoint.

### Issue 4 — Error Response Key Inconsistency (TRACKED ⚠️)

Documented above in Section 6. Low-priority tech debt. No action required from either team.

### Issue 5 — `photosUploaded` Field Deprecation (NOTED 📌)

`photosUploaded` (integer count) is still returned in session responses for backward compatibility. Photo feature removed from mobile app in v1.57.15. `photosUploaded` will be removed from session responses in a future backend version.

---

## 8. ArcGIS Sync Status

The ArcGIS sync cron job (`arcgis_sync.mjs`) runs every 15 minutes via crontab. A bug was fixed in v4.5.0: the script was calling `Company.findById(building.companyId)` which failed when `companyId` is a string code (e.g., `"TESTCO"`) rather than a MongoDB ObjectId. The fix replaces this with `Company.findOne({ companyId: building.companyId })`.

**Verification (March 4, 2026):** 26 buildings found, 19 new features added to ArcGIS, 7 updated, 0 deleted.

---

## 9. Features Not Yet Implemented (Frontend)

The following features are confirmed as not yet started on the frontend as of v1.57.16. Backend endpoints exist for all items marked with ✅.

| Feature | Backend Endpoint | Status |
|---------|-----------------|--------|
| Photo capture and upload | `POST /buildings/:id/photos` ✅ | **Removed in v1.57.15** — may be re-added in a future version |
| Building transfer between sessions | Not yet designed | Not started |
| Batch building operations | Not yet designed | Not started |
| Customer profile view | `GET /customers/:id` ✅ | Not started |
| Customer edit/delete | `PATCH/DELETE /customers/:id` ✅ | Not started |
| Sync conflict resolution | Not yet designed | Not started |
| Token refresh mechanism | Not yet designed | Not started |

---

## 10. Test Credentials

| Role | Email | Password (plain) | Password (base64) |
|------|-------|-----------------|-------------------|
| Admin | `admin@admin.com` | `admin123` | `YWRtaW4xMjM=` |
| Regular user (URBAN-SPIRIT) | Contact backend team | — | — |
| Regular user (TESTCO) | `supervisor2@test.com` | Contact backend team | — |

> **Note:** Test user passwords for regular accounts should be obtained directly from the backend team. Do not store plain-text passwords in this document.

---

## 11. Sign-off

Both teams have reviewed and signed off on this document (v1.1.0).

| Team | Representative | Signature | Date |
|------|---------------|-----------|------|
| Backend | Backend Team | ✅ Signed — v4.5.4 deployed and verified | March 6, 2026 |
| Frontend (Mobile App) | Frontend Team | ✅ Signed — v1.57.16 released and verified | March 6, 2026 |

---

*Document v1.1.0 prepared jointly by the backend and frontend teams on March 6, 2026. This document supersedes v1.0.0 (March 4, 2026).*
