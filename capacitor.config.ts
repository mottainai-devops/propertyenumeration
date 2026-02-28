import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.propertyenum.mobile.v2',
  appName: 'Property Enumeration',
  webDir: 'dist',
  server: {
    // IMPORTANT: Must be 'https' not 'http'.
    // Using 'http' causes the WebView to run on an HTTP origin, which triggers
    // Android's mixed-content and cleartext blocking rules even for HTTPS API calls.
    androidScheme: 'https',
    allowNavigation: ['*']
  },
  android: {}
};

export default config;
