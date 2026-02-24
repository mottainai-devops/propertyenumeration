# GitHub Actions Workflows

## Build APK Workflow

This workflow automatically builds Android APK files for the Field Enumeration mobile app.

### Triggers

The workflow runs on:
- **Push to branches:** `main`, `v1.5.0-clean-build`, `develop`
- **Tag push:** Any tag starting with `v` (e.g., `v2.0.1`)
- **Pull requests:** To `main` or `v1.5.0-clean-build`
- **Manual trigger:** Via "Actions" tab → "Run workflow" button

### What It Does

1. **Checks out code** from the repository
2. **Sets up environment:**
   - Node.js 22
   - pnpm 9
   - Java JDK 17
3. **Caches dependencies** for faster builds
4. **Installs dependencies** with `pnpm install`
5. **Builds web assets** with `pnpm run build`
6. **Syncs Capacitor** with `pnpm exec cap sync android`
7. **Builds APKs:**
   - Debug APK (always)
   - Release APK (if signing configured)
8. **Uploads artifacts** to GitHub Actions
9. **Creates GitHub Release** (on tag push)

### Downloading APK Files

#### From Workflow Run (Push/PR)
1. Go to **Actions** tab in GitHub
2. Click on the workflow run
3. Scroll to **Artifacts** section
4. Download `field-enumeration-debug-apk`

#### From Release (Tag Push)
1. Go to **Releases** section in GitHub
2. Find the release (e.g., `v2.0.1`)
3. Download APK from **Assets** section

### Manual Trigger

To manually trigger a build:
1. Go to **Actions** tab
2. Select **Build Android APK** workflow
3. Click **Run workflow** button
4. Select branch
5. Click **Run workflow**

### Build Times

- **First build:** ~5-8 minutes (no cache)
- **Subsequent builds:** ~2-4 minutes (with cache)

### Artifacts Retention

- **Debug APK:** 30 days
- **Release APK:** 90 days

### Release Notes

When you push a tag (e.g., `v2.0.1`), the workflow automatically:
- Creates a GitHub Release
- Attaches APK files
- Includes version info and installation instructions
- Marks as stable release (not draft/prerelease)

### Example: Creating a Release

```bash
# Tag the current commit
git tag v2.0.2

# Push the tag to GitHub
git push github v2.0.2

# GitHub Actions will automatically:
# 1. Build the APK
# 2. Create a release
# 3. Upload APK files
```

### Troubleshooting

**Build fails with "Gradle error":**
- Check Java version (should be 17)
- Check Gradle wrapper permissions
- Review build.gradle for syntax errors

**Build fails with "Node error":**
- Check package.json for missing dependencies
- Verify pnpm-lock.yaml is committed

**APK not uploaded:**
- Check workflow logs for errors
- Verify APK was built successfully
- Check artifact upload step

### Configuration

The workflow uses these versions:
- **Node.js:** 22
- **pnpm:** 10.4.1
- **Java JDK:** 21 (Temurin distribution)

To change versions, edit `.github/workflows/build-apk.yml`.

### Caching

The workflow caches:
- **pnpm dependencies:** `~/.pnpm-store`
- **Gradle dependencies:** `~/.gradle/caches` and `~/.gradle/wrapper`

This significantly speeds up subsequent builds.

### Security

- No secrets required for debug builds
- For release builds, add signing keys to GitHub Secrets
- Workflow uses `GITHUB_TOKEN` (automatically provided)

### Next Steps

To enable release APK signing:
1. Generate a keystore file
2. Add keystore to repository (encrypted)
3. Add signing config to `android/app/build.gradle`
4. Add secrets to GitHub repository settings
5. Update workflow to use secrets

See Android documentation for keystore generation.
