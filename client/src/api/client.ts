// Backend API base URL
// All endpoints use /api prefix per Backend Developer specifications
const API_BASE_URL = 'https://upwork.kowope.xyz';

// Fetch wrapper with JWT token and error handling
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('jwt_token');
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add Content-Type for JSON requests (unless it's FormData)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  // Handle 401 Unauthorized
  if (response.status === 401) {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  
  // Parse response
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `HTTP error! status: ${response.status}`);
  }
  
  return data;
}

// API Types
export interface Building {
  _id: string;
  buildingId: string;
  address: string;
  lotCode: string;
  propertyType: 'Residential' | 'Commercial' | 'Industrial' | 'Mixed-Use';
  numberOfUnits: number;
  gpsLatitude: number;
  gpsLongitude: number;
  photoUrls?: string[];
  buildingName?: string;
  notes?: string;
  companyId: string;
  enumeratedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuildingRequest {
  address: string;
  lotCode: string;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'institutional';
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  contactName?: string;
  contactPhone?: string;
  photos?: File[];
  // sessionId removed - backend automatically finds active session
}

export interface ListBuildingsParams {
  page?: number;
  limit?: number;
  lotCode?: string;
  propertyType?: string;
  search?: string;
}

// API Functions
export const buildingApi = {
  create: async (data: CreateBuildingRequest): Promise<Building> => {
    const formData = new FormData();
    formData.append('address', data.address);
    formData.append('lotCode', data.lotCode);
    formData.append('propertyType', data.propertyType);
    formData.append('gpsCoordinates[latitude]', data.gpsCoordinates.latitude.toString());
    formData.append('gpsCoordinates[longitude]', data.gpsCoordinates.longitude.toString());
    
    if (data.contactName) {
      formData.append('contactName', data.contactName);
    }
    if (data.contactPhone) {
      formData.append('contactPhone', data.contactPhone);
    }
    if (data.photos && data.photos.length > 0) {
      data.photos.forEach((photo) => {
        formData.append('photos', photo);
      });
    }
    // sessionId removed - backend automatically finds active session

    const responseData = await apiFetch('/api/property-enumeration/buildings', {
      method: 'POST',
      body: formData,
    });
    return responseData.data;
  },

  list: async (params?: ListBuildingsParams): Promise<{ buildings: Building[]; total: number; page: number; limit: number }> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const responseData = await apiFetch(`/api/property-enumeration/buildings${queryString}`);
    return responseData.data;
  },

  getById: async (buildingId: string): Promise<Building> => {
    const responseData = await apiFetch(`/api/property-enumeration/buildings/${buildingId}`);
    return responseData.data.building;
  },
};

// Auth API
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AssignedLot {
  lotCode: string;
  lotName: string;
  companyName?: string; // Only for admins/cherry_pickers
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string;
    role: string;
    companyId: string;
    defaultLotCode?: string; // NEW: Default lot for auto-fill
    assignedLots: AssignedLot[]; // NEW: Array of accessible lots
  };
  company: {
    companyId: string;
    companyName: string;
    operationalLots: Array<{
      lotCode: string;
      lotName: string;
      paytWebhook: string;
      monthlyWebhook: string;
    }>;
    pin: string;
    active: boolean;
  };
}

// Customer API Types
export interface Customer {
  _id: string;
  customerId: string;
  customerName: string;
  address: string;
  phoneNumber?: string;
  lotCode: string;
  buildingId?: string;
  isDigitalized: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchCustomersParams {
  q: string;
  lotCode?: string;
  digitalizationStatus?: string;
  propertyType?: string;
  limit?: number;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  lotCode?: string;
  isDigitalized?: boolean;
  buildingId?: string;
  search?: string;
}

export interface LinkCustomerRequest {
  buildingId: string;
}

// Customer API Functions
export const customerApi = {
  search: async (query: string, lotCode?: string): Promise<Customer[]> => {
    const params: any = { search: query };
    if (lotCode) params.lotCode = lotCode;
    const queryString = '?' + new URLSearchParams(params).toString();
    const responseData = await apiFetch(`/api/property-enumeration/customers${queryString}`);
    return responseData.data.customers || responseData.customers;
  },

  list: async (params?: ListCustomersParams): Promise<{ customers: Customer[]; total: number; page: number; limit: number }> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const responseData = await apiFetch(`/api/property-enumeration/customers${queryString}`);
    return responseData.data;
  },

  getById: async (customerId: string): Promise<Customer> => {
    const responseData = await apiFetch(`/api/property-enumeration/customers/${customerId}`);
    return responseData.data.customer;
  },

  link: async (customerId: string, data: LinkCustomerRequest): Promise<{ customer: Customer; building: Building }> => {
    const responseData = await apiFetch(`/api/property-enumeration/customers/${customerId}/link`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return responseData.data;
  },

  unlink: async (customerId: string): Promise<Customer> => {
    const responseData = await apiFetch(`/api/property-enumeration/customers/${customerId}/unlink`, {
      method: 'DELETE',
    });
    return responseData.data.customer;
  },
};

// Photo Upload API
export const photoApi = {
  uploadAdditional: async (buildingId: string, photos: File[]): Promise<Building> => {
    const formData = new FormData();
    photos.forEach((photo) => {
      formData.append('photos', photo);
    });

    const responseData = await apiFetch(`/api/property-enumeration/buildings/${buildingId}/photos`, {
      method: 'POST',
      body: formData,
    });
    return responseData.data.building;
  },
};

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const responseData = await apiFetch('/api/mobile/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return responseData;
  },
};

// Session API Types (v1.3.0)
export interface Session {
  _id: string;
  sessionId: string;
  userId: string;
  companyId: string;
  lotCode: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
  };
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'cancelled';
  buildingsEnumerated: number;
  notes?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StartSessionRequest {
  lotCode: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

export interface EndSessionRequest {
  endLocation: {
    latitude: number;
    longitude: number;
  };
}

export interface ListSessionsParams {
  page?: number;
  limit?: number;
  lotCode?: string;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  totalBuildingsEnumerated: number;
  averageBuildingsPerSession: number;
  averageSessionDuration: number;
  totalDuration: number;
  byLotCode: {
    [lotCode: string]: {
      sessions: number;
      buildings: number;
    };
  };
  recentSessions: Array<{
    sessionId: string;
    lotCode: string;
    buildingsEnumerated: number;
    duration: number;
    startTime: string;
  }>;
}

export interface SessionStatisticsParams {
  lotCode?: string;
  startDate?: string;
  endDate?: string;
}

// Session API Functions (v1.3.0)
export const sessionApi = {
  start: async (data: StartSessionRequest): Promise<Session> => {
    const responseData = await apiFetch('/api/property-enumeration/sessions/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return responseData.data.session;
  },

  end: async (data: EndSessionRequest): Promise<Session> => {
    const responseData = await apiFetch('/api/property-enumeration/sessions/end', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return responseData.data.session;
  },

  list: async (params?: ListSessionsParams): Promise<{ sessions: Session[]; pagination: { total: number; page: number; limit: number; pages: number } }> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const responseData = await apiFetch(`/api/property-enumeration/sessions${queryString}`);
    return responseData.data;
  },

  getById: async (sessionId: string): Promise<Session> => {
    const responseData = await apiFetch(`/api/property-enumeration/sessions/${sessionId}`);
    return responseData.data.session;
  },

  getStatistics: async (params?: SessionStatisticsParams): Promise<SessionStatistics> => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const responseData = await apiFetch(`/api/property-enumeration/sessions/statistics${queryString}`);
    return responseData.data.statistics;
  },
};
