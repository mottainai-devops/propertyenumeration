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
  return {
    ...raw,
    _id: raw._id ?? raw.buildingId ?? '',
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
  photos?: File[];
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

/** Normalise a raw customer so both old and new field names work */
function normaliseCustomer(raw: any): Customer {
  return {
    ...raw,
    name: raw.name ?? raw.customerName ?? '',
    phone: raw.phone ?? raw.phoneNumber ?? '',
    isDigitalized: raw.isDigitalized ?? (raw.digitalizationStatus === 'digitalized'),
  };
}

// ─── Customer Search Params ────────────────────────────────────────────────────
export interface CustomerSearchParams {
  query: string;
  limit?: number;
  page?: number;
  lotCode?: string;
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

// Contract v1.0.0 §2.1: Login response shape (flat user object)
export interface LoginResponse {
  token: string;
  user: {
    _id: string;                  // Normalised from 'id' if needed
    id?: string;                  // Backend may return 'id' instead of '_id'
    email: string;
    fullName: string;
    phone?: string;
    role: string;                 // 'admin' | 'user' | 'superadmin' | 'cherry_picker'
    companyId?: string | null;    // MongoDB ObjectId or null for admin
    ownerCompanyId?: string | null; // String code e.g. "URBAN-SPIRIT", null for admin
    companyName?: string | null;  // Human-readable company name
    defaultLotCode?: string | null;
    monthlyBilling?: boolean;
    assignedLots: Lot[];
    // Legacy nested company object (some backend versions)
    company?: {
      _id: string;
      companyId?: string;
      companyName: string;
    };
  };
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    // Backend requires base64-encoded password
    const encodedPassword = btoa(credentials.password);
    const response = await apiClient.post('/api/mobile/users/login', {
      email: credentials.email,
      password: encodedPassword,
    });
    // Backend envelope: { success: true, data: { token, user } }
    // parseData() in nativeHttp now correctly parses the response body,
    // so response.data is the full envelope — we need the inner data object.
    const result: LoginResponse = response.data?.data ?? response.data;
    // Derive ownerCompanyId from company name if not explicitly set by backend
    if (result?.user && !result.user.ownerCompanyId) {
      const cName: string = result.user.company?.companyName ?? '';
      result.user.ownerCompanyId =
        result.user.company?.companyId ||
        (cName ? cName.trim().toUpperCase().replace(/\s+/g, '-') : undefined);
    }
    return result;
  },

  me: async (): Promise<LoginResponse['user']> => {
    const response = await apiClient.get('/api/mobile/users/me');
    // Contract v1.0.0 §2.2: /me returns same shape as login user object
    const raw = response.data?.data?.user ?? response.data?.user ?? response.data;

    // Derive ownerCompanyId from multiple possible backend fields.
    // Priority: explicit ownerCompanyId > company.companyId > company.companyName slug
    const companyName: string =
      raw.companyName ?? raw.company?.companyName ?? '';
    const derivedCompanyId: string | undefined =
      raw.ownerCompanyId ||
      raw.company?.companyId ||
      raw.company?.ownerCompanyId ||
      // Convert company name to uppercase slug: "Urban Spirit" → "URBAN-SPIRIT"
      (companyName ? companyName.trim().toUpperCase().replace(/\s+/g, '-') : undefined);

    return {
      ...raw,
      _id: raw._id ?? raw.id ?? '',
      fullName: raw.fullName ?? raw.name ?? '',
      ownerCompanyId: derivedCompanyId ?? null,
      companyName: raw.companyName ?? raw.company?.companyName ?? null,
      defaultLotCode: raw.defaultLotCode ?? null,
      // Keep legacy nested company for backward compat
      company: raw.company ?? (raw.companyId ? {
        _id: raw.companyId,
        companyName: raw.companyName ?? '',
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
};

// ─── Building API ──────────────────────────────────────────────────────────────
export const buildingApi = {
  create: async (data: CreateBuildingRequest): Promise<Building> => {
    const formData = new FormData();
    formData.append('address', data.address);
    formData.append('lotCode', data.lotCode);
    formData.append('propertyType', data.propertyType);
    formData.append('numberOfUnits', data.numberOfUnits.toString());
    // Backend expects flat gpsLatitude / gpsLongitude fields
    formData.append('gpsLatitude', data.gpsCoordinates.latitude.toString());
    formData.append('gpsLongitude', data.gpsCoordinates.longitude.toString());

    // FIX #1: Include sessionId so the backend can count buildings per session
    if (data.sessionId) formData.append('sessionId', data.sessionId);
    if (data.buildingName) formData.append('buildingName', data.buildingName);
    // FIX: Send ArcGIS polygon ID as arcgisBuildingId (separate from auto-generated buildingId)
    if (data.arcgisBuildingId) formData.append('arcgisBuildingId', data.arcgisBuildingId);
    if (data.unitCode) formData.append('unitCode', data.unitCode);
    if (data.landmarkDescription) formData.append('landmarkDescription', data.landmarkDescription);
    if (data.contactPersonName) formData.append('contactPersonName', data.contactPersonName);
    if (data.contactPhoneNumber) formData.append('contactPhoneNumber', data.contactPhoneNumber);
    if (data.notes) formData.append('notes', data.notes);
    if (data.photos) {
      data.photos.forEach((photo) => formData.append('photos', photo));
    }

    const response = await apiClient.post('/api/property-enumeration/buildings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    return normaliseBuilding(raw);
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

  // Contract v1.0.0 §3.5: Photo upload field name is `photo` (singular), multipart/form-data
  addPhotos: async (buildingId: string, photos: File[]): Promise<{ photoUrls: string[]; totalPhotos: number }> => {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photo', photo));
    const response = await apiClient.post(
      `/api/property-enumeration/buildings/${buildingId}/photos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return {
      photoUrls: response.data?.data?.photoUrls ?? [],
      totalPhotos: response.data?.data?.totalPhotos ?? 0,
    };
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
    let response: any;
    try {
      response = await apiClient.get('/api/property-enumeration/customers', {
        params: {
          search: params.query,   // Backend uses 'search' key
          lotCode: params.lotCode,
          limit: params.limit,
          page: params.page,
        },
      });
    } catch (err: any) {
      // nativeHttp throws for non-2xx. Read status from err.response
      const status: number = err?.response?.status ?? 0;
      const backendMsg: string = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown error';
      console.error(`[customerApi.search] HTTP ${status}: ${backendMsg}`);
      // 404 = no customers loaded yet for this company — treat as empty list
      if (status === 404) return [];
      // Re-throw with a clear message including the HTTP status
      const rethrow = new Error(backendMsg) as any;
      rethrow.httpStatus = status;
      throw rethrow;
    }
    // Also handle cases where backend returns success:false with 200
    if (response.data?.success === false) {
      const msg = response.data?.message || 'Search failed';
      console.error(`[customerApi.search] success:false — ${msg}`);
      return [];
    }
    const raw: any[] = response.data?.data?.customers ?? response.data?.customers ?? [];
    return raw.map(normaliseCustomer);
  },

  // FIX #5: Backend expects buildingId CODE (e.g. "URBAN-SPIRITLOT-6005"), not MongoDB _id
  link: async (customerId: string, buildingIdCode: string): Promise<void> => {
    await apiClient.post(`/api/property-enumeration/customers/${customerId}/link`, {
      buildingId: buildingIdCode,  // Must be the auto-generated code, not MongoDB _id
    });
  },

  // FIX #4: Backend requires { buildingId } in the DELETE request body
  unlink: async (customerId: string, buildingIdCode: string): Promise<void> => {
    await apiClient.delete(`/api/property-enumeration/customers/${customerId}/unlink`, {
      data: { buildingId: buildingIdCode },
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
  // Contract v1.0.0 §4.1: Session start endpoint is POST /sessions (no /start suffix)
  start: async (data: StartSessionRequest): Promise<Session | SessionConflictError> => {
    try {
      const response = await apiClient.post('/api/property-enumeration/sessions', data);
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
