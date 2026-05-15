import { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import CustomerSearch from './CustomerSearch';
import LotDropdown from './LotDropdown';
import type { Customer } from '../api/client';
import { validateAndPreparePhoto, formatFileSize } from '../utils/photoUtils';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface BuildingFormProps {
  onSubmit: (buildingData: any) => Promise<void>;
  location: LocationData;
  selectedBuilding?: {
    buildingId: string;
    address?: string;
    businessName?: string;
    zone?: string;
  } | null;
  onBack: () => void;
}

type FormStep = 'building-details' | 'customer-linking';

export default function BuildingForm({ onSubmit, location, selectedBuilding, onBack }: BuildingFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>('building-details');
  const [formData, setFormData] = useState({
    address: '',
    buildingName: '',
    lotCode: '',
    propertyType: 'Residential' as 'Residential' | 'Commercial' | 'Industrial' | 'Mixed-Use',
    numberOfUnits: 1,
    notes: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSizes, setPhotoSizes] = useState<number[]>([]);

  // Auto-fill form when building is selected from map
  useEffect(() => {
    if (selectedBuilding) {
      setFormData(prev => ({
        ...prev,
        address: selectedBuilding.address || '',
        buildingName: selectedBuilding.businessName || '',
        notes: `Building ID: ${selectedBuilding.buildingId}${selectedBuilding.zone ? ` | Zone: ${selectedBuilding.zone}` : ''}`,
      }));
    }
  }, [selectedBuilding]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfUnits' ? parseInt(value) || 1 : value,
    }));
  };

  const handleTakePhoto = async () => {
    if (photos.length >= 4) {
      setError('Maximum 4 photos allowed');
      return;
    }

    setPhotoLoading(true);
    setError('');

    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (image.webPath) {
        // Fetch the image as a blob
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Validate and prepare photo (compress if needed)
        const { file: preparedFile, error: validationError } = await validateAndPreparePhoto(file, {
          maxSizeMB: 5,
          maxWidthOrHeight: 1920,
          quality: 0.8,
        });

        if (validationError) {
          setError(validationError);
          setPhotoLoading(false);
          return;
        }

        setPhotos(prev => [...prev, preparedFile]);
        setPhotoPreviewUrls(prev => [...prev, image.webPath!]);
        setPhotoSizes(prev => [...prev, preparedFile.size]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to capture photo');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setPhotoSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate building details
    if (!formData.address.trim()) {
      setError('Address is required');
      return;
    }
    if (!formData.lotCode.trim()) {
      setError('Lot code is required');
      return;
    }
    
    // Move to customer linking step
    setCurrentStep('customer-linking');
  };

  const handleCustomerSelect = (customer: Customer) => {
    setLinkedCustomer(customer);
  };

  const handleRemoveCustomer = () => {
    setLinkedCustomer(null);
  };

  const handleSkipCustomerLinking = async () => {
    await handleFinalSubmit();
  };

  const handleSubmitWithCustomer = async () => {
    await handleFinalSubmit();
  };

  const handleFinalSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const request = {
        ...formData,
        photos,
        linkedCustomerId: linkedCustomer?._id,
      };

      await onSubmit(request);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create building. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDetails = () => {
    setCurrentStep('building-details');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full h-[90vh] flex flex-col">
        {/* Header - Zone 1: Fixed height */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Back to session"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-bold text-gray-900">
                {currentStep === 'building-details' ? 'Register Building' : 'Link Customer'}
              </h2>
            </div>
            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentStep === 'building-details' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'
              }`}>
                1
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentStep === 'customer-linking' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Building Details */}
        {currentStep === 'building-details' && (
          <form onSubmit={handleNextStep} className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* GPS Coordinates */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">GPS Coordinates</p>
              <p className="text-xs text-blue-700">
                Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
              </p>
            </div>

            {/* Building Selection Indicator */}
            {selectedBuilding && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🏢</span>
                  <p className="text-sm text-green-900 font-bold">Building Auto-Selected from Map</p>
                </div>
                <div className="text-xs text-green-800 space-y-1">
                  <p><strong>Building ID:</strong> {selectedBuilding.buildingId}</p>
                  {selectedBuilding.zone && <p><strong>Zone:</strong> {selectedBuilding.zone}</p>}
                </div>
                <p className="text-xs text-green-700 mt-2 italic">
                  ℹ️ Form fields have been pre-filled. You can edit them if needed.
                </p>
              </div>
            )}

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Building Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Building Name (Optional)
              </label>
              <input
                type="text"
                name="buildingName"
                value={formData.buildingName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder="e.g., Green Tower"
              />
            </div>

            {/* Lot Code */}
            <LotDropdown
              value={formData.lotCode}
              onChange={(lotCode) => setFormData(prev => ({ ...prev, lotCode }))}
              label="Lot Code"
              required={true}
            />

            {/* Property Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Type *
              </label>
              <select
                name="propertyType"
                value={formData.propertyType}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Mixed-Use">Mixed-Use</option>
              </select>
            </div>

            {/* Number of Units */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Units *
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, numberOfUnits: Math.max(1, prev.numberOfUnits - 1) }))}
                  className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg text-xl font-bold text-gray-700 transition"
                >
                  −
                </button>
                <input
                  type="number"
                  name="numberOfUnits"
                  value={formData.numberOfUnits}
                  onChange={handleInputChange}
                  required
                  min="1"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-center text-lg font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, numberOfUnits: prev.numberOfUnits + 1 }))}
                  className="w-12 h-12 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold text-white transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photos (Max 4, up to 5MB each)
              </label>
              
              {/* Photo Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                    />
                    {/* Photo Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-b-lg">
                      Photo {index + 1} • {formatFileSize(photoSizes[index])}
                    </div>
                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transition"
                      aria-label="Remove photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Photo Count Info */}
              {photos.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3">
                  <p className="text-sm text-blue-900">
                    📸 {photos.length} photo{photos.length > 1 ? 's' : ''} added ({formatFileSize(photoSizes.reduce((a, b) => a + b, 0))} total)
                  </p>
                </div>
              )}

              {/* Take Photo Button */}
              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  disabled={photoLoading}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center justify-center hover:border-green-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {photoLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-2"></div>
                      <span className="text-sm text-gray-600">Processing photo...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">Take Photo</span>
                      <span className="text-xs text-gray-500 mt-1">{4 - photos.length} remaining</span>
                    </>
                  )}
                </button>
              )}

              {/* Photo Tips */}
              {photos.length === 0 && (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-600 font-medium mb-1">📷 Photo Tips:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Take photos in good lighting</li>
                    <li>• Capture building front, sides, and entrance</li>
                    <li>• Photos will be automatically compressed if too large</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                placeholder="Additional information..."
              />
            </div>

            </div>

            {/* Action Area - Zone 3: Outside scroll, safe-area aware */}
            <div className="shrink-0 px-6 pt-3 pb-[calc(16px+var(--sab))] bg-white border-t border-gray-200">
              <div className="space-y-3">
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition"
                >
                  Next: Link Customer
                </button>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Step 2: Customer Linking - Complete Redesign */}
        {currentStep === 'customer-linking' && (
          <>
            {/* Scrollable Content - Zone 2 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Info Banner with Icon */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-900 font-medium">Search for an existing customer to link to this building, or skip to continue without linking.</p>
              </div>
            </div>

            {/* Search Input - Only show when no customer linked */}
            {!linkedCustomer && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <CustomerSearch
                  onSelect={handleCustomerSelect}
                  placeholder="Search by name, phone, or address"
                  lotCode={formData.lotCode || undefined}
                />
              </div>
            )}

            {/* Linked Customer Card - Professional Design */}
            {linkedCustomer && (
              <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-green-900">Customer Linked</p>
                  </div>
                  <button
                    onClick={handleRemoveCustomer}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>

                {/* Customer Details with Avatar */}
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-800 font-semibold text-lg">
                      {linkedCustomer.customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2">
                    <p className="text-base font-semibold text-gray-900">{linkedCustomer.customerName}</p>
                    {linkedCustomer.phoneNumber && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{linkedCustomer.phoneNumber}</span>
                      </div>
                    )}
                    {linkedCustomer.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{linkedCustomer.address}</span>
                      </div>
                    )}
                    {linkedCustomer.propertyType && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {linkedCustomer.propertyType}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            </div>

            {/* Action Area - Zone 3: Outside scroll, safe-area aware */}
            <div className="shrink-0 px-6 pt-3 pb-[calc(16px+var(--sab))] bg-white border-t border-gray-200">
              <div className="flex gap-3">
                <button
                  onClick={handleBackToDetails}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Skip for Now
                </button>
                <button
                  onClick={linkedCustomer ? handleSubmitWithCustomer : handleSkipCustomerLinking}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {loading ? 'Submitting...' : 'Submit with Customer'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
