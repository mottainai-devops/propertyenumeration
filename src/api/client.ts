import { nativeHttp } from './nativeHttp';

// ─── API client: uses CapacitorHttp (OkHttp on Android) to bypass WebView
// SSL/CORS restrictions that cause ERR_NETWORK on Android devices.
// The nativeHttp adapter mirrors the axios interface used throughout this file.

// Inject auth token before every request by patching the common headers
// (nativeHttp reads defaultHeaders.common on each request)
const getApiClient = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    nativeHttp.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete nativeHttp.defaults.headers.common['Authorization'];
  }
  return nativeHttp;
};

// Alias so all existing code that calls `apiClient.get/post/...` works unchanged
const apiClient = {
  get: (url: string, config?: any) => { getApiClient(); return nativeHttp.get(url, config); },
  post: (url: string, data?: any, config?: any) => { getApiClient(); return nativeHttp.post(url, data, config); },
  put: (url: string, data?: any, config?: any) => { getApiClient(); return nativeHttp.put(url, data, config); },
  patch: (url: string, data?: any, config?: any) => { getApiClient(); return nativeHttp.patch(url, data, config); },
  delete: (url: string, config?: any) => { getApiClient(); return nativeHttp.delete(url, config); },
};

// ─── Building Interface ────────────────────────────────────────────────────────
// NOTE: The backend returns flat gpsLatitude/gpsLongitude and photoUrls[].
// We normalise the response in buildingApi helpers so the rest of the app
// always works with the canonical shape below.
export interface Building {
  _id: string;
  buildingId?: string;          // Auto-generated code e.g. "URBAN-SPIRITLOT-6001"
  arcgisBuildingId?: string;    // ArcGIS polygon ID (separate from auto-generated buildingId)
  address: string;
  lotCode: string;
  propertyType: string;         // Backend stores title-case: Residential|Commercial|Industrial|Mixed-Use
  numberOfUnits: number;
  buildingName?: string;
  landmarkDescription?: string;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  notes?: string;
  unitCode?: string;            // Multi-customer unit code e.g. R1, R2, C1, C2
  gpsCoordinates: {             // Normalised from flat gpsLatitude/gpsLongitude
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  photos: string[];             // Normalised from photoUrls[]
  userId?: string;
  companyId?: string;
  linkedCustomerId?: string;
  linkedCustomerName?: string;
  enumeratedAt?: string;        // Backend field name
  createdAt?: string;
  updatedAt?: string;
}

// ─── Raw backend building shape (before normalisation) ────────────────────────
interface RawBuilding {
  _id?: string;
  buildingId?: string;
  arcgisBuildingId?: string;
  address: string;
  lotCode: string;
  propertyType: string;
  numberOfUnits: number;
  buildingName?: string;
  landmarkDescription?: string;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  notes?: string;
  unitCode?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsCoordinates?: { latitude: number; longitude: number; accuracy?: number };
  photoUrls?: string[];
  photos?: string[];
  linkedCustomerId?: string;
  linkedCustomerName?: string;
  enumeratedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

/** Normalise a raw backend building object into the canonical Building shape */
function normaliseBuilding(raw: RawBuilding): Building {
  // Guard: if raw is a string (CapacitorHttp failed to parse JSON), try to parse it
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw as unknown as string); } catch { raw = {} as RawBuilding; }
  }
  return {
    ...raw,
    _id: raw._id ?? raw.buildingId ?? '',
    // Ensure buildingId is always explicitly set (not just via spread)
    buildingId: raw.buildingId ?? raw._id ?? '',
    gpsCoordinates: raw.gpsCoordinates ?? {
      latitude: raw.gpsLatitude ?? 0,
      longitude: raw.gpsLongitude ?? 0,
    },
    photos: raw.photos ?? raw.photoUrls ?? [],
  };
}

// ─── Create Building Request ───────────────────────────────────────────────────
export interface CreateBuildingRequest {
  sessionId?: string;           // FIX #1: Must include active sessionId in every create call
  address: string;
  lotCode: string;
  propertyType: string;
  numberOfUnits: number;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  buildingName?: string;
  arcgisBuildingId?: string;    // ArcGIS polygon ID (stored separately from auto-generated buildingId)
  unitCode?: string;            // Multi-customer unit code e.g. R1, R2, C1, C2
  landmarkDescription?: string;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  notes?: string;
}

