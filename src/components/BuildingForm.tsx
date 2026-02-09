import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import CustomerSearch from './CustomerSearch';
import type { Customer } from '../api/client';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface BuildingFormProps {
  onSubmit: (buildingData: any) => Promise<void>;
  location: LocationData;
  onBack: () => void;
}

type FormStep = 'building-details' | 'customer-linking';

export default function BuildingForm({ onSubmit, location, onBack }: BuildingFormProps) {
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

        setPhotos(prev => [...prev, file]);
        setPhotoPreviewUrls(prev => [...prev, image.webPath!]);
      }
    } catch (err) {
      setError('Failed to capture photo');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
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
      <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
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
          <form onSubmit={handleNextStep} className="p-6 space-y-6">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lot Code *
              </label>
              <input
                type="text"
                name="lotCode"
                value={formData.lotCode}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder="e.g., SW02"
              />
            </div>

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
                Photos (Max 4)
              </label>
              
              <div className="grid grid-cols-4 gap-3 mb-3">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center justify-center hover:border-green-500 transition"
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">Take Photo</span>
                </button>
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

            {/* Action Buttons */}
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
          </form>
        )}

        {/* Step 2: Customer Linking */}
        {currentStep === 'customer-linking' && (
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-1">Link Customer (Optional)</p>
              <p className="text-xs text-blue-700">
                Search for an existing customer to link to this building, or skip to continue without linking.
              </p>
            </div>

            {/* Linked Customer Display */}
            {linkedCustomer ? (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-green-900">Customer Linked</p>
                  </div>
                  <button
                    onClick={handleRemoveCustomer}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
                <div className="ml-7 space-y-1">
                  <p className="text-sm font-medium text-gray-900">{linkedCustomer.customerName}</p>
                  {linkedCustomer.phoneNumber && (
                    <p className="text-xs text-gray-600">📞 {linkedCustomer.phoneNumber}</p>
                  )}
                  {linkedCustomer.address && (
                    <p className="text-xs text-gray-600">📍 {linkedCustomer.address}</p>
                  )}
                  {linkedCustomer.propertyType && (
                    <p className="text-xs text-gray-600">🏢 {linkedCustomer.propertyType}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Customer Search */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Customer
                </label>
                <CustomerSearch
                  onSelect={handleCustomerSelect}
                  placeholder="Search by name, phone, or address..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Type at least 2 characters to search
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              {linkedCustomer ? (
                <button
                  onClick={handleSubmitWithCustomer}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit with Customer'}
                </button>
              ) : (
                <button
                  onClick={handleSkipCustomerLinking}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Skip & Submit Building'}
                </button>
              )}
              
              <button
                onClick={handleBackToDetails}
                disabled={loading}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back to Building Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
