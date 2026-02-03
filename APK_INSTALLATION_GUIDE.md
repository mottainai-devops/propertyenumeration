# Mottainai Admin App - APK Installation & Usage Guide

## 📦 APK Information

**File**: `mottainai-admin-app-debug.apk`  
**Size**: 27 MB  
**Type**: Debug Build (for testing)  
**Location**: `/home/ubuntu/mottainai-apk-distribution/mottainai-admin-app-debug.apk`

---

## 📱 Installation Instructions

### Method 1: Direct Installation (Recommended for Testing)

1. **Transfer APK to Android Device**
   - Connect your Android device to your computer via USB
   - Copy `mottainai-admin-app-debug.apk` to your device's Downloads folder
   - Or use cloud storage (Google Drive, Dropbox) to transfer the file

2. **Enable Unknown Sources**
   - Go to **Settings** → **Security** (or **Privacy**)
   - Enable **Install from Unknown Sources** (or **Install Unknown Apps**)
   - For Android 8.0+: Enable for your file manager or browser specifically

3. **Install the APK**
   - Open your device's **File Manager** or **Downloads** app
   - Locate `mottainai-admin-app-debug.apk`
   - Tap the file and follow the installation prompts
   - Grant any requested permissions

4. **Launch the App**
   - Find "Mottainai Survey App Distribution" in your app drawer
   - Tap to launch

### Method 2: ADB Installation (For Developers)

```bash
# Connect device via USB with USB debugging enabled
adb devices

# Install APK
adb install /home/ubuntu/mottainai-apk-distribution/mottainai-admin-app-debug.apk

# Launch app
adb shell am start -n com.mottainai.apkdistribution/.MainActivity
```

---

## 🔐 Login & Authentication

The app uses **Manus OAuth** for authentication:

1. Launch the app
2. You'll see a login prompt
3. Tap "Sign in" to open the Manus login page
4. Enter your Manus credentials
5. After successful login, you'll be redirected to the dashboard

**Note**: Internet connection is required for initial login. After authentication, the app works offline with cached data.

---

## 📊 App Features

### Dashboard (Home)
- View total buildings count
- View total pickups (customer registrations)
- View unsynced pickups count
- Quick access to all management pages

### Customers Page
- List all pickup records (customer survey data)
- Filter by company, customer type, and operational lot
- Search by form ID, building ID, or supervisor
- View detailed customer information with photos
- Delete pickup records

### Properties Page
- List all buildings with polygon data
- Search by building ID, name, address, or zone
- View building occupancy statistics
- See customer labels for each building
- Open building location in Google Maps

### Validation Queue
- Review pending pickup records
- View customer photos for validation
- Approve or reject records with comments
- Track validation history and status

### Customer Import
- Bulk import customers via CSV file
- Download CSV template
- Preview and validate data before import
- View import results with success/failure counts

---

## 🗄️ Database Connection

The app connects to your shared MySQL database at `upwork.kowope.xyz`:

- **Buildings**: Synced from Android field app
- **Pickups**: Customer survey records from field workers
- **Companies**: Company information
- **Operational Lots**: Lot assignments

All data is shared between:
- Android field worker app (Mottainai Survey App)
- This web-based admin app (now available as APK)

---

## 🌐 Network Requirements

**Online Features** (require internet):
- Initial login/authentication
- Data synchronization with server
- Google Maps integration
- Photo uploads

**Offline Features** (work without internet):
- View cached data
- Navigate between pages
- Basic UI interactions

---

## 🔧 Troubleshooting

### App Won't Install
- **Solution**: Enable "Install from Unknown Sources" in Settings → Security
- **Android 8.0+**: Enable for your specific file manager or browser

### Login Fails
- **Solution**: Check internet connection
- Ensure you have valid Manus OAuth credentials
- Clear app data: Settings → Apps → Mottainai → Storage → Clear Data

### Data Not Loading
- **Solution**: Check internet connection
- Verify database server is accessible at `upwork.kowope.xyz`
- Check database credentials in environment configuration

### App Crashes
- **Solution**: Clear app cache: Settings → Apps → Mottainai → Storage → Clear Cache
- Reinstall the APK
- Check logcat for error details: `adb logcat | grep Mottainai`

### Photos Not Displaying
- **Solution**: Check internet connection (photos load from S3 storage)
- Verify photo URLs are accessible
- Grant storage permissions to the app

---

## 🚀 Next Steps

### For Production Release

1. **Generate Signed Release APK**
   ```bash
   cd /home/ubuntu/mottainai-apk-distribution/android
   ./gradlew assembleRelease
   ```

2. **Create Keystore** (if not exists)
   ```bash
   keytool -genkey -v -keystore mottainai-release-key.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias mottainai-key
   ```

3. **Configure Signing** in `android/app/build.gradle`:
   ```gradle
   android {
     signingConfigs {
       release {
         storeFile file("../../mottainai-release-key.jks")
         storePassword "your-store-password"
         keyAlias "mottainai-key"
         keyPassword "your-key-password"
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
       }
     }
   }
   ```

4. **Submit to Google Play Store**
   - Create Google Play Developer account ($25 one-time fee)
   - Prepare store listing (app description, screenshots, icon)
   - Upload signed APK
   - Complete content rating questionnaire
   - Publish app

---

## 📝 Technical Details

**Built With**:
- **Capacitor 8**: Web-to-native wrapper
- **React 19**: Frontend framework
- **tRPC 11**: Type-safe API
- **Tailwind CSS 4**: Styling
- **Vite 7**: Build tool

**Android Configuration**:
- **Min SDK**: Android 6.0 (API 23)
- **Target SDK**: Android 14 (API 34)
- **Permissions**: Internet, Network State, Camera, Location, Storage

**App Package**:
- **Package Name**: `com.mottainai.apkdistribution`
- **Version**: 1.0.0
- **Build Type**: Debug

---

## 📞 Support

For issues or questions:
- Check the troubleshooting section above
- Review app logs: `adb logcat`
- Contact your system administrator
- Submit feedback at https://help.manus.im

---

## 🔄 Updates

To update the app:
1. Build new APK with updated code
2. Uninstall old version from device
3. Install new APK following installation instructions above

**Note**: For production apps on Google Play Store, updates are automatic.

---

**Generated**: February 3, 2026  
**App Version**: 1.0.0 (Debug Build 1)
