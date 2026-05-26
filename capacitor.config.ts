import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coordimentor.app',
  appName: 'Coordimentor',
  webDir: 'build',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '591487860438-sgf7goqlbvd48bmt8vv9u1al1st5g33k.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
  server: {
    allowNavigation: ['unpkg.com', 'cdn.jsdelivr.net']
  }
};

export default config;
