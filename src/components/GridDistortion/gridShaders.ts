/**
 * GLSL shaders + uniform shape for <GridDistortion>. Pulled out of
 * the component to keep the render lifecycle file focused on React +
 * WebGL plumbing rather than scrolling through ~80 lines of shader
 * source. The uniforms type mirrors the fragment shader's `uniform`
 * declarations — keep them in lock-step.
 *
 * Shader source is GLSL ES 1.00 (texture2D / varying), runs unchanged
 * on ogl's WebGL1 path and WebGL2's GLSL 3.00 compatibility layer.
 * ogl auto-injects `attribute vec2 uv;` / `attribute vec3 position;`
 * / `mat4 projectionMatrix;` / `mat4 modelViewMatrix;` for the Plane
 * geometry, so the vertex shader can reference them directly. BOTH
 * shaders declare `precision highp float;` explicitly; the previous
 * port left this off the vertex shader and was suspected as one of
 * the contributors to a Chrome renderer crash.
 *
 * Displacement texture is RGBA8 (uint8 per channel, 0..255), NOT
 * float32 / RGBA32F. The first ogl attempt used RGBA32F to match the
 * three.js DataTexture(FloatType) original; that's the most exotic
 * texture format on WebGL and the suspected crash cause. Uint8 has
 * universal driver support. Encoding: JS stores `(value + 50) * 2.55`
 * clamped to [0, 255] (centre 128 = no displacement). Shader decodes
 * via `(sampled.rg - 0.5) * 100.0` back to the [-50, 50] range the
 * three.js port used directly.
 */

import type { Texture, Vec4 } from "ogl";

export const vertexShader = `precision highp float;

uniform float time;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Fragment shader: mouse-warp sample of the current photo, plus a
// right-to-left noise-displacement reveal of the next photo while a
// transition is in flight. Adapted from Akella's WebGL Image
// Transitions demo 2 (https://tympanus.net/Development/webGLImageTransitions/index2.html);
// the original sweeps along vUv.y (top-to-bottom), we sweep along
// (1 - vUv.x) so the new image enters from the right edge and the
// wave-front travels leftward. fbm jitter on the threshold per
// pixel keeps the leading edge organic instead of a hard line.
export const fragmentShader = `precision highp float;

uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
uniform sampler2D uTexture2;
uniform float uProgress;
uniform float uDispIntensity;
// 0 = forward (sweep right-to-left); 1 = backward (sweep left-to-right).
uniform float uAxisFlip;
uniform vec4 resolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  // uDataTexture is RGBA8 with 128 centre = no displacement. Decode
  // back to the [-50, 50] range the original three.js DataTexture
  // held in float channels: (sampled.rg - 0.5) * 100.0.
  vec4 packed = texture2D(uDataTexture, vUv);
  vec2 offset = (packed.rg - 0.5) * 100.0;
  vec2 uvDistorted = uv - 0.02 * offset;

  vec4 t1 = texture2D(uTexture, uvDistorted);
  vec4 t2 = texture2D(uTexture2, uvDistorted);

  float n = fbm(vUv * 3.0);
  // Wave-front position. With uProgress sweeping 0 → 1 we map p
  // across [-2*disp, 1+2*disp] so that at progress=0 the smoothstep
  // threshold sits BELOW even the most-noise-warped axis value (=>
  // mask=1 everywhere => fully t1, no leak), and at progress=1 it
  // sits ABOVE every axis value (=> mask=0 everywhere => fully t2).
  // Without this the previous range left a few right-edge pixels
  // already flipped at frame zero — the visible "rough start" the
  // user reported.
  float p = mix(-2.0 * uDispIntensity, 1.0 + 2.0 * uDispIntensity, uProgress);
  float lower = p - uDispIntensity;
  float higher = p + uDispIntensity;
  // axisDir: forward (uAxisFlip=0) → high on LEFT, low on RIGHT, so
  // pixels with smaller axis values flip first → reveal sweeps R→L.
  // backward (uAxisFlip=1) → swap, so reveal sweeps L→R.
  float axisDir = mix(1.0 - vUv.x, vUv.x, uAxisFlip);
  float axis = axisDir + (n - 0.5) * uDispIntensity * 2.0;
  float mask = smoothstep(lower, higher, axis);

  // mask=1 -> t1 (current), mask=0 -> t2 (incoming). At
  // uProgress=0 mask is ~1 everywhere; at uProgress=1 mask is ~0
  // everywhere; the right-to-left wave-front passes between.
  gl_FragColor = mix(t2, t1, mask);
}`;

export type GridDistortionUniforms = {
  time: { value: number };
  resolution: { value: Vec4 };
  uTexture: { value: Texture };
  uTexture2: { value: Texture };
  uDataTexture: { value: Texture };
  uProgress: { value: number };
  uDispIntensity: { value: number };
  uAxisFlip: { value: number };
};

/** Easing for the transition progress (slow start, slow end). Linear
 *  reads as mechanical; cubic-in-out gives the wave a natural breath. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
