# v1.11.0 - Building Polygon Visualization

## Phase 1: Research and Design
- [x] Review v1.9.0 ArcGIS integration code
- [x] Design building polygon data structure
- [x] Plan error handling strategy for ArcGIS API failures
- [x] Design UI for building selection and labels

## Phase 2: ArcGIS Integration
- [x] Create ArcGIS service module with error handling
- [x] Implement building footprint fetching by bounding box
- [x] Add caching strategy for polygon data
- [ ] Test ArcGIS API with real coordinates

## Phase 3: Polygon Rendering
- [ ] Add Leaflet polygon layer to EnhancedLocationMap
- [ ] Implement point-in-polygon detection
- [ ] Add polygon click handlers
- [ ] Style polygons (fill, stroke, hover effects)

## Phase 4: Building Labels and UI
- [ ] Create custom text marker layer for building IDs
- [ ] Implement zoom-dependent label visibility
- [ ] Add building selection modal/popup
- [ ] Show building details when polygon is tapped

## Phase 5: Build and Deploy
- [ ] Update version to 1.11.0 (versionCode 1110)
- [ ] Build web assets
- [ ] Sync to Android
- [ ] Push to GitHub for Build #69
- [ ] Test APK on device

## Design Decisions
- **Label Interaction**: Tapping label = view info (non-confirming), Tapping polygon = confirm selection
- **Label Size**: Custom text markers with 25% size reduction for minimal clutter
- **Zoom Behavior**: Labels only visible at higher zoom levels (almost label-free at default zoom)
- **Error Handling**: Graceful degradation if ArcGIS fails (map still works without polygons)
