# Building Sync Failure — Backend Debugging Report

**Date:** March 4, 2026 (original report)
**Resolved:** April 13, 2026
**Issue:** Buildings fail to sync — "Pending Retry" on all buildings; customer search returns empty
**Frontend Version at report:** v1.56.8 (Build #136)
**Resolution Version:** v1.65.6 (backend) + v1.65.7 (frontend)
**Status:** ✅ RESOLVED

---

## Resolution Summary (April 13, 2026)

### Root Cause 1 — Missing `/api/` prefix on backend routes

The backend `server.js` only had two legacy routes:
- `GET /property-enumeration/buildings`
- `POST /property-enumeration/buildings`

The app calls all endpoints under `/api/property-enumeration/` — every request was hitting the Nginx SPA catch-all and returning the React `index.html` (HTTP 200 with HTML body), which the app parsed as an API error and queued buildings as "Pending Retry".

**Fix:** Added 16 new routes under `/api/property-enumeration/` prefix to `server.js` (commit: `feat: add /api/property-enumeration/* routes`). Two helper functions were also added:
- `extractUserIdFromToken()` — decodes Bearer JWT to get userId
- `getCompanyIdForUser()` — looks up companyId from DB (JWT does not include it)

### Root Cause 2 — Customer name field mismatch

The MongoDB `customerdatas` collection stores the display name as `fullName`. The app's `normaliseCustomer()` function only checked `raw.name ?? raw.customerName`, so `name` resolved to `''`. The Link Customer dropdown then rendered the `phone` field as the primary label, showing `080`, `08090165915`, `+234 905 839 9881`, and `null` entries.

**Fix:** Updated `normaliseCustomer()` in `src/api/client.ts` to check `raw.fullName` first:
```ts
name: raw.fullName ?? raw.name ?? raw.customerName ?? ''
```

---

## Original Report (March 4, 2026)

**Test User:** adeyadewuyi@gmail.com / LOT-6 assigned

### Issue Timeline

| Version | Change | Result |
|---------|--------|--------|
| v1.56.3 | Initial sync failure reported | Still failing |
| v1.56.4 | Auto-generate buildingName if empty | Still failing |
| v1.56.5 | Include sessionId when syncing offline | Still failing |
| v1.56.6 | Remove manual Content-Type header | Still failing |
| v1.56.7 | Add detailed logging | Still failing |
| v1.56.8 | GPS coordinate validation & repair | Still failing |
| v1.65.6 | **Backend:** Add `/api/property-enumeration/*` routes | ✅ Buildings sync |
| v1.65.7 | **Frontend:** Fix `normaliseCustomer()` fullName mapping | ✅ Customer names display |

### API Endpoint Under Test

**Endpoint:** `POST https://upwork.kowope.xyz/api/property-enumeration/buildings`

**Contract Reference:** Joint API Contract v1.2.0 §3.1

### Required Fields (Per Contract §3.1)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `address` | string | ✅ Yes | Full street address |
| `lotCode` | string | ✅ Yes | Bare number format: "27" (not "LOT-27") |
| `propertyType` | string | ✅ Yes | One of: "Residential", "Commercial", "Industrial", "Mixed-Use" |
| `numberOfUnits` | number | ✅ Yes | Integer ≥ 1 |
| `gpsLatitude` | number | ✅ Yes | Decimal degrees, e.g. 6.5244 |
| `gpsLongitude` | number | ✅ Yes | Decimal degrees, e.g. 3.3792 |

**Optional Fields:**
- `buildingName`, `sessionId`, `landmarkDescription`, `contactPersonName`, `contactPhoneNumber`, `notes`, `arcgisBuildingId`, `unitCode`, `gpsAccuracy`, `photo` (multipart, repeatable)

### Frontend Implementation (unchanged — was always correct)

The frontend was sending all required fields correctly. The issue was entirely on the backend (missing routes). See `src/api/client.ts` `buildingApi.create()` for the current implementation.
