import './panel.css';
import { SOURCE, CLIP_MODE } from '../config.js';
import { listPresetNames } from '../persistence/presets.js';

// The control panel. Pure DOM, no framework. It parses user input and calls
// back into `actions`; it subscribes to boxState to reflect live values (e.g.
// while dragging) without clobbering whatever field the user is editing.

function parseCoord(str) {
  const parts = String(str)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function parseDims(str) {
  const nums = String(str).match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  const [width, depth, height] = nums.slice(0, 3).map(Number);
  if ([width, depth, height].some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { width, depth, height };
}

function setIfNotFocused(el, value) {
  if (el && document.activeElement !== el) el.value = value;
}

const TEMPLATE = `
  <h1>World Contour Finder</h1>
  <p class="subtitle">Clip an artistic 3D chunk of the world</p>

  <section>
    <h2>Location</h2>
    <label>Latitude, Longitude</label>
    <div class="row">
      <input id="coord" type="text" placeholder="-33.8568, 151.2153" style="flex:2" />
      <button id="flyBtn">Fly</button>
    </div>
    <p class="hint" id="groundHint">Ground height: –</p>
  </section>

  <section>
    <h2>Data source</h2>
    <div class="seg">
      <button data-src="ion" id="srcIon">Cesium · free</button>
      <button data-src="google" id="srcGoogle">Google 3D</button>
    </div>
  </section>

  <section>
    <h2>Chunk bounds</h2>
    <label>Width × Depth × Height (m)</label>
    <div class="row dims">
      <input id="dims" type="text" placeholder="200 x 200 x 80" style="flex:2" />
      <button id="dimsBtn">Set</button>
    </div>
    <p class="hint">Drag the white <b>center</b> handle to move it along the ground. Drag a colored face handle to resize (red = width, green = depth, blue = height).</p>
  </section>

  <section>
    <h2>Outside fade</h2>
    <label>Outside transparency <span class="val" id="alphaVal"></span></label>
    <input id="alpha" type="range" min="0" max="1" step="0.01" />
    <label>Edge softness <span class="val" id="featherVal"></span></label>
    <input id="feather" type="range" min="0" max="40" step="1" />
    <label>Clip mode</label>
    <div class="seg">
      <button data-mode="fade" id="modeFade">Fade</button>
      <button data-mode="hard" id="modeHard">Hard</button>
      <button data-mode="off" id="modeOff">Off</button>
    </div>
  </section>

  <section>
    <h2>Presets</h2>
    <div class="row">
      <input id="presetName" type="text" placeholder="preset name" style="flex:2" />
      <button id="savePreset">Save</button>
    </div>
    <div class="row">
      <select id="presetList"></select>
      <button id="loadPreset" class="ghost">Load</button>
      <button id="delPreset" class="ghost">Del</button>
    </div>
    <div class="row">
      <button id="exportBtn" class="ghost" style="flex:1">Export JSON</button>
      <button id="importBtn" class="ghost" style="flex:1">Import JSON</button>
      <input id="importFile" type="file" accept="application/json" hidden />
    </div>
  </section>

  <section>
    <h2>Settings · API keys</h2>
    <label>Cesium ion token</label>
    <input id="ionToken" type="password" placeholder="paste token" />
    <label>Google Maps API key</label>
    <input id="googleKey" type="password" placeholder="paste key (optional)" />
    <div class="row" style="margin-top:8px">
      <button id="saveKeys" style="flex:1">Save keys &amp; reload source</button>
    </div>
    <p class="hint">Free ion token: ion.cesium.com/tokens · Google key: Google Cloud console → Map Tiles API. Keys are stored only in your browser.</p>
  </section>
`;

export function createPanel(boxState, actions, initial) {
  const panel = document.getElementById('panel');
  panel.innerHTML = TEMPLATE;
  const $ = (id) => panel.querySelector('#' + id);

  // --- Location ---
  const fly = () => {
    const c = parseCoord($('coord').value);
    if (!c) return actions.notify('Enter coordinates as "lat, lon".');
    actions.fly(c.lon, c.lat);
  };
  $('flyBtn').onclick = fly;
  $('coord').addEventListener('keydown', (e) => e.key === 'Enter' && fly());

  // --- Data source ---
  const srcButtons = { [SOURCE.ion]: $('srcIon'), [SOURCE.google]: $('srcGoogle') };
  $('srcIon').onclick = () => actions.setSource(SOURCE.ion);
  $('srcGoogle').onclick = () => actions.setSource(SOURCE.google);

  // --- Bounds ---
  const applyDims = () => {
    const d = parseDims($('dims').value);
    if (!d) return actions.notify('Enter bounds like "200 x 200 x 80".');
    actions.applyDims(d);
  };
  $('dimsBtn').onclick = applyDims;
  $('dims').addEventListener('keydown', (e) => e.key === 'Enter' && applyDims());

  // --- Fade ---
  $('alpha').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('alphaVal').textContent = Math.round((1 - v) * 100) + '% hidden';
    actions.setOutsideAlpha(v);
  });
  $('feather').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('featherVal').textContent = v + ' m';
    actions.setFeather(v);
  });

  const modeButtons = {
    [CLIP_MODE.fade]: $('modeFade'),
    [CLIP_MODE.hard]: $('modeHard'),
    [CLIP_MODE.off]: $('modeOff')
  };
  $('modeFade').onclick = () => actions.setClipMode(CLIP_MODE.fade);
  $('modeHard').onclick = () => actions.setClipMode(CLIP_MODE.hard);
  $('modeOff').onclick = () => actions.setClipMode(CLIP_MODE.off);

  // --- Presets ---
  function refreshPresets() {
    const names = listPresetNames();
    $('presetList').innerHTML = names.length
      ? names.map((n) => `<option>${n}</option>`).join('')
      : '<option value="">(none saved)</option>';
  }
  $('savePreset').onclick = () => {
    const name = $('presetName').value.trim();
    if (!name) return actions.notify('Name the preset first.');
    actions.savePreset(name);
    refreshPresets();
    $('presetList').value = name;
  };
  $('loadPreset').onclick = () => {
    const name = $('presetList').value;
    if (name) actions.loadPreset(name);
  };
  $('delPreset').onclick = () => {
    const name = $('presetList').value;
    if (name) {
      actions.deletePreset(name);
      refreshPresets();
    }
  };
  $('exportBtn').onclick = () => actions.exportPreset($('presetName').value.trim() || 'chunk');
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) actions.importPreset(file);
    e.target.value = '';
  });

  // --- Keys ---
  $('ionToken').value = initial.ionToken || '';
  $('googleKey').value = initial.googleKey || '';
  $('saveKeys').onclick = () =>
    actions.saveKeys({ ionToken: $('ionToken').value.trim(), googleKey: $('googleKey').value.trim() });

  // --- Initial widget values ---
  $('alpha').value = initial.outsideAlpha;
  $('alphaVal').textContent = Math.round((1 - initial.outsideAlpha) * 100) + '% hidden';
  $('feather').value = initial.feather;
  $('featherVal').textContent = initial.feather + ' m';
  refreshPresets();

  // --- Reflect state (live during drags) ---
  function reflect(state) {
    setIfNotFocused($('coord'), `${state.lat.toFixed(6)}, ${state.lon.toFixed(6)}`);
    setIfNotFocused(
      $('dims'),
      `${Math.round(state.width)} x ${Math.round(state.depth)} x ${Math.round(state.height)}`
    );
    $('groundHint').textContent = `Ground height: ${state.groundHeight.toFixed(1)} m`;
  }
  boxState.subscribe(reflect);
  reflect(boxState.get());

  function setActiveSource(src) {
    for (const [key, btn] of Object.entries(srcButtons)) btn.classList.toggle('active', key === src);
  }
  function setActiveMode(mode) {
    for (const [key, btn] of Object.entries(modeButtons)) btn.classList.toggle('active', key === mode);
  }

  return { refreshPresets, setActiveSource, setActiveMode };
}