// ─── Update Building Request ───────────────────────────────────────────────────
export interface UpdateBuildingRequest {
  address?: string;
  buildingName?: string;
  propertyType?: string;
  numberOfUnits?: number;
  landmarkDescription?: string;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  notes?: string;
}

// ─── Customer Interface ────────────────────────────────────────────────────────
// FIX #6: Backend returns name (not customerName) and isDigitalized (not digitalizationStatus)
export interface Customer {
  _id: string;
  customerId?: string;          // e.g. "CUST-001"
  name: string;                 // FIX: was customerName — backend returns 'name'
  customerName?: string;        // Kept for backward compat with any cached data
  email?: string;
  phone?: string;               // FIX: was phoneNumber — backend returns 'phone'
  phoneNumber?: string;         // Kept for backward compat
  address?: string;
  lotCode?: string;
  isDigitalized?: boolean;      // FIX: was digitalizationStatus — backend returns boolean
  digitalizationStatus?: 'digitalized' | 'not-digitalized'; // Kept for backward compat
  propertyType?: string;         // Some backends return this on customer objects
  linkedBuildingId?: string;
  linkedBuildingAddress?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Normalise a raw customer so both old and new field names work.
 * DB (customerdatas collection) stores the display name as 'fullName'.
 * Some older API responses use 'name' or 'customerName'.
 * Priority: fullName > name > customerName
 */
function normaliseCustomer(raw: any): Customer {
  // Sanitise address: some legacy records have survey payment URLs stored in the address field.
  // These come from the old Survey123 webhook flow and should not be shown to users.
  const rawAddress: string = raw.address ?? raw.buildingAddress ?? '';
  const isUrl = rawAddress.startsWith('http://') || rawAddress.startsWith('https://');
  const safeAddress = isUrl ? '' : rawAddress;
  return {
    ...raw,
    name: raw.fullName ?? raw.name ?? raw.customerName ?? '',
    phone: raw.phone ?? raw.phoneNumber ?? '',
    address: safeAddress,
    isDigitalized: raw.isDigitalized ?? (raw.digitalizationStatus === 'digitalized'),
  };
}

// ─── Customer Search Params ────────────────────────────────────────────────────
export interface CustomerSearchParams {
  query: string;
  limit?: number;
  page?: number;
  lotCode?: string;
  companyId?: string;  // Filter to company's own records only (data segregation)
}

// ─── Auth Interfaces ───────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface Lot {
  lotCode: string;
  lotName: string;
  companyName?: string;
}

