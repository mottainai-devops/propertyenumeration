# GitHub Actions APK Build Guide

## Overview

This repository is configured with **GitHub Actions** to automatically build Android APKs in the cloud. No local Android SDK or build tools required!

---

## How It Works

Every time you push code to the `main` or `master` branch, GitHub Actions will:

1. ✅ Set up Node.js 18 environment
2. ✅ Set up Java 17 (JDK)
3. ✅ Install Android SDK automatically
4. ✅ Install npm dependencies
5. ✅ Build web assets (`npm run build`)
6. ✅ Sync to Android (`npx cap sync android`)
7. ✅ Build APK (`./gradlew assembleDebug`)
8. ✅ Upload APK as downloadable artifact

**Build time**: ~5-8 minutes per run

---

## Setup Instructions

### Step 1: Push Code to GitHub

```bash
# If repository doesn't exist yet
gh repo create mottainai-apk-distribution --private --source=. --remote=origin --push

# If repository already exists
git add .
git commit -m "Add GitHub Actions workflow for APK build"
git push origin main
```

### Step 2: Enable GitHub Actions

1. Go to your repository on GitHub
2. Click **Actions** tab
3. If prompted, click **"I understand my workflows, go ahead and enable them"**

### Step 3: Trigger a Build

**Option A: Automatic (on push)**
```bash
git add .
git commit -m "Trigger APK build"
git push origin main
```

**Option B: Manual trigger**
1. Go to **Actions** tab on GitHub
2. Click **"Build Android APK"** workflow
3. Click **"Run workflow"** button
4. Select branch (main)
5. Click **"Run workflow"**

---

## Downloading the APK

### Method 1: From Workflow Run

1. Go to **Actions** tab on GitHub
2. Click on the latest workflow run (green checkmark = success)
3. Scroll down to **Artifacts** section
4. Click **"app-debug-v1.9.0"** to download ZIP file
5. Extract ZIP to get `app-debug.apk`

### Method 2: Using GitHub CLI

```bash
# List recent workflow runs
gh run list --workflow=build-apk.yml

# Download artifacts from latest run
gh run download --name app-debug-v1.9.0

# This creates a folder with app-debug.apk inside
```

### Method 3: Direct URL (with GitHub token)

```bash
# Get download URL
gh api repos/:owner/:repo/actions/artifacts --jq '.artifacts[0].archive_download_url'

# Download with curl
curl -L -H "Authorization: token YOUR_GITHUB_TOKEN" \
  "ARTIFACT_URL" -o app-debug.zip
```

---

## Creating Releases with APK

To create a GitHub Release with the APK attached:

### Step 1: Create and Push a Tag

```bash
# Create a version tag
git tag v1.9.0

# Push the tag to GitHub
git push origin v1.9.0
```

### Step 2: Automatic Release

The workflow will automatically:
- Build the APK
- Create a GitHub Release named "Release v1.9.0"
- Attach `app-debug.apk` to the release
- Make it publicly downloadable

### Step 3: Download from Release

1. Go to **Releases** section on GitHub
2. Find "Release v1.9.0"
3. Download `app-debug.apk` from **Assets**

---

## Workflow Status

### Check Build Status

**On GitHub**:
- Green checkmark ✅ = Build succeeded
- Red X ❌ = Build failed
- Yellow circle 🟡 = Build in progress

**Via GitHub CLI**:
```bash
# Check latest run status
gh run list --workflow=build-apk.yml --limit 1

# View logs for latest run
gh run view --log

# Watch a running build
gh run watch
```

### Build Badges

Add a build status badge to your README:

```markdown
![Build Status](https://github.com/YOUR_USERNAME/mottainai-apk-distribution/actions/workflows/build-apk.yml/badge.svg)
```

---

## Troubleshooting

### Build Failed: "npm ci" error

**Cause**: `package-lock.json` is out of sync

**Solution**:
```bash
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

### Build Failed: "Gradle build failed"

**Cause**: Android build configuration error

**Solution**: Check the workflow logs:
```bash
gh run view --log
```

Look for errors in the "Build Debug APK" step.

### Build Failed: "capacitor.config.ts" error

**Cause**: Capacitor configuration issue

**Solution**: Verify `capacitor.config.ts` has correct `webDir`:
```typescript
webDir: 'public'  // Should match build output directory
```

### Artifact Not Found

**Cause**: Build failed before APK was created

**Solution**:
1. Check workflow logs for errors
2. Fix the error
3. Push again to trigger new build

---

## Customizing the Workflow

### Build on Different Branches

Edit `.github/workflows/build-apk.yml`:

```yaml
on:
  push:
    branches: [ main, develop, staging ]  # Add more branches
