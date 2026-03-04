# Joint API Contract — Mottainai Property Enumeration System
> **Document Version:** v1.0.0  
> **Backend Version:** v4.5.0 (as of March 4, 2026)  
> **Mobile App Version:** v1.55.0  
> **Status:** ✅ Ready for Sign-off  
> **Authors:** Backend Team + Frontend Team  
> **Date:** March 4, 2026

---

## Executive Summary

This document is the authoritative, jointly agreed API contract between the mobile app frontend team and the backend team for the Mottainai Property Enumeration System. It supersedes all previous questionnaires, response documents, and informal agreements. Both teams must sign off on this document before proceeding with further feature development.

All four discrepancies identified in the Frontend Coordination Questionnaire Response (March 4, 2026) have been investigated and resolved. The findings are documented in Section 7.

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
    "defaultLotCode": "LOT-6",
    "assignedLots": [
      { "lotCode": "LOT-6", "lotName": "G R A (Ikeja)", "companyName": "URBAN SPIRIT" }
    ],
    "monthlyBilling": true
  }
}
```

**Admin User Response (200):**

When `role` is `admin`, `ownerCompanyId` and `companyName` are `null`, and `assignedLots` contains lots from all active companies.

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
    "assignedLots": [
      { "lotCode": "WAS-061", "lotName": "Main Operations", "companyName": "W ABDULSALAM MECH" },
      { "lotCode": "LOT-6", "lotName": "G R A (Ikeja)", "companyName": "URBAN SPIRIT" }
    ],
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
- Expiry: 30 days (from `admin.kowope.xyz` backend)
- The token is accepted by all property enumeration endpoints on `upwork.kowope.xyz`

### 2.2 Get Current User

**Endpoint:** `GET https://upwork.kowope.xyz/api/mobile/users/me`

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):** Same shape as the `user` object in the login response.

### 2.3 Logout

**Endpoint:** `POST https://upwork.kowope.xyz/api/mobile/users/logout`

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{ "success": true, "message": "Logged out successfully" }
```

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

> **Field Name Clarification:** The backend uses `gpsLatitude`/`gpsLongitude` (not `latitude`/`longitude`). The frontend questionnaire listed `latitude`/`longitude` — this has been confirmed as a discrepancy. The frontend must send `gpsLatitude` and `gpsLongitude`.

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

### 3.5 Upload Building Photo

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId/photos`

**Request:** `multipart/form-data` with field name `photo`.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "photoUrl": "https://s3.amazonaws.com/...",
    "photoUrls": ["https://s3.amazonaws.com/..."]
  }
}
```

### 3.6 Delete Building Photo

**Endpoint:** `DELETE https://upwork.kowope.xyz/api/property-enumeration/buildings/:buildingId/photos/:photoIndex`

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

> **Note on inconsistency (LOW priority):** Some older endpoints in the codebase use `message` instead of `error` as the key for the error text. The frontend's current fallback logic (`response.error || response.message`) correctly handles both cases. Standardisation to `error` is planned for a future cleanup pass but is not blocking.

**Standard HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (missing/invalid fields) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient role or company not found) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal server error |

**Token Expiry Handling:**

When a 401 is received, the app should show a toast and redirect to the login screen. Token refresh is not currently implemented. The admin backend issues tokens with a 30-day expiry; the legacy backend issues 1-hour tokens. **The mobile app should always use the `admin.kowope.xyz` or `upwork.kowope.xyz/api/mobile/users/login` endpoint**, which issues 30-day tokens.

---

## 7. Discrepancy Resolution Log

The following four discrepancies were identified in the Frontend Coordination Questionnaire Response dated March 4, 2026. Each has been investigated and resolved.

### Discrepancy 1 — Auth Backend Mismatch (RESOLVED ✅)

**Frontend reported:** App sends login to `upwork.kowope.xyz/api/mobile/users/login` but questionnaire said it should go to `admin.kowope.xyz`.

