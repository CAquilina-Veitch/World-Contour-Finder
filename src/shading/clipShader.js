import * as Cesium from 'cesium';

// Two CustomShaders that share the same box math:
//   - FADE: translucent, alpha lerps from opaque (inside) toward u_outsideAlpha
//     (outside) over a feather band. The "artistic ghost" look with context.
//   - HARD: opaque, discards fragments outside the box -> a true cut with
//     correct depth and no translucency artifacts.
//
// Both transform each world-space fragment into the box's local frame by
// subtracting the ECEF centre FIRST, then rotating (u_boxRotInv), so the large
// magnitude subtraction doesn't destroy float precision. Working in ECEF via
// positionWC means we don't depend on any per-tileset reference frame.

const UNIFORMS = () => ({
  u_boxCenter: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3() },
  u_boxRotInv: { type: Cesium.UniformType.MAT3, value: new Cesium.Matrix3() },
  u_halfExtents: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(100, 100, 40) },
  u_outsideAlpha: { type: Cesium.UniformType.FLOAT, value: 0.15 },
  u_feather: { type: Cesium.UniformType.FLOAT, value: 8.0 }
});

const LOCAL_SETUP = `
  vec3 posWC = fsInput.attributes.positionWC;       // ECEF metres
  vec3 local = u_boxRotInv * (posWC - u_boxCenter);  // box-local metres
  vec3 d = abs(local) - u_halfExtents;
`;

export function createFadeShader() {
  return new Cesium.CustomShader({
    mode: Cesium.CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: Cesium.LightingModel.UNLIT, // preserve baked textures (esp. Google)
    translucencyMode: Cesium.CustomShaderTranslucencyMode.TRANSLUCENT,
    uniforms: UNIFORMS(),
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        ${LOCAL_SETUP}
        float outside = length(max(d, vec3(0.0)));      // 0 inside, >0 outside
        float t = clamp(outside / max(u_feather, 0.001), 0.0, 1.0);
        material.alpha *= mix(1.0, u_outsideAlpha, t);
      }
    `
  });
}

export function createHardShader() {
  return new Cesium.CustomShader({
    mode: Cesium.CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: Cesium.LightingModel.UNLIT,
    uniforms: UNIFORMS(),
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        ${LOCAL_SETUP}
        if (max(d.x, max(d.y, d.z)) > 0.0) discard;    // outside the box -> cut
      }
    `
  });
}

export function updateClipShaderUniforms(shader, { center, rotInv, halfExtents, outsideAlpha, feather }) {
  if (!shader) return;
  if (center) shader.setUniform('u_boxCenter', center);
  if (rotInv) shader.setUniform('u_boxRotInv', rotInv);
  if (halfExtents) shader.setUniform('u_halfExtents', halfExtents);
  if (outsideAlpha !== undefined) shader.setUniform('u_outsideAlpha', outsideAlpha);
  if (feather !== undefined) shader.setUniform('u_feather', feather);
}