// Contract v1.2.0 §2.1: Login response shape
// companyId is the canonical company identifier (string code e.g. "URBAN-SPIRIT", null for admin)
// ownerCompanyId / companyName / monthlyBilling do NOT exist on the backend user object
// Company info is in the separate `company` object
export interface LoginResponse {
  token: string;
  user: {
    _id: string;                  // Normalised from 'id' if needed
    id?: string;                  // Backend may return 'id' instead of '_id'
    email: string;
    fullName: string;
    phone?: string;
    role: string;                 // 'admin' | 'user' | 'superadmin' | 'cherry_picker'
    companyId?: string | null;    // String code e.g. "URBAN-SPIRIT", null for admin (v1.2.0 canonical)
    ownerCompanyId?: string | null; // Derived client-side from companyId for backward compat
    companyName?: string | null;  // Derived client-side from company.companyName for backward compat
    defaultLotCode?: string | null;
    assignedLots: Lot[];
    // Nested company object returned by backend (v4.5.4+)
    company?: {
      _id?: string;
      companyId?: string;         // String code e.g. "URBAN-SPIRIT"
      companyName?: string;
      operationalLots?: Lot[];
      pin?: string;
      active?: boolean;
    };
  };
  // Top-level company object (v1.2.0 — company info lives here, not on user)
  company?: {
    companyId: string;
    companyName: string;
    operationalLots?: Lot[];
    pin?: string;
    active?: boolean;
  } | null;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    // Backend requires base64-encoded password
    const encodedPassword = btoa(credentials.password);
    const response = await apiClient.post('/api/mobile/users/login', {
      email: credentials.email,
      password: encodedPassword,
    });
    // v1.2.0: Backend returns { success, token, user, company } (not nested under data)
    // Fallback to data envelope for older backend versions
    const envelope = response.data?.data ?? response.data;
    const result: LoginResponse = {
      token: envelope.token,
      user: envelope.user,
      company: envelope.company ?? null,
    };
    // Derive ownerCompanyId for backward compat:
    // v1.2.0: user.companyId IS the string code (e.g. "URBAN-SPIRIT")
    // Fallback: derive from top-level company object or company name slug
    if (result?.user && !result.user.ownerCompanyId) {
      const topCompany = result.company;
      const nestedCompany = result.user.company;
      const cName: string = topCompany?.companyName ?? nestedCompany?.companyName ?? '';
      result.user.ownerCompanyId =
        result.user.companyId ||
        topCompany?.companyId ||
        nestedCompany?.companyId ||
        (cName ? cName.trim().toUpperCase().replace(/\s+/g, '-') : null);
    }
    return result;
  },

  me: async (): Promise<LoginResponse['user']> => {
    const response = await apiClient.get('/api/mobile/users/me');
    // v1.2.0 §2.2: /me returns { success, user, company } — same shape as login
    const envelope = response.data?.data ?? response.data;
    const raw = envelope.user ?? envelope;
    const topCompany = envelope.company ?? null;

    // Derive ownerCompanyId for backward compat:
    // v1.2.0: user.companyId IS the string code (e.g. "URBAN-SPIRIT")
    const cName: string = topCompany?.companyName ?? raw.company?.companyName ?? raw.companyName ?? '';
    const derivedCompanyId: string | null =
      raw.companyId ||
      topCompany?.companyId ||
      raw.company?.companyId ||
      (cName ? cName.trim().toUpperCase().replace(/\s+/g, '-') : null);

    return {
      ...raw,
      _id: raw._id ?? raw.id ?? '',
      fullName: raw.fullName ?? raw.name ?? '',
      companyId: raw.companyId ?? null,
      ownerCompanyId: derivedCompanyId,  // backward compat alias for companyId
      companyName: topCompany?.companyName ?? raw.company?.companyName ?? null,
      defaultLotCode: raw.defaultLotCode ?? null,
      company: raw.company ?? topCompany ?? (raw.companyId ? {
        companyId: raw.companyId,
        companyName: topCompany?.companyName ?? '',
      } : undefined),
      assignedLots: raw.assignedLots ?? [],
    };
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.patch('/api/mobile/users/me/password', {
      currentPassword: btoa(data.currentPassword),
      newPassword: btoa(data.newPassword),
    });
  },

  // Contract v1.0.0 §2.3: Server-side logout — invalidates token in backend blacklist
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/api/mobile/users/logout', {});
    } catch {
      // Ignore errors — even if the server call fails, we still clear local state
    }
  },
};

