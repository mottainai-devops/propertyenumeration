import axios, { type AxiosInstance } from 'axios';

// Backend API base URL
const API_BASE_URL = 'http://172.232.24.180:3003';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

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

    const response = await apiClient.post('/property-enumeration/buildings', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  list: async (params?: ListBuildingsParams): Promise<{ buildings: Building[]; total: number; page: number; limit: number }> => {
    const response = await apiClient.get('/property-enumeration/buildings', { params });
    return response.data.data;
  },

  getById: async (buildingId: string): Promise<Building> => {
    const response = await apiClient.get(`/property-enumeration/buildings/${buildingId}`);
    return response.data.data.building;
  },
};

// Auth API
export interface LoginRequest {
  email: string;
  password: string;
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
  search: async (params: SearchCustomersParams): Promise<Customer[]> => {
    const response = await apiClient.get('/property-enumeration/customers/search', { params });
    return response.data.data.customers;
  },

  list: async (params?: ListCustomersParams): Promise<{ customers: Customer[]; total: number; page: number; limit: number }> => {
    const response = await apiClient.get('/property-enumeration/customers', { params });
    return response.data.data;
  },

  getById: async (customerId: string): Promise<Customer> => {
    const response = await apiClient.get(`/property-enumeration/customers/${customerId}`);
    return response.data.data.customer;
  },

  link: async (customerId: string, data: LinkCustomerRequest): Promise<{ customer: Customer; building: Building }> => {
    const response = await apiClient.post(`/property-enumeration/customers/${customerId}/link`, data);
    return response.data.data;
  },

  unlink: async (customerId: string): Promise<Customer> => {
    const response = await apiClient.delete(`/property-enumeration/customers/${customerId}/unlink`);
    return response.data.data.customer;
  },
};

// Photo Upload API
export const photoApi = {
  uploadAdditional: async (buildingId: string, photos: File[]): Promise<Building> => {
    const formData = new FormData();
    photos.forEach((photo) => {
      formData.append('photos', photo);
    });

    const response = await apiClient.post(`/property-enumeration/buildings/${buildingId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data.building;
  },
};

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/users/login', credentials);
    return response.data;
  },
};
