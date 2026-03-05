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
  plugins: {
    CapacitorHttp: {
      // Route ALL fetch() and XMLHttpRequest calls through the native HTTP layer.
      // This bypasses WebView CORS restrictions AND allows FormData/multipart to
      // be handled correctly by the native layer (OkHttp on Android).
      enabled: true,
    },
  },
  android: {}
};

export default config;