```

### Build Release APK Instead of Debug

Change the Gradle command:

```yaml
- name: Build Release APK
  run: cd android && ./gradlew assembleRelease --no-daemon
```

**Note**: Requires signing configuration in `android/app/build.gradle`

### Add APK Signing

Add repository secrets:
1. Go to **Settings > Secrets and variables > Actions**
2. Click **"New repository secret"**
3. Add these secrets:
   - `KEYSTORE_FILE` (base64 encoded .jks file)
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

Update workflow:

```yaml
- name: Decode keystore
  run: |
    echo "${{ secrets.KEYSTORE_FILE }}" | base64 -d > android/app/keystore.jks
    
- name: Build signed APK
  env:
    KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
    KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
    KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
  run: cd android && ./gradlew assembleRelease --no-daemon
```

### Change Artifact Retention

Default is 30 days. To change:

```yaml
- name: Upload APK artifact
  uses: actions/upload-artifact@v4
  with:
    name: app-debug-v${{ steps.version.outputs.version }}
    path: android/app/build/outputs/apk/debug/app-debug.apk
    retention-days: 90  # Keep for 90 days
```

---

## Cost and Limits

### GitHub Actions Free Tier

- ✅ **Unlimited** for public repositories
- ✅ **2,000 minutes/month** for private repositories (free tier)
- ✅ **500 MB** artifact storage

### Build Time

- Average: **5-8 minutes** per build
- Uses: **5-8 minutes** of your quota per build

### Storage

- Each APK: **~15-20 MB**
- Artifacts deleted after 30 days (configurable)

---

## Best Practices

### 1. Use Semantic Versioning

Update version before each release:

```json
// package.json
{
  "version": "1.9.0"  // Major.Minor.Patch
}
```

```gradle
// android/app/build.gradle
versionCode 190      // Increment by 1
versionName "1.9.0"  // Match package.json
```

### 2. Tag Releases

```bash
git tag v1.9.0
git push origin v1.9.0
```

This creates a permanent release with downloadable APK.

### 3. Use Draft Releases for Testing

Edit workflow to create draft releases:

```yaml
- name: Upload APK to release
  with:
    draft: true  # Create as draft
```

Review and publish manually on GitHub.

### 4. Add Changelog to Releases

Create `CHANGELOG.md`:

```markdown
## v1.9.0 (2026-02-26)

### Added
- Interactive map with building polygons
- Duplicate detection with warning dialog
- Building labels on polygons

### Fixed
- GPS accuracy warnings
- Offline caching improvements
```

Update workflow:

```yaml
- name: Upload APK to release
  with:
    body_path: CHANGELOG.md
```

### 5. Notify on Build Failure

Add Slack/Email notifications:

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Quick Reference

```bash
# Push code and trigger build
git add .
git commit -m "Update app"
git push origin main

# Create release
git tag v1.9.0
git push origin v1.9.0

# Download latest APK
gh run download --name app-debug-v1.9.0

# Check build status
gh run list --workflow=build-apk.yml

# View build logs
gh run view --log

# Cancel running build
gh run cancel
```

---

## Comparison: Local vs GitHub Actions

| Feature | Local Build | GitHub Actions |
|---------|-------------|----------------|
| **Setup time** | 30-60 min (first time) | 0 min (automatic) |
| **Build time** | 2-5 min | 5-8 min |
| **Requirements** | Android SDK, Java 17, Node.js | None (just Git) |
| **Disk space** | ~5 GB (Android SDK) | 0 GB (cloud) |
| **Cost** | Free | Free (2000 min/month) |
| **Automation** | Manual | Automatic on push |
| **Artifacts** | Local file | Cloud storage (30 days) |
| **Releases** | Manual upload | Automatic attachment |

**Recommendation**: Use **GitHub Actions** for team collaboration and automatic builds. Use **local build** for quick iteration during development.

---

## Support

For GitHub Actions issues:
- Check workflow logs: `gh run view --log`
- View GitHub Actions documentation: https://docs.github.com/actions
- Check Android build logs in workflow output

For APK build issues:
- See `LOCAL_BUILD_GUIDE.md` for troubleshooting
- See `BACKEND_API_SPEC.md` for backend integration
