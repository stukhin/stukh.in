"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./GridDistortion.module.css";

type Props = {
  imageSrc: string;
  /**
   * Number of cells per side of the displacement grid. Higher = finer
   * distortion at the cost of CPU each frame.
   */
  grid?: number;
  /**
   * Radius of the cursor's influence (in normalized cells).
   */
  mouse?: number;
  /**
   * Strength of each displacement nudge.
   */
  strength?: number;
  /**
   * How quickly cells return to neutral (0–1; closer to 1 = slower).
   */
  relaxation?: number;
  /**
   * Duration (ms) of the noise-displacement crossfade between photos
   * when `imageSrc` changes. Adapted from Akella's WebGL Image
   * Transitions demo 2, swept right-to-left instead of top-to-bottom.
   */
  transitionMs?: number;
  /**
   * Width of the noise-warped smoothstep edge during the transition.
   * Higher values give a more chaotic, wave-like sweep; lower values
   * read as a cleaner wipe. 0.4–0.6 is the sweet spot for landscape
   * photography.
   */
  dispIntensity?: number;
  className?: string;
};

const vertexShader = `
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
const fragmentShader = `
uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
uniform sampler2D uTexture2;
uniform float uProgress;
uniform float uDispIntensity;
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
  vec4 offset = texture2D(uDataTexture, vUv);
  vec2 uvDistorted = uv - 0.02 * offset.rg;

  vec4 t1 = texture2D(uTexture, uvDistorted);
  vec4 t2 = texture2D(uTexture2, uvDistorted);

  float n = fbm(vUv * 3.0);
  float lower = uProgress - uDispIntensity;
  float higher = uProgress + uDispIntensity;
  // (1 - vUv.x) is high on the LEFT, low on the RIGHT — so as
  // uProgress sweeps 0 -> 1 the threshold rises and pixels with
  // smaller axis values (right-side first) flip from t1 to t2.
  float axis = (1.0 - vUv.x) + (n - 0.5) * uDispIntensity * 2.0;
  float mask = smoothstep(lower, higher, axis);

  // mask=1 -> t1 (current), mask=0 -> t2 (incoming). At
  // uProgress=0 mask is ~1 everywhere; at uProgress=1 mask is ~0
  // everywhere; the right-to-left wave-front passes between.
  gl_FragColor = mix(t2, t1, mask);
}`;

/**
 * Grid-distortion image effect (port of the React Bits component).
 *
 * Splits the rendered image into a `grid × grid` displacement texture
 * and pushes cells around the cursor as it moves over the canvas; the
 * cells relax back over time. Most of the cost is the per-frame CPU
 * loop over the grid, so keep `grid` modest (10–20 looks good).
 *
 * Texture loading is split into its own effect so swapping `imageSrc`
 * doesn't tear down the renderer/scene/animation loop — only the
 * uniform's texture is reassigned. That makes it cheap to feed in a
 * cycling slider.
 */
// Easing for the transition progress (slow start, slow end). Linear
// reads as mechanical; cubic-in-out gives the wave a natural breath.
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function GridDistortion({
  imageSrc,
  grid = 15,
  mouse = 0.1,
  strength = 0.15,
  relaxation = 0.9,
  transitionMs = 1200,
  dispIntensity = 0.5,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniformsRef = useRef<any>(null);
  const imageAspectRef = useRef(1);
  const handleResizeRef = useRef<(() => void) | null>(null);
  const transitionRafRef = useRef<number | null>(null);

  // Renderer / scene / loop. Re-runs only when grid params change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
    camera.position.z = 2;

    const uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector4() },
      uTexture: { value: null as THREE.Texture | null },
      // Second texture slot used while a photo crossfade is in
      // flight. Points at the same texture as uTexture between
      // transitions so the shader's sample of t2 is always valid.
      uTexture2: { value: null as THREE.Texture | null },
      uDataTexture: { value: null as THREE.DataTexture | null },
      uProgress: { value: 0 },
      uDispIntensity: { value: dispIntensity },
    };
    uniformsRef.current = uniforms;

    const size = grid;
    // Zero-init the displacement texture. The original port seeded
    // every cell with random offsets in [-125, +125], which produced
    // a wild "checker / scrambled tiles" frame on first load that
    // only resolved to clean once the relaxation kicked in. Starting
    // at zero means the photo paints clean from the very first
    // frame — cursor movement then introduces displacement as
    // designed; nothing visual is lost.
    const data = new Float32Array(4 * size * size);

    const dataTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;
    uniforms.uDataTexture.value = dataTexture;

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(1, 1, size - 1, size - 1);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const containerAspect = width / height;
      renderer.setSize(width, height);

      // Cover-fit: scale plane up by the larger of (containerAspect,
      // imageAspect) so the image fills the container without ever
      // showing transparent edges. Default texture-loader sets the
      // aspect via imageAspectRef once a texture is in.
      const imageAspect = imageAspectRef.current;
      let planeW = containerAspect;
      let planeH = 1;
      if (containerAspect / imageAspect > 1) {
        planeH = containerAspect / imageAspect;
      } else {
        planeW = imageAspect * (1 / (containerAspect / imageAspect));
      }
      // Simpler cover formula: take the max of width-driven and
      // height-driven scales.
      const sx = Math.max(containerAspect, imageAspect);
      const sy = sx / imageAspect;
      plane.scale.set(sx, sy, 1);

      const frustumHeight = 1;
      const frustumWidth = frustumHeight * containerAspect;
      camera.left = -frustumWidth / 2;
      camera.right = frustumWidth / 2;
      camera.top = frustumHeight / 2;
      camera.bottom = -frustumHeight / 2;
      camera.updateProjectionMatrix();

      uniforms.resolution.value.set(width, height, 1, 1);
    };
    handleResizeRef.current = handleResize;

    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", handleResize);
    }

    const mouseState = {
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vX: 0,
      vY: 0,
      lastEventAt: 0,
    };
    // Hard cap on per-event mouse delta. Without this a focus-regain
    // / window-blur jump or a long pause between events can produce a
    // huge vX/vY that pumps the data texture out to extreme offsets.
    const MAX_DELTA = 0.04;
    // Cap on absolute data-texture values so a missed relaxation
    // tick (e.g., rAF throttled while the window is unfocused)
    // can't produce the runaway-grid glitch.
    const MAX_OFFSET = 50;
    // If more than this gap passed since the last mousemove, treat
    // the next event as a fresh start (zero velocity) instead of a
    // jump from a stale previous position.
    const STALE_GAP_MS = 250;

    const resetMouse = () => {
      mouseState.x = 0;
      mouseState.y = 0;
      mouseState.prevX = 0;
      mouseState.prevY = 0;
      mouseState.vX = 0;
      mouseState.vY = 0;
      mouseState.lastEventAt = 0;
    };

    const clearData = () => {
      const arr = dataTexture.image.data as unknown as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = 0;
      dataTexture.needsUpdate = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      const now = performance.now();
      const stale = now - mouseState.lastEventAt > STALE_GAP_MS;
      let dx = x - mouseState.prevX;
      let dy = y - mouseState.prevY;
      if (stale) {
        dx = 0;
        dy = 0;
      }
      // Hard cap on instantaneous velocity.
      if (dx > MAX_DELTA) dx = MAX_DELTA;
      else if (dx < -MAX_DELTA) dx = -MAX_DELTA;
      if (dy > MAX_DELTA) dy = MAX_DELTA;
      else if (dy < -MAX_DELTA) dy = -MAX_DELTA;
      mouseState.vX = dx;
      mouseState.vY = dy;
      mouseState.x = x;
      mouseState.y = y;
      mouseState.prevX = x;
      mouseState.prevY = y;
      mouseState.lastEventAt = now;
    };

    const handleMouseLeave = () => {
      resetMouse();
      dataTexture.needsUpdate = true;
    };

    // Tab/window focus changes can throttle rAF and skip mousemoves —
    // when the user comes back, reset the mouse state and clear any
    // leftover displacement so we don't render a stale grid.
    const handleVisibility = () => {
      if (document.hidden) return;
      resetMouse();
      clearData();
    };
    const handleBlur = () => resetMouse();

    // The container itself is pointer-events: none in CSS so cursors
    // and edge-zone clicks pass through to the page; we listen on
    // window for the mouse position instead.
    window.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    handleResize();

    let raf = 0;
    let lastFrame = performance.now();
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;

      // Frame-rate-independent relaxation: scale the per-frame decay
      // so that a missed frame still decays the right amount when the
      // browser eventually catches up. Capped so a 5+ second pause
      // doesn't immediately zero everything jarringly.
      const dt = Math.min((now - lastFrame) / 16.67, 30);
      lastFrame = now;
      const decay = Math.pow(relaxation, dt);

      const arr = dataTexture.image.data as unknown as Float32Array;
      for (let i = 0; i < size * size; i++) {
        let a = arr[i * 4] * decay;
        let b = arr[i * 4 + 1] * decay;
        // Clamp absolute value — a runaway accumulation here is what
        // produces the dark-grid glitch the user reported.
        if (a > MAX_OFFSET) a = MAX_OFFSET;
        else if (a < -MAX_OFFSET) a = -MAX_OFFSET;
        if (b > MAX_OFFSET) b = MAX_OFFSET;
        else if (b < -MAX_OFFSET) b = -MAX_OFFSET;
        arr[i * 4] = a;
        arr[i * 4 + 1] = b;
      }

      const gridMouseX = size * mouseState.x;
      const gridMouseY = size * mouseState.y;
      const maxDist = size * mouse;

      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const distSq =
            Math.pow(gridMouseX - i, 2) + Math.pow(gridMouseY - j, 2);
          if (distSq < maxDist * maxDist) {
            const index = 4 * (i + size * j);
            const power = Math.min(maxDist / Math.sqrt(distSq), 10);
            arr[index] += strength * 100 * mouseState.vX * power;
            arr[index + 1] -= strength * 100 * mouseState.vY * power;
          }
        }
      }

      dataTexture.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      if (transitionRafRef.current !== null) {
        cancelAnimationFrame(transitionRafRef.current);
        transitionRafRef.current = null;
      }
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      container.removeEventListener("mouseleave", handleMouseLeave);

      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      dataTexture.dispose();
      if (uniforms.uTexture.value) uniforms.uTexture.value.dispose();
      // uTexture2 holds the same texture as uTexture between
      // transitions; only dispose the in-flight incoming texture if
      // it differs (mid-transition unmount).
      if (
        uniforms.uTexture2.value &&
        uniforms.uTexture2.value !== uniforms.uTexture.value
      ) {
        uniforms.uTexture2.value.dispose();
      }
      uniformsRef.current = null;
      handleResizeRef.current = null;
    };
  }, [grid, mouse, strength, relaxation, dispIntensity]);

  // Texture loading + crossfade. Swapping `imageSrc` doesn't tear
  // down the renderer — we just load the new image, drop it into
  // the second texture slot, and animate uProgress 0 → 1 so the
  // shader's right-to-left noise reveal sweeps the new photo in
  // over `transitionMs`. After the animation settles the new
  // texture is moved to the primary slot and the old one is
  // disposed; if a fresh imageSrc arrives mid-transition we snap-
  // finish whatever was already in flight before kicking off the
  // next one (rare in practice — autoplay is 7 s, transition 1.2 s).
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(imageSrc, (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      // First load: no previous photo to fade from. Mirror the
      // texture into both slots so the shader's t2 sample is
      // valid before the first transition kicks in.
      if (!uniforms.uTexture.value) {
        uniforms.uTexture.value = texture;
        uniforms.uTexture2.value = texture;
        uniforms.uProgress.value = 0;
        imageAspectRef.current = texture.image.width / texture.image.height;
        handleResizeRef.current?.();
        return;
      }

      // Snap-finish any in-flight transition before starting the
      // next one: settle uTexture := uTexture2 (the partially-
      // revealed incoming photo), reset progress, dispose the
      // outer texture that's no longer referenced.
      if (transitionRafRef.current !== null) {
        cancelAnimationFrame(transitionRafRef.current);
        transitionRafRef.current = null;
        const outer = uniforms.uTexture.value as THREE.Texture | null;
        if (outer && outer !== uniforms.uTexture2.value) {
          outer.dispose();
        }
        uniforms.uTexture.value = uniforms.uTexture2.value;
        uniforms.uProgress.value = 0;
      }

      const previousCurrent = uniforms.uTexture.value as THREE.Texture | null;
      uniforms.uTexture2.value = texture;
      uniforms.uProgress.value = 0;
      imageAspectRef.current = texture.image.width / texture.image.height;
      handleResizeRef.current?.();

      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / transitionMs);
        uniforms.uProgress.value = easeInOutCubic(p);
        if (p < 1) {
          transitionRafRef.current = requestAnimationFrame(tick);
        } else {
          transitionRafRef.current = null;
          uniforms.uTexture.value = uniforms.uTexture2.value;
          uniforms.uProgress.value = 0;
          if (previousCurrent && previousCurrent !== uniforms.uTexture.value) {
            previousCurrent.dispose();
          }
        }
      };
      transitionRafRef.current = requestAnimationFrame(tick);
    });
    return () => {
      disposed = true;
    };
  }, [imageSrc, transitionMs]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
