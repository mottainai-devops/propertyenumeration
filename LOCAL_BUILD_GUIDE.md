# Local APK Build Guide

## Prerequisites

Before building the APK locally, ensure you have:

- ✅ **Node.js 18+** installed
- ✅ **Android Studio** installed with Android SDK
- ✅ **Java 17** (JDK 17) installed
- ✅ **Git** installed

---

## Step 1: Clone/Pull Latest Code

```bash
# If you haven't cloned yet
git clone <your-repo-url>
cd mottainai-apk-distribution

# If you already have the repo
git pull origin main
```

---

## Step 2: Install Dependencies

```bash
# Install npm dependencies
npm install

# Or if using pnpm
pnpm install
```

---

## Step 3: Build Web Assets

```bash
npm run build
```

**Expected output**:
```
✓ built in 3-5s
dist/public/assets/index-*.js   678.97 kB
dist/public/assets/index-*.css   58.60 kB
```

---

## Step 4: Sync to Android

```bash
npx cap sync android
```

**Expected output**:
```
✔ Copying web assets from public to android/app/src/main/assets/public
✔ Updating Android plugins
[info] Found 5 Capacitor plugins for android
✔ Sync finished in 0.3s
```

---

## Step 5: Build APK

### Option A: Using Gradle CLI (Recommended)

```bash
cd android
./gradlew assembleDebug
```

**Build time**: 2-5 minutes (first build), 30-60 seconds (subsequent builds)

**Output location**:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Option B: Using Android Studio

1. Open `android/` folder in Android Studio
2. Wait for Gradle sync to complete
3. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. Wait for build to complete
5. Click "locate" in the notification to find the APK

---

## Step 6: Install APK on Device

### Via USB (ADB)

```bash
# Connect your Android device via USB
# Enable USB debugging in Developer Options

# Install the APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or if app is already installed (update)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Via File Transfer

1. Copy `app-debug.apk` to your device (email, Google Drive, USB)
2. Open the APK file on your device
3. Allow "Install from Unknown Sources" if prompted
4. Tap "Install"

---

## Troubleshooting

### Error: "SDK location not found"

**Solution**: Set ANDROID_HOME environment variable

**Windows**:
```cmd
setx ANDROID_HOME "C:\Users\YourUsername\AppData\Local\Android\Sdk"
```

**macOS/Linux**:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export ANDROID_HOME=$HOME/Android/Sdk          # Linux

# Add to ~/.bashrc or ~/.zshrc to make permanent
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
```

### Error: "Android Gradle plugin requires Java 17"

**Solution**: Install Java 17 and set JAVA_HOME

**Check current Java version**:
```bash
java -version
```

