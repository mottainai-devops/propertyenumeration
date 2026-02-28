import axios from 'axios';

// API Base URL
const API_BASE_URL = 'https://upwork.kowope.xyz';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Building Interface ────────────────────────────────────────────────────────
// NOTE: The backend returns flat gpsLatitude/gpsLongitude and photoUrls[].
// We normalise the response in buildingApi helpers so the rest of the app
// always works with the canonical shape below.
export interface Building {
  _id: string;
  buildingId?: string;          // Auto-generated code e.g. "URBAN-SPIRITLOT-6001"
  address: string;
  lotCode: string;
  propertyType: string;         // Backend stores title-case: Residential|Commercial|Industrial|Mixed-Use
  numberOfUnits: number;
  buildingName?: string;
  landmarkDescription?: string;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  notes?: string;
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
  address: string;
  lotCode: string;
  propertyType: string;
  numberOfUnits: number;
  buildingName?: string;
  landmarkDescription?: string;
  contactPersonName?: string;
  contactPhoneNumber?: string;
  notes?: string;
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
  buildingId?: string;          // ArcGIS polygon ID
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
export interface Customer {
  _id: string;
  customerName: string;
  phoneNumber?: string;
  address?: string;
  propertyType?: string;
  digitalizationStatus?: 'digitalized' | 'not-digitalized';
  linkedBuildingId?: string;
  linkedBuildingAddress?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer Search Params ────────────────────────────────────────────────────
export interface CustomerSearchParams {
  query: string;
  limit?: number;
  page?: number;
  digitalizationStatus?: 'digitalized' | 'not-digitalized';
  propertyType?: string;
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

    if (data.buildingName) formData.append('buildingName', data.buildingName);
    if (data.landmarkDescription) formData.append('landmarkDescription', data.landmarkDescription);
    if (data.contactPersonName) formData.append('contactPersonName', data.contactPersonName);
    if (data.contactPhoneNumber) formData.append('contactPhoneNumber', data.contactPhoneNumber);
    if (data.notes) formData.append('notes', data.notes);
    if (data.photos) {
      data.photos.forEach((photo) => formData.append('photos', photo));
    }

    const response = await apiClient.post('/property-enumeration/buildings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    return normaliseBuilding(raw);
  },

  list: async (params?: { page?: number; limit?: number }): Promise<Building[]> => {
    const response = await apiClient.get('/property-enumeration/buildings', { params });
    const buildings: RawBuilding[] = response.data?.data?.buildings ?? [];
    return buildings.map(normaliseBuilding);
  },

  update: async (id: string, data: UpdateBuildingRequest): Promise<Building> => {
    const response = await apiClient.patch(`/property-enumeration/buildings/${id}`, data);
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    return normaliseBuilding(raw);
  },

  addPhotos: async (buildingId: string, photos: File[]): Promise<Building> => {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photos', photo));
    const response = await apiClient.post(
      `/property-enumeration/buildings/${buildingId}/photos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    const raw: RawBuilding = response.data?.data?.building ?? response.data;
    return normaliseBuilding(raw);
  },
};

// ─── Customer API ──────────────────────────────────────────────────────────────
export const customerApi = {
  search: async (params: CustomerSearchParams): Promise<Customer[]> => {
    const response = await apiClient.get('/api/property-enumeration/customers', {
      params: {
        search: params.query,   // Backend uses 'search' key
        limit: params.limit,
        page: params.page,
      },
    });
    return response.data?.data?.customers ?? [];
  },

  link: async (customerId: string, buildingId: string): Promise<void> => {
    await apiClient.post(`/api/property-enumeration/customers/${customerId}/link`, { buildingId });
  },

  unlink: async (customerId: string): Promise<void> => {
    await apiClient.delete(`/api/property-enumeration/customers/${customerId}/unlink`);
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
  startLocation: { latitude: number; longitude: number; accuracy?: number };
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
  start: async (data: StartSessionRequest): Promise<Session> => {
    const response = await apiClient.post('/property-enumeration/sessions/start', data);
    const raw: RawSession = response.data?.data?.session ?? response.data;
    return normaliseSession(raw);
  },

  end: async (sessionId: string, data: EndSessionRequest): Promise<Session> => {
    const response = await apiClient.post(
      `/property-enumeration/sessions/${sessionId}/end`,
      data
    );
    const raw: RawSession = response.data?.data?.session ?? response.data;
    return normaliseSession(raw);
  },

  list: async (): Promise<Session[]> => {
    const response = await apiClient.get('/property-enumeration/sessions');
    const sessions: RawSession[] = response.data?.data?.sessions ?? [];
    return sessions.map(normaliseSession);
  },

  getById: async (sessionId: string): Promise<Session> => {
    const response = await apiClient.get(`/property-enumeration/sessions/${sessionId}`);
    const raw: RawSession = response.data?.data?.session ?? response.data;
    return normaliseSession(raw);
  },

  getStatistics: async (): Promise<SessionStatistics> => {
    const response = await apiClient.get('/property-enumeration/sessions/statistics');
    return response.data?.data?.statistics ?? response.data?.data ?? {};
  },
};

export default apiClient;
