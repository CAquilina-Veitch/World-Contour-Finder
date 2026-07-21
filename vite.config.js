import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

// vite-plugin-cesium copies Cesium's static Assets/Workers/Widgets/ThirdParty
// and sets CESIUM_BASE_URL, so we don't have to wire that up by hand.
export default defineConfig({
  plugins: [cesium()],
  server: { port: 5173, open: true },
  base: './'
});