**Install Java 17**:
- **Windows**: Download from [Adoptium](https://adoptium.net/)
- **macOS**: `brew install openjdk@17`
- **Linux**: `sudo apt install openjdk-17-jdk`

**Set JAVA_HOME**:
```bash
# macOS/Linux
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Windows
setx JAVA_HOME "C:\Program Files\Java\jdk-17"
```

### Error: "Execution failed for task ':app:mergeDebugResources'"

**Solution**: Clean build and rebuild

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Error: "Installed Build Tools revision X is corrupted"

**Solution**: Update Android SDK Build Tools in Android Studio

1. Open Android Studio
2. Go to **Tools > SDK Manager**
3. Click **SDK Tools** tab
4. Check **Android SDK Build-Tools**
5. Click **Apply** to update

---

## Build for Release (Production)

### Step 1: Generate Signing Key (First Time Only)

```bash
keytool -genkey -v -keystore mottainai-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias mottainai-key
```

**Save the passwords securely!**

### Step 2: Configure Signing in `android/app/build.gradle`

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../../mottainai-release-key.jks')
            storePassword 'YOUR_KEYSTORE_PASSWORD'
            keyAlias 'mottainai-key'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 3: Build Release APK

```bash
cd android
./gradlew assembleRelease
```

**Output location**:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Testing Checklist

After installing the APK, test these features:

### Authentication
- [ ] Login with test credentials (adeyadewuyi@gmail.com / 123456)
- [ ] Logout and login again
- [ ] Session persists after app restart

### Location Picker
- [ ] Map loads with satellite imagery
- [ ] GPS location shows with blue marker
- [ ] GPS accuracy warning appears if > 50m
- [ ] Can pan and zoom the map

### Building Polygons
- [ ] Building polygons render with colors
- [ ] Building labels show on polygons (e.g., "B001")
- [ ] Tap polygon to select building
- [ ] Selected polygon highlights in red
- [ ] "Register Building: [ID]" button shows correct ID

### Duplicate Detection
- [ ] Select building ending in "1" or "5" (mock data)
- [ ] Warning dialog appears showing 3 customers
- [ ] Customer labels display (R1, R2, B1)
- [ ] "Cancel" button closes dialog
- [ ] "Continue Anyway" button opens form
- [ ] Select building NOT ending in "1" or "5"
- [ ] Form opens directly without warning

### Building Form
- [ ] Form auto-fills building data from polygon
- [ ] Building ID, address, zone pre-populated
- [ ] Can edit all fields
- [ ] Submit button works
- [ ] Success message appears

### Offline Caching
- [ ] Buildings load from cache on second visit
- [ ] Cache status shows "X buildings cached • Y hours ago"
- [ ] Can use app without internet (after first load)

### Performance
- [ ] Map renders smoothly with 100+ polygons
- [ ] No lag when panning/zooming
- [ ] Labels remain readable at all zoom levels
- [ ] App doesn't crash with large datasets

---

## APK Size Optimization

Current APK size: ~15-20MB (with map libraries)

To reduce size:

1. **Enable ProGuard** (minification):
   ```gradle
   buildTypes {
       release {
           minifyEnabled true
           shrinkResources true
       }
   }
   ```

2. **Use App Bundle** instead of APK:
   ```bash
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

3. **Remove unused resources**:
   - Check for unused images in `client/public/`
   - Remove unused npm packages

---

## Distribution

### Option 1: Direct APK Distribution

1. Upload `app-release.apk` to Google Drive / Dropbox
2. Share link with field supervisors
3. They download and install on their devices

### Option 2: Internal Testing (Google Play)

1. Create Google Play Console account
2. Upload `app-release.aab`
3. Add testers via email
4. They install via Play Store (Internal Testing track)

### Option 3: Firebase App Distribution

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Distribute: `firebase appdistribution:distribute app-release.apk --app YOUR_APP_ID`

---

## Version Management

Update version before each build:

**1. Update `package.json`**:
```json
{
  "version": "1.9.0"
}
```

**2. Update `android/app/build.gradle`**:
```gradle
android {
    defaultConfig {
        versionCode 190  // Increment by 1 for each release
        versionName "1.9.0"
    }
}
```

**Version naming convention**:
- **versionCode**: Integer, increments with each build (190, 191, 192...)
- **versionName**: Semantic version string ("1.9.0", "1.9.1", "1.10.0"...)

---

## Quick Reference

```bash
# Full build process (one command)
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug

# Install on connected device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Check APK size
ls -lh android/app/build/outputs/apk/debug/app-debug.apk

# View build logs
cd android && ./gradlew assembleDebug --info

# Clean build (if errors occur)
cd android && ./gradlew clean && ./gradlew assembleDebug
```

---

## Support

If you encounter issues during local build:

1. Check **Android Studio > SDK Manager** for missing SDK components
2. Verify **Java 17** is installed: `java -version`
3. Verify **ANDROID_HOME** is set: `echo $ANDROID_HOME`
4. Try **clean build**: `./gradlew clean assembleDebug`
5. Check **Gradle logs**: `./gradlew assembleDebug --stacktrace`

For map visualization issues, see `BACKEND_API_SPEC.md` for backend integration requirements.