// ─── Building API ──────────────────────────────────────────────────────────────
export const buildingApi = {
  create: async (data: CreateBuildingRequest): Promise<Building> => {
    // Step 1: Always create the building as JSON (CapacitorHttp handles JSON reliably)
    const jsonBody: Record<string, any> = {
      address: data.address,
      lotCode: data.lotCode,
      propertyType: data.propertyType,
      numberOfUnits: data.numberOfUnits,
      gpsLatitude: data.gpsCoordinates.latitude,
      gpsLongitude: data.gpsCoordinates.longitude,
    };
    if (data.sessionId) jsonBody.sessionId = data.sessionId;
    if (data.buildingName) jsonBody.buildingName = data.buildingName;
    if (data.arcgisBuildingId) jsonBody.arcgisBuildingId = data.arcgisBuildingId;
    if (data.unitCode) jsonBody.unitCode = data.unitCode;
    if (data.landmarkDescription) jsonBody.landmarkDescription = data.landmarkDescription;
    if (data.contactPersonName) jsonBody.contactPersonName = data.contactPersonName;
    if (data.contactPhoneNumber) jsonBody.contactPhoneNumber = data.contactPhoneNumber;
    if (data.notes) jsonBody.notes = data.notes;

    const response = await apiClient.post('/api/property-enumeration/buildings', jsonBody);
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    const building = normaliseBuilding(raw);

    return building;
  },

  list: async (params?: {
    page?: number;
    limit?: number;
    sessionId?: string;
    lotCode?: string;
    propertyType?: string;
    search?: string;
    arcgisBuildingId?: string;  // Filter by ArcGIS polygon to count units
  }): Promise<{ buildings: Building[]; pagination?: any }> => {
    const response = await apiClient.get('/api/property-enumeration/buildings', { params });
    const buildings: RawBuilding[] = response.data?.data?.buildings ?? [];
    return {
      buildings: buildings.map(normaliseBuilding),
      pagination: response.data?.data?.pagination,
    };
  },

  update: async (id: string, data: UpdateBuildingRequest): Promise<Building> => {
    const response = await apiClient.patch(`/api/property-enumeration/buildings/${id}`, data);
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    return normaliseBuilding(raw);
  },

  // Photo upload: uploads each photo in a separate request to work around CapacitorHttp's
  // FormData multi-file limitation on Android (only the first file is sent when multiple
  // files share the same field name in a single intercepted fetch() call).
  // Backend multer expects field name 'photos' (plural) and allows up to 4 photos per building.
  //
  // IMPORTANT: We use nativeHttp.post() (CapacitorHttp.request) instead of fetch() here.
  // With CapacitorHttp.enabled=true, fetch() is patched by the WebView layer which has a
  // known bug where it silently drops File objects from FormData on some Android versions.
  // nativeHttp.post() goes through our serializeFormData() helper which correctly converts
  // File/Blob objects to base64 data URIs before passing to CapacitorHttp.request().
  addPhotos: async (buildingId: string, photos: (File | Blob)[]): Promise<{ photoUrls: string[]; totalPhotos: number }> => {
    const url = `/api/property-enumeration/buildings/${buildingId}/photos`;

    let lastResult: { photoUrls: string[]; totalPhotos: number } = { photoUrls: [], totalPhotos: 0 };

    // Upload each photo individually — one FormData per photo to avoid multi-file serialization issues
    for (const photo of photos) {
      const formData = new FormData();
      // Ensure we always pass a File (not bare Blob) so the filename is preserved
      const file = photo instanceof File
        ? photo
        : new File([photo], `photo-${Date.now()}.jpg`, { type: photo.type || 'image/jpeg' });
      formData.append('photos', file);

      let response: any;
      try {
        // Use apiClient.post (which calls getApiClient() to set auth token, then nativeHttp.post)
        // This correctly serializes FormData with files via serializeFormData() in nativeHttp
        response = await apiClient.post(url, formData);
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
        // If we hit the 4-photo limit, stop uploading but don't throw — partial upload is OK
        if (status === 400 && text.includes('Can only upload')) {
          console.warn(`[BuildingAPI] Photo limit reached for building ${buildingId}: ${text}`);
          break;
        }
        throw new Error(`Photo upload failed with status ${status ?? 'unknown'}: ${text}`);
      }

      lastResult = {
        photoUrls: response?.data?.data?.photoUrls ?? [],
        totalPhotos: response?.data?.data?.totalPhotos ?? 0,
      };
    }

    return lastResult;
  },

  // Contract v1.0.0 §3.6: Delete photo by index (not URL) — DELETE /buildings/:id/photos/:photoIndex
  deletePhoto: async (buildingId: string, photoIndex: number): Promise<{ photoUrls: string[]; totalPhotos: number }> => {
    const response = await apiClient.delete(
      `/api/property-enumeration/buildings/${buildingId}/photos/${photoIndex}`
    );
    return {
      photoUrls: response.data?.data?.photoUrls ?? [],
      totalPhotos: response.data?.data?.totalPhotos ?? 0,
    };
  },
};

// ─── Customer Import Interfaces ──────────────────────────────────────────────
export interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface BulkCustomer {
  customerName: string;
  address: string;
  lotCode: string;
  phone?: string;
  email?: string;
  // Contract v1.0.0 §5.3: customerType must be capitalised; all three types supported
  customerType?: 'Residential' | 'Commercial' | 'Industrial';
  customerId?: string;
}

