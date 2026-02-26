# Property Enumeration Mobile App - TODO

## ✅ v1.9.9 - Working Base App (COMPLETED)
- [x] Fixed AndroidManifest usesCleartextTraffic conflict
- [x] App launches successfully
- [x] User authentication works
- [x] SimpleLocationPicker functional

---

## 🗺️ v1.10.0 - Add Map Visualization with Error Handling

### Phase 1: Add Leaflet Dependencies
- [x] Install leaflet, react-leaflet, @types/leaflet
- [x] Create ErrorBoundary component for map
- [x] Create EnhancedLocationMap component with error handling

### Phase 2: Bundle Leaflet Icons Locally
- [x] Download Leaflet marker icons to public/leaflet-icons/
- [x] Configure Leaflet to use local icon paths
- [ ] Verify icons are bundled in build output

### Phase 3: Integrate Map with Fallback
- [x] Update App.tsx to use EnhancedLocationMap
- [x] Wrap map in ErrorBoundary with SimpleLocationPicker fallback
- [ ] Test error handling locally

### Phase 4: Build and Deploy
- [x] Build web assets (753KB bundle, 206KB gzip)
- [x] Sync to Android
- [x] Update version to 1.10.0 (versionCode 1100)
- [ ] Push to GitHub for automated build

### Phase 5: User Testing
- [ ] User tests Build #68 APK
- [ ] Verify map loads correctly
- [ ] Verify fallback works if map fails
- [ ] Confirm no crashes
