import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'do.rentato.app',
  appName: 'RentaTO',
  // We ship a thin native shell that loads the live web app.
  // This is the fastest path to a store-ready APK while the web app keeps
  // updating without re-publishing the native build.
  // If later you want a fully offline-capable bundle, set webDir to your
  // built frontend (e.g. 'dist') and remove server.url.
  webDir: 'dist',
  server: {
    url: 'https://renta-to.vercel.app',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0b1220',
      showSpinner: false
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
