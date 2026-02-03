# Mottainai Admin App - Distribution Guide for Field Supervisors

## 📦 Package Contents

This distribution package contains:

1. **mottainai-admin-app-v1.0-release.apk** (25 MB) - Production-ready signed APK
2. **mottainai-admin-app-debug.apk** (27 MB) - Debug version for testing
3. **DISTRIBUTION_GUIDE.md** - This document
4. **APK_INSTALLATION_GUIDE.md** - Detailed installation instructions
5. **mottainai-release-key.jks** - Keystore for future app updates (KEEP SECURE!)

---

## 🎯 Quick Start for Field Supervisors

### Step 1: Download the APK

Transfer **mottainai-admin-app-v1.0-release.apk** to your Android device:
- Via USB cable (copy to Downloads folder)
- Via email attachment
- Via cloud storage (Google Drive, Dropbox)
- Via direct download link

### Step 2: Enable Installation from Unknown Sources

1. Go to **Settings** → **Security** (or **Privacy**)
2. Enable **Install from Unknown Sources**
3. For Android 8.0+: Enable for your file manager or browser

### Step 3: Install the App

1. Open your **File Manager** or **Downloads** app
2. Tap on **mottainai-admin-app-v1.0-release.apk**
3. Tap **Install**
4. Wait for installation to complete
5. Tap **Open** to launch

### Step 4: Login

1. The app will prompt for Manus OAuth login
2. Enter your Manus credentials
3. After successful login, you'll see the dashboard

---

## 📱 App Features Overview

### Dashboard
- **Total Buildings**: See count of all mapped properties
- **Total Pickups**: View all customer registrations
- **Unsynced Pickups**: Monitor pending synchronizations from field workers

### Customers Management
- View all customer pickup records
- Filter by company, customer type, operational lot
- Search by form ID, building ID, or supervisor
- View detailed information with photos
- Delete records when needed

### Properties Management
- Browse all buildings with polygon data
- Search by ID, name, address, or zone
- View occupancy statistics
- See customer labels for each building
- Open locations in Google Maps

### Validation Queue
- Review pending customer registrations
- View photos for validation
- Approve or reject with comments
- Track validation history

### Customer Import
- Bulk import via CSV file
- Download CSV template
- Preview and validate data
- View import results

---

## 🔐 Security & Access

### Login Credentials
- Uses **Manus OAuth** authentication
- Each supervisor needs their own Manus account
- Contact your administrator for account setup

### Data Access
- All supervisors access the same shared database
- Located at: `upwork.kowope.xyz`
- Data is synced with field worker Android app

### Permissions Required
- Internet access (for login and data sync)
- Storage access (for photo viewing)
- Location access (optional, for Maps features)

---

## 🌐 Network Requirements

### Internet Connection
**Required for**:
- Initial login
- Data synchronization
- Viewing customer photos
- Google Maps integration

**Works offline**:
- Viewing cached data
- Basic navigation
- UI interactions

### Firewall/VPN
If your organization uses a firewall or VPN:
- Ensure access to `upwork.kowope.xyz` (MySQL server)
- Ensure access to `manus.im` (OAuth server)
- Ensure access to S3 storage for photos

---

## 🔧 Troubleshooting

### "App not installed" Error
**Solution**: Enable "Install from Unknown Sources" in Settings → Security

### Login Fails
**Solution**:
- Check internet connection
- Verify Manus credentials
- Contact administrator for account access

### Data Not Loading
**Solution**:
- Check internet connection
- Verify database server is accessible
- Try logging out and back in

### Photos Not Displaying
**Solution**:
- Check internet connection
- Ensure storage permission is granted
- Photos load from S3 storage - verify access

### App Crashes
**Solution**:
- Clear app cache: Settings → Apps → Mottainai → Storage → Clear Cache
- Reinstall the APK
- Contact technical support

---

## 📊 Comparison: Debug vs Release APK

| Feature | Debug APK | Release APK (Recommended) |
|---------|-----------|---------------------------|
| File Size | 27 MB | 25 MB (optimized) |
| Performance | Slower | Faster (optimized code) |
| Security | Lower | Higher (signed & verified) |
| Use Case | Testing only | Production use |
| Logging | Verbose | Minimal |

**Recommendation**: Always use the **Release APK** for production deployment to field supervisors.

---

## 🔄 App Updates

### How to Update

When a new version is released:

1. **Uninstall old version**:
   - Settings → Apps → Mottainai → Uninstall

2. **Install new version**:
   - Follow installation steps above with new APK

3. **Login again**:
   - Use your existing Manus credentials

**Note**: Your data is stored on the server, so uninstalling won't delete any records.

### Version Information

- **Current Version**: 1.0.0
- **Build Date**: February 3, 2026
- **Package Name**: com.mottainai.survey.admin
- **Minimum Android**: 6.0 (API 23)
- **Target Android**: 14 (API 34)

---

## 📋 Distribution Checklist

Before distributing to field supervisors:

- [ ] Verify all supervisors have Manus OAuth accounts
- [ ] Test APK installation on at least 2 different Android devices
- [ ] Confirm database connectivity from supervisor devices
- [ ] Verify photo loading from S3 storage
- [ ] Test login flow with real credentials
- [ ] Ensure Google Maps integration works
- [ ] Provide training on app features
- [ ] Share this distribution guide
- [ ] Set up support channel for questions