// ─── Customer API ──────────────────────────────────────────────────────────────
export const customerApi = {
  search: async (params: CustomerSearchParams): Promise<Customer[]> => {
    // Contract v1.0.0 §5.2: Use dedicated search endpoint (backend v4.5.4+)
    // Falls back to list endpoint if dedicated search returns 404 (pre-v4.5.4 servers)
    let response: any;
    try {
      response = await apiClient.get('/api/property-enumeration/customers/search', {
        params: {
          q: params.query,          // Dedicated search endpoint uses 'q' key
          lotCode: params.lotCode,
          limit: params.limit,
          companyId: params.companyId,  // Data segregation: filter to own company only
        },
      });
    } catch (err: any) {
      const status: number = err?.response?.status ?? 0;
      const backendMsg: string = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Unknown error';
      // 404 with 'customerId' in details = dedicated endpoint not yet deployed
      // Fall back to list endpoint for backward compatibility
      const isEndpointMissing = status === 404 && err?.response?.data?.details?.customerId === 'search';
      if (isEndpointMissing) {
        console.warn('[customerApi.search] Dedicated search endpoint not available, falling back to list endpoint');
        try {
          const fallback = await apiClient.get('/api/property-enumeration/customers', {
            params: { search: params.query, lotCode: params.lotCode, limit: params.limit, page: params.page },
          });
          const fallbackRaw: any[] = fallback.data?.data?.customers ?? fallback.data?.customers ?? [];
          return fallbackRaw.map(normaliseCustomer);
        } catch { return []; }
      }
      // 404 without the endpoint-missing signature = no customers yet
      if (status === 404) return [];
      const rethrow = new Error(backendMsg) as any;
      rethrow.httpStatus = status;
      throw rethrow;
    }
    if (response.data?.success === false) {
      const msg = response.data?.error || response.data?.message || 'Search failed';
      console.error(`[customerApi.search] success:false — ${msg}`);
      return [];
    }
    // Search endpoint returns { data: { customers: [...], count: N } }
    const raw: any[] = response.data?.data?.customers ?? response.data?.customers ?? [];
    return raw.map(normaliseCustomer);
  },

  // v1.58.2: Use MongoDB _id to link to a specific unit (R1, R2, C1, etc.).
  // Sending arcgisBuildingId (parent polygon) is ambiguous when multiple units share
  // the same polygon — the backend picks the first match. _id is always unit-specific.
  link: async (customerId: string, buildingMongoId: string): Promise<void> => {
    await apiClient.post(`/api/property-enumeration/customers/${customerId}/link`, {
      buildingId: buildingMongoId,  // MongoDB _id of the specific unit (R1, R2, C1, etc.)
    });
  },

  // v1.58.2: Use MongoDB _id for unlink — same reason as link above.
  unlink: async (customerId: string, buildingMongoId: string): Promise<void> => {
    await apiClient.delete(`/api/property-enumeration/customers/${customerId}/unlink`, {
      data: { buildingId: buildingMongoId },  // MongoDB _id of the specific unit
    });
  },

  // v4.3.0: CSV import via JSON bulk endpoint (backend v4.3.0 fixed).
  // Parses CSV locally, capitalises customerType, POSTs JSON array via CapacitorHttp.
  importCsv: async (customers: BulkCustomer[], ownerCompanyId: string): Promise<ImportResult> => {
    const response = await apiClient.post('/api/property-enumeration/customers/bulk', {
      ownerCompanyId,
      customers,
    });
    const json = response.data;
    // Backend v4.3.0 returns: { success, data: { created, updated, failed, errors } }
    // Fallback covers older shapes: { results } or flat { created, updated, failed, errors }
    const d = json?.data ?? json?.results ?? json;
    return {
      created: d?.created ?? 0,
      updated: d?.updated ?? 0,
      failed: d?.failed ?? d?.skipped ?? 0,
      errors: d?.errors ?? [],
    };
  },

  // Alias kept for direct use
  bulkImport: async (customers: BulkCustomer[], ownerCompanyId: string): Promise<ImportResult> => {
    const response = await apiClient.post('/api/property-enumeration/customers/bulk', {
      ownerCompanyId,
      customers,
    });
    const d = response.data?.data ?? response.data?.results ?? response.data;
    return {
      created: d?.created ?? 0,
      updated: d?.updated ?? 0,
      failed: d?.failed ?? d?.skipped ?? 0,
      errors: d?.errors ?? [],
    };
  },
};