**Investigation result:** Both `upwork.kowope.xyz/api/mobile/users/login` and `admin.kowope.xyz/api/mobile/users/login` route to the same backend service (port 3003). The nginx configuration on `upwork.kowope.xyz` has a `/api/mobile` location block that proxies to `localhost:3003`. The frontend's current implementation is **correct and does not need to change**.

**Action required:** None. The frontend may continue using `upwork.kowope.xyz` as the single base URL.

### Discrepancy 2 — Lot Code Format (RESOLVED ✅)

**Frontend reported:** App sends `"lotCode": "LOT-27"` but questionnaire specified bare number `"27"`.

**Investigation result:** The JSON bulk import endpoint (`/customers/bulk`) normalises the `lotCode` field by stripping the `LOT-` prefix automatically:
```js
const lotCode = rawLotCode.replace(/^LOT-/i, '');
```
Similarly, the customer list endpoint also normalises the `lotCode` query parameter. **Both `"LOT-27"` and `"27"` are accepted.**

**Action required:** None blocking. The frontend may send either format. The bare number format (`"27"`) is the canonical internal format and is recommended for new development.

### Discrepancy 3 — Error Response Format Inconsistency (LOW PRIORITY)

**Frontend reported:** Some endpoints return `{ "error": "..." }`, some return `{ "message": "..." }`, some return nested `{ "results": { "errors": [...] } }`.

**Investigation result:** Confirmed. The `propertyEnumeration.js` route file uses `error` in 79 places and `message` in 23 places. The inconsistency is pre-existing and non-breaking because the frontend already implements fallback logic.

**Action required:** The frontend's current fallback (`response.error || response.message`) is the correct approach. A future cleanup pass will standardise all error responses to use `error`. This is tracked as a low-priority technical debt item.

### Discrepancy 4 — Building GPS Field Names (RESOLVED ✅)

**Frontend questionnaire listed:** `latitude`, `longitude` for building creation.

**Backend implementation uses:** `gpsLatitude`, `gpsLongitude`.

**Investigation result:** The building creation endpoint (`POST /buildings`) requires `gpsLatitude` and `gpsLongitude` as field names. The session start endpoint (`POST /sessions`) uses a nested `startLocation: { latitude, longitude }` object. These are intentionally different.

**Action required:** The frontend must send `gpsLatitude`/`gpsLongitude` for building creation, and `startLocation: { latitude, longitude }` for session start. This is documented in Sections 3.1 and 4.1 above.

---

## 8. ArcGIS Sync Status

The ArcGIS sync cron job (`arcgis_sync.mjs`) runs every 15 minutes via crontab. A bug was discovered and fixed on March 4, 2026 (v4.5.0): the script was calling `Company.findById(building.companyId)` which failed when `companyId` is a string code (e.g., `"TESTCO"`) rather than a MongoDB ObjectId. The fix replaces this with `Company.findOne({ companyId: building.companyId })`.

**Verification:** Manual test run on March 4, 2026 at 12:11 UTC confirmed successful sync:
- 26 buildings found in MongoDB
- 19 new features added to ArcGIS
- 7 existing features updated
- 0 features deleted

---

## 9. Features Not Yet Implemented (Frontend)

The following features are confirmed as not yet started on the frontend as of v1.55.0. Backend endpoints exist for all items marked with ✅.

| Feature | Backend Endpoint | Status |
|---------|-----------------|--------|
| Photo delete from building | `DELETE /buildings/:id/photos/:index` ✅ | Not started |
| Building transfer between sessions | Not yet designed | Not started |
| Batch building operations | Not yet designed | Not started |
| Session analytics/reports | `GET /sessions/:id` + stats ✅ | Not started |
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
| Regular user (TESTCO) | Contact backend team | — | — |

---

## 11. Sign-off

Both teams must review and sign off on this document before proceeding with further feature development.

| Team | Representative | Signature | Date |
|------|---------------|-----------|------|
| Backend | — | ☐ Pending | — |
| Frontend (Mobile App) | — | ☐ Pending | — |

---

*This document was prepared by the backend team on March 4, 2026, based on the Frontend Coordination Questionnaire Response (v1.55.0) and live investigation of the production system (v4.5.0).*
