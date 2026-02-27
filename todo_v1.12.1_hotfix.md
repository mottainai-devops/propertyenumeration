# v1.12.1 Hotfix TODO

## Critical Bugs from v1.12.0

### Issue 1: Polygons Not Loading
- [x] Investigate why polygons don't load on initial map render
- [x] Fix: Ensure loadPolygons() is called on mount with delay
- [x] Fix: Add auto-fit to zoom map to show all loaded polygons
- [x] Fix: Add comprehensive debug logging
- [ ] Test: Verify polygons appear when map loads

### Issue 2: Labels Not Showing
- [x] Investigate why building ID labels don't appear at zoom 17+
- [x] Fix: ZoomDependentLabel component is correct, should work after polygon fix
- [ ] Test: Verify labels appear when zoomed to level 17+

### Issue 3: Building Data Not Auto-Filling Form
- [x] Investigate data flow from LocationPickerWithMap to BuildingForm
- [x] Fix: Data flow is correct, issue was polygons not showing so user couldn't tap
- [x] Fix: Added debug logging to track building selection
- [ ] Test: Verify form fields populate when polygon is tapped

## Build and Deploy
- [ ] Build web assets
- [ ] Update version to 1.12.1
- [ ] Sync to Android
- [ ] Push to GitHub for Build #71