// ─── Session Interfaces ────────────────────────────────────────────────────────
// NOTE: Backend returns sessionId (not _id) as the session identifier.
// We normalise this in sessionApi helpers so the rest of the app uses _id.
export interface Session {
  _id: string;                  // Normalised from sessionId
  userId?: string;
  companyId?: string;
  lotCode: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  startLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  buildingsEnumerated: number;
  customersLinked: number;
  photosUploaded: number;
  areasCovered: string[];
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RawSession {
  _id?: string;
  sessionId?: string;
  userId?: string;
  companyId?: string;
  lotCode: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  startLocation?: { latitude: number; longitude: number; accuracy?: number };
  endLocation?: { latitude: number; longitude: number; accuracy?: number };
  buildingsEnumerated?: number;
  customersLinked?: number;
  photosUploaded?: number;
  areasCovered?: string[];
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

/** Normalise raw session: map sessionId → _id, fill defaults */
function normaliseSession(raw: RawSession): Session {
  return {
    ...raw,
    _id: raw._id ?? raw.sessionId ?? '',
    buildingsEnumerated: raw.buildingsEnumerated ?? 0,
    customersLinked: raw.customersLinked ?? 0,
    photosUploaded: raw.photosUploaded ?? 0,
    areasCovered: raw.areasCovered ?? [],
    startLocation: raw.startLocation ?? { latitude: 0, longitude: 0 },
  };
}

export interface StartSessionRequest {
  lotCode: string;
  startLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  notes?: string;
}

// FIX #2: Session start 409 conflict — backend returns existing session in details
export interface SessionConflictError {
  isConflict: true;
  existingSessionId: string;
  existingStartTime: string;
  existingLotCode: string;
}

export interface EndSessionRequest {
  endLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  notes?: string;
}

export interface SessionStatistics {
  period: string;
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalBuildingsEnumerated: number;
  totalDurationMinutes: number;
  averageBuildingsPerSession: number;
  averageDurationMinutes: number;
  lotBreakdown: {
    [lotCode: string]: {
      sessions: number;
      buildings: number;
      durationMinutes: number;
    };
  };
}

// ─── Session API ───────────────────────────────────────────────────────────────
export const sessionApi = {
  // Contract v1.2.0 §4.1 Gap 3 correction: correct URL is POST /sessions/start (not /sessions)
  start: async (data: StartSessionRequest): Promise<Session | SessionConflictError> => {
    try {
      const response = await apiClient.post('/api/property-enumeration/sessions/start', data);
      const raw: RawSession = response.data?.data?.session ?? response.data?.data ?? response.data;
      return normaliseSession(raw);
    } catch (error: any) {
      // 409 = already have an active session
      if (error?.response?.status === 409) {
        const details = error.response.data?.details;
        return {
          isConflict: true,
          existingSessionId: details?.sessionId ?? '',
          existingStartTime: details?.startTime ?? '',
          existingLotCode: details?.lotCode ?? '',
        };
      }
      throw error;
    }
  },

  end: async (sessionId: string, data: EndSessionRequest): Promise<Session> => {
    const response = await apiClient.post(
      `/api/property-enumeration/sessions/${sessionId}/end`,
      { endLocation: data.endLocation }
    );
    const raw: RawSession = response.data?.data?.session ?? response.data;
    return normaliseSession(raw);
  },

  list: async (): Promise<Session[]> => {
    const response = await apiClient.get('/api/property-enumeration/sessions');
    const sessions: RawSession[] = response.data?.data?.sessions ?? [];
    return sessions.map(normaliseSession);
  },

  getById: async (sessionId: string): Promise<Session> => {
    const response = await apiClient.get(`/api/property-enumeration/sessions/${sessionId}`);
    const raw: RawSession = response.data?.data?.session ?? response.data;
    return normaliseSession(raw);
  },

  getStatistics: async (): Promise<SessionStatistics> => {
    const response = await apiClient.get('/api/property-enumeration/sessions/statistics');
    return response.data?.data?.statistics ?? response.data?.data ?? {};
  },

  // NEW in backend v4.0.0: get all buildings registered in a specific session
  getBuildings: async (sessionId: string): Promise<{ buildings: Building[]; total: number }> => {
    const response = await apiClient.get(`/api/property-enumeration/sessions/${sessionId}/buildings`);
    const raw: RawBuilding[] = response.data?.data?.buildings ?? [];
    const total: number = response.data?.data?.total ?? raw.length;
    return {
      buildings: raw.map(normaliseBuilding),
      total,
    };
  },
};

export default apiClient;
