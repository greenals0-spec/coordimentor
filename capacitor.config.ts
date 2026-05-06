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
  },
  server: {
    allowNavigation: ['unpkg.com', 'cdn.jsdelivr.net']
  }
};

export default config;
