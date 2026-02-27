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
- [x] Push to GitHub for automated build (Build #68 triggered)

### Phase 5: User Testing
- [ ] User tests Build #68 APK
- [ ] Verify map loads correctly
- [ ] Verify fallback works if map fails
- [ ] Confirm no crashes

---

## 🔧 v1.14.0 - Polygon Interaction Fixes (IN PROGRESS)

- [x] Fix polygon click handlers - polygons not showing building selection card when tapped
- [x] Auto-load polygons on map open (no manual refresh needed)
- [x] Set initial zoom to level 18 so buildings are large enough to tap
- [x] Make refresh and location buttons larger (52px touch targets)
- [x] Auto-fit map to polygons after loading (removed - was causing zoom-out to show all 2000 buildings)
- [x] Ensure building selection card appears when polygon is tapped

---

## 🔧 v1.15.0 - Auto-Fill Fix (IN PROGRESS)

- [x] Fix: polygon click goes directly to form without building data - need to show confirmation card first
- [x] Fix: onLocationChange must NOT navigate to form when a building is selected
- [x] Fix: "Proceed with this Building" button must pass building data (address, businessName) to form
- [x] Verify address and building name auto-fill in BuildingForm when selectedBuilding prop is set

---

## 🔧 v1.16.0 - Map UI Polish (IN PROGRESS)

- [x] Hide "None" string for Business field in building selection card
- [x] Reduce map label font size and only show labels at zoom >= 20 (labels hidden at zoom 18-19)
- [x] Remove excess whitespace below building selection card
- [x] Tighten location screen layout: smaller header, removed info box, compact padding

---

## 🔧 v1.17.0 - Polygon Labels (IN PROGRESS)

- [x] Show polygon labels at zoom >= 18 (was 20)
- [x] Label shows business name if available (not 'None'), otherwise building ID
- [x] Label text truncated at 18 chars with ellipsis
- [x] Labels remain non-interactive (pointer-events: none) so tapping the label still selects the polygon
