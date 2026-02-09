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

// Building Interface
export interface Building {
  _id: string;
  address: string;
  lotCode: string;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'mixed-use';
  numberOfUnits: number;
  buildingName?: string;
  notes?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  photos: string[];
  userId: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

// Create Building Request
export interface CreateBuildingRequest {
  address: string;
  lotCode: string;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'mixed-use';
  numberOfUnits: number;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  buildingName?: string;
  notes?: string;
  photos?: File[];
}

// Customer Interface
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

// Customer Search Params
export interface CustomerSearchParams {
  query: string;
  limit?: number;
  digitalizationStatus?: 'digitalized' | 'not-digitalized';
  propertyType?: string;
}

// Auth API
export interface LoginRequest {
  email: string;
  password: string;
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
  };
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/users/login', credentials);
    return response.data;
  },
};

// Building API
export const buildingApi = {
  create: async (data: CreateBuildingRequest): Promise<Building> => {
    const formData = new FormData();
    formData.append('address', data.address);
    formData.append('lotCode', data.lotCode);
    formData.append('propertyType', data.propertyType);
    formData.append('numberOfUnits', data.numberOfUnits.toString());
    formData.append('gpsCoordinates', JSON.stringify(data.gpsCoordinates));
    
    if (data.buildingName) {
      formData.append('buildingName', data.buildingName);
    }
    if (data.notes) {
      formData.append('notes', data.notes);
    }
    if (data.photos) {
      data.photos.forEach((photo) => {
        formData.append('photos', photo);
      });
    }

    const response = await apiClient.post('/property-enumeration/buildings', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data.building;
  },

  list: async (): Promise<Building[]> => {
    const response = await apiClient.get('/property-enumeration/buildings');
    return response.data.data.buildings;
  },
};

// Customer API
export const customerApi = {
  search: async (params: CustomerSearchParams): Promise<Customer[]> => {
    // Use /customers endpoint with search query parameter (not /customers/search)
    const response = await apiClient.get('/property-enumeration/customers', { 
      params: { search: params.query, ...params } 
    });
    return response.data.data.customers;
  },

  link: async (customerId: string, buildingId: string): Promise<void> => {
    await apiClient.post(`/property-enumeration/customers/${customerId}/link`, { buildingId });
  },

  unlink: async (customerId: string): Promise<void> => {
    await apiClient.delete(`/property-enumeration/customers/${customerId}/unlink`);
  },
};

// Session Interfaces
export interface Session {
  _id: string;
  userId: string;
  companyId: string;
  lotCode: string;
  startTime: string;
  endTime?: string;
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
  createdAt: string;
  updatedAt: string;
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

// Session API
export const sessionApi = {
  start: async (data: StartSessionRequest): Promise<Session> => {
    const response = await apiClient.post('/property-enumeration/sessions/start', data);
    // Backend returns { success: true, data: { session: {...} } }
    return response.data.data.session;
  },

  end: async (sessionId: string, data: EndSessionRequest): Promise<Session> => {
    const response = await apiClient.post(`/property-enumeration/sessions/${sessionId}/end`, data);
    // Backend returns { success: true, data: { session: {...} } }
    return response.data.data.session;
  },

  list: async (): Promise<Session[]> => {
    const response = await apiClient.get('/property-enumeration/sessions');
    // Backend returns { success: true, data: { sessions: [...], pagination: {...} } }
    return response.data.data.sessions;
  },

  getById: async (sessionId: string): Promise<Session> => {
    const response = await apiClient.get(`/property-enumeration/sessions/${sessionId}`);
    // Backend returns { success: true, data: { session: {...}, buildings: [...] } }
    return response.data.data.session;
  },

  getStatistics: async (): Promise<SessionStatistics> => {
    const response = await apiClient.get('/property-enumeration/sessions/statistics');
    // Backend returns { success: true, data: { statistics: {...} } }
    return response.data.data.statistics;
  },
};

export default apiClient;
