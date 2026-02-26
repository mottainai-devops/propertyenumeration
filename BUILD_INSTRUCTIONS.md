# APK Build Instructions - v1.9.0

## Prerequisites
- Node.js 22.x installed
- Android Studio installed (for Gradle)
- Java JDK 17+ installed

## Build Steps

### 1. Build Web Assets
```bash
cd /home/ubuntu/mottainai-apk-distribution
npm run build
```

This compiles the React app into optimized static files in `dist/`.

### 2. Sync to Android
```bash
npx cap sync android
```

This copies web assets to Android project and updates native dependencies.

### 3. Build APK
```bash
cd android
./gradlew assembleDebug
```

For release APK (signed):
```bash
./gradlew assembleRelease
```

### 4. Locate APK
**Debug APK**:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Release APK**:
```
android/app/build/outputs/apk/release/app-release.apk
```

## Version Information
- **Version Name**: 1.9.0
- **Version Code**: 190
- **Package Name**: com.propertyenum.mobile.v2
- **Build Type**: Debug/Release

## Testing Checklist

### Browser Testing (Dev Server)
- [ ] Login works with test credentials
- [ ] Session management screen loads
- [ ] Navigate to location picker
- [ ] Map loads with ArcGIS satellite imagery
- [ ] GPS location marker appears
- [ ] Building polygons render with colors
- [ ] Building labels appear on polygons
- [ ] Tap polygon to select (highlight + label change)
- [ ] Selected building info shows in green banner
- [ ] Confirm Location button enabled
- [ ] BuildingForm opens with auto-filled data

### Android Device Testing
- [ ] Install APK on physical device
- [ ] App icon shows "Property Enumeration" (green building icon)
- [ ] Login screen shows v1.9.0
- [ ] Login works with test credentials
- [ ] GPS permission requested
- [ ] GPS location accurate (< 50m)
- [ ] Map loads in WebView
- [ ] Polygons render correctly
- [ ] Labels visible and readable
- [ ] Tap polygon detection works
- [ ] Polygon selection highlights correctly
- [ ] Building form auto-fill works
- [ ] Photo capture works
- [ ] Building registration submits successfully
- [ ] Offline caching works (airplane mode test)
- [ ] Cache persists after app restart

### Performance Testing
- [ ] Test with 1000+ polygons (zoom out to load more)
- [ ] Smooth panning and zooming
- [ ] No lag when selecting polygons
- [ ] Labels render without flickering
- [ ] Memory usage acceptable (< 200MB)
- [ ] APK size acceptable (< 15MB)

## Known Issues
- TypeScript library errors in dev (does not affect build)
- Login may fail in browser without backend API
- Map requires internet for initial polygon sync
- Offline mode only works after initial sync

## Test Credentials
- **Email**: adeyadewuyi@gmail.com
- **Password**: 123456
- **Assigned Lot**: LOT-6 (G R A Ikeja)

## Troubleshooting

### Build Fails
```bash
# Clean build
cd android
./gradlew clean
./gradlew assembleDebug
```

### Map Not Loading
- Check internet connection
- Verify ArcGIS API key is valid
- Check browser console for errors

### Polygons Not Rendering
- Verify GPS location is accurate
- Check if polygons exist in 5km radius
- Clear IndexedDB cache and retry sync

### Labels Not Visible
- Zoom in closer (labels appear at zoom level 16+)
- Check if polygon has valid center coordinates
- Verify Leaflet CSS is loaded

## Release Notes - v1.9.0

### New Features
✅ Interactive map with ArcGIS satellite imagery
✅ Building polygon rendering with 15-color palette
✅ Building labels showing IDs and customer counts
✅ GPS location tracking with accuracy warnings
✅ Offline polygon caching (7-day expiry)
✅ Auto-fill building data from selected polygons
✅ Point-in-polygon tap detection
✅ Safe-area compliant layout for Android navigation bar

### Technical Details
- **Map Library**: Leaflet 1.9.4 with react-leaflet 4.2.1
- **Caching**: IndexedDB via localforage
- **Geospatial**: @turf/turf for calculations
- **Coordinate System**: Web Mercator (EPSG:3857) → WGS84 (EPSG:4326)
- **ArcGIS Endpoint**: New_Footprints_gdb_b1422/FeatureServer/0

### Files Changed
- Added: `client/src/components/EnhancedLocationMap.tsx`
- Added: `client/src/components/PolygonLabel.tsx`
- Added: `client/src/models/BuildingPolygon.ts`
- Added: `client/src/services/arcgisService.ts`
- Added: `client/src/services/polygonCacheService.ts`
- Added: `client/src/utils/coordinateConversion.ts`
- Added: `client/src/utils/pointInPolygon.ts`
- Modified: `client/src/App.tsx` (integrated map)
- Modified: `client/src/components/BuildingForm.tsx` (auto-fill)
- Modified: `client/index.html` (Leaflet CSS)
- Modified: `package.json` (version 1.9.0)
- Modified: `android/app/build.gradle` (version 190)

### Remaining Work
- Building info popup with duplicate detection
- Customer label fetching from backend
- Backend endpoints for duplicate checking
- Reverse geocoding for address lookup
- Performance optimization for 1000+ polygons
