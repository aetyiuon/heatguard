import app from './app.json';
// Android's native Google Maps renderer requires a restricted SDK key.
// This key is designed to be public; restrict it to your Android package + signing certificate.
// Weather/AirNow secrets stay exclusively on the proxy.
export default {
  ...app.expo,
  android: {
    ...app.expo.android,
    ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      ? { config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } }
      : {}),
  },
};
