# v1.12.2 TODO - Polygon Rendering and UX Fixes

## Critical Issues from v1.12.1

### Issue 1: Polygons Still Not Rendering
- [x] Add mock polygon data to verify rendering logic works (5 sample buildings)
- [x] Debug ArcGIS API response format
- [x] Check coordinate conversion (GeoJSON → Leaflet)
- [x] Verify polygon geometry structure
- [ ] Test with sample Lagos coordinates

### Issue 2: Refresh Button Covering Zoom Controls
- [x] Reposition refresh button to bottom-left corner (away from zoom)
- [x] Add proper z-index (z-[1000]) and positioning
- [x] Ensure it doesn't overlap with zoom or other controls

### Issue 3: Refresh Button Not Working
- [x] Wire refresh button to loadPolygons() function
- [x] Add loading indicator when refreshing (disabled state)
- [x] Show success/error feedback (via console logs)

### Issue 4: Missing Location Widget
- [x] Add "Locate Me" button with GPS icon
- [x] Position in bottom-right corner
- [x] Center map on current GPS position when clicked
- [x] Show error alert if GPS fails

## Build and Deploy
- [ ] Build web assets
- [ ] Update version to 1.12.2
- [ ] Sync to Android
- [ ] Push to GitHub for Build #72
