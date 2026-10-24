import './src/services/monitoring';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';
import { C } from './src/ui/theme';
// Match browser-native scrollbars and form chrome to the application surfaces.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.style.colorScheme = 'dark';
  document.documentElement.style.backgroundColor = C.bg;
}
registerRootComponent(App);
