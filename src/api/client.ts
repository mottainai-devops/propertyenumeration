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

export interface LoginResponse {
  token: string;
  user: {
    _id: string;
    email: string;
    fullName: string;
    role: string;
    company: {
      _id: string;
      companyName: string;
    };
    assignedLots: Lot[];
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
    return response.data;
  },

  me: async (): Promise<LoginResponse['user']> => {
    const response = await apiClient.get('/api/mobile/users/me');
    return response.data?.data?.user ?? response.data;
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

  // FIX #3: Photo upload response returns { photoUrls, totalPhotos } not { building }
  addPhotos: async (buildingId: string, photos: File[]): Promise<{ photoUrls: string[]; totalPhotos: number }> => {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photos', photo));
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

  // FIX #3: Photo delete response also returns { photoUrls, totalPhotos } not { building }
  deletePhoto: async (buildingId: string, photoRef: string): Promise<{ photoUrls: string[]; totalPhotos: number }> => {
    const encoded = encodeURIComponent(photoRef);
    const response = await apiClient.delete(
      `/api/property-enumeration/buildings/${buildingId}/photos/${encoded}`
    );
    return {
      photoUrls: response.data?.data?.photoUrls ?? [],
      totalPhotos: response.data?.data?.totalPhotos ?? 0,
    };
  },
};

// ─── Customer API ──────────────────────────────────────────────────────────────
export const customerApi = {
  search: async (params: CustomerSearchParams): Promise<Customer[]> => {
    const response = await apiClient.get('/api/property-enumeration/customers', {
      params: {
        search: params.query,   // Backend uses 'search' key
        lotCode: params.lotCode,
        limit: params.limit,
        page: params.page,
      },
    });
    const raw: any[] = response.data?.data?.customers ?? [];
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
  // FIX #2: Handle 409 conflict gracefully — return existing session instead of throwing
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
};

export default apiClient;