---

## 🔒 Keystore Security (IMPORTANT!)

The file **mottainai-release-key.jks** is used to sign the APK and verify authenticity.

**Critical Security Rules**:
- ⚠️ **NEVER share this file publicly**
- ⚠️ **NEVER commit to Git repository**
- ⚠️ **Store in secure location** (encrypted drive, password manager)
- ⚠️ **Backup in multiple secure locations**
- ⚠️ **Only share with authorized developers**

**Keystore Details**:
- **File**: mottainai-release-key.jks
- **Alias**: mottainai-key
- **Password**: mottainai2026
- **Validity**: 10,000 days (~27 years)
- **Organization**: Mottainai, Lagos, Nigeria

**If lost**: You cannot update the app on devices that have the current version installed. Users will need to uninstall and reinstall.

---

## 📞 Support & Contact

### For Field Supervisors

**Technical Issues**:
- Contact your IT administrator
- Email: [your-support-email]
- Phone: [your-support-phone]

**Account Access**:
- Contact Manus support: https://help.manus.im
- Request Manus OAuth account setup

### For Developers

**Build Issues**:
- Check `APK_INSTALLATION_GUIDE.md`
- Review build logs in `/tmp/release-build.log`
- Verify keystore configuration

**Database Issues**:
- Verify connection to `upwork.kowope.xyz`
- Check environment variables
- Review tRPC API endpoints

---

## 📈 Deployment Strategy

### Pilot Deployment (Recommended)

**Phase 1: Testing** (1-2 supervisors, 1 week)
- Install on 1-2 supervisor devices
- Test all features thoroughly
- Collect feedback
- Fix any critical bugs

**Phase 2: Limited Rollout** (5-10 supervisors, 2 weeks)
- Expand to small group
- Monitor performance
- Provide training
- Address issues

**Phase 3: Full Deployment** (All supervisors)
- Roll out to all field supervisors
- Provide ongoing support
- Monitor usage and feedback
- Plan future updates

### Mass Distribution Methods

1. **Direct Download**:
   - Host APK on internal server
   - Share download link
   - Provide installation guide

2. **USB Distribution**:
   - Copy APK to USB drives
   - Distribute to supervisors
   - Assist with installation

3. **Email Distribution**:
   - Send APK as email attachment (if size allows)
   - Include installation instructions
   - Provide support contact

4. **Mobile Device Management (MDM)**:
   - Use enterprise MDM solution
   - Push APK to managed devices
   - Centralized installation

---

## 🎓 Training Resources

### For Field Supervisors

**Video Tutorials** (Recommended to create):
- App installation walkthrough
- Login and navigation
- Customer management features
- Validation queue workflow
- Bulk customer import

**Quick Reference Cards**:
- Common tasks cheat sheet
- Troubleshooting guide
- Support contact information

### Training Session Agenda (Suggested)

1. **Introduction** (10 min)
   - App purpose and benefits
   - Integration with field worker app

2. **Installation** (15 min)
   - Live installation demo
   - Troubleshooting common issues

3. **Features Overview** (30 min)
   - Dashboard navigation
   - Customer management
   - Properties management
   - Validation queue
   - Bulk import

4. **Hands-on Practice** (30 min)
   - Supervisors try features
   - Q&A session

5. **Support & Next Steps** (5 min)
   - Support channels
   - Feedback process

---

## 📝 Feedback & Improvement

### Collecting Feedback

Encourage supervisors to report:
- Bugs or crashes
- Feature requests
- Usability issues
- Performance problems

### Feedback Channels

- Email: [feedback-email]
- Support ticket system
- Weekly feedback meetings
- In-app feedback form (future feature)

---

## 🚀 Future Enhancements

Planned features for future versions:

1. **Real-time Sync Monitoring**
   - See when field workers last synced
   - Alerts for devices not syncing

2. **Analytics Dashboard**
   - Pickup trends over time
   - Geographic heatmaps
   - Field worker performance metrics

3. **Batch Operations**
   - Bulk approval in validation queue
   - Mass status updates
   - Batch export to Excel/PDF

4. **Offline Mode**
   - Full offline functionality
   - Background sync when online

5. **Push Notifications**
   - New pickup alerts
   - Validation requests
   - System announcements

---

**Document Version**: 1.0  
**Last Updated**: February 3, 2026  
**Prepared By**: Manus AI Development Team

---

## ✅ Pre-Distribution Checklist

Before sending this package to field supervisors:

- [ ] Test release APK on multiple Android devices
- [ ] Verify all features work correctly
- [ ] Confirm database connectivity
- [ ] Test login with real Manus accounts
- [ ] Verify photo loading from S3
- [ ] Check Google Maps integration
- [ ] Prepare training materials
- [ ] Set up support channels
- [ ] Create backup of keystore file
- [ ] Document known issues (if any)
- [ ] Prepare rollback plan
- [ ] Schedule training sessions
- [ ] Notify supervisors of deployment

**Ready for Distribution**: ☐ Yes ☐ No

**Approved By**: _____________________ Date: _________
