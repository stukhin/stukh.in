"use client";

import { useEffect, useRef } from "react";
// Ported from three.js → ogl in commit (TBD). three was tree-shaking
// to ~140 KB minified on the home route just to draw a plane, a
// data texture, and an image texture; ogl is already on the page
// (LiquidEther on /blog, LightRays on /nature & /city) so this
// removes the second WebGL library entirely. Visual output is
// pixel-for-pixel the same — the displacement math, mouse handling,
// and crossfade timing live untouched in the same shader source.
import {
  Camera,
  Mesh,
  type OGLRenderingContext,
  Plane,
  Program,
  Renderer,
  Texture,
  Transform,
  Vec4,
} from "ogl";
import {
  easeInOutCubic,
  fragmentShader,
  vertexShader,
  type GridDistortionUniforms,
} from "./gridShaders";
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
  /**
   * Direction the wave-front sweeps in when transitioning. "forward"
   * sweeps right-to-left (new photo enters from the right); "backward"
   * sweeps left-to-right (new photo enters from the left). The
   * caller flips this each time the user pages prev so the visual
   * feedback matches the navigation direction.
   */
  direction?: "forward" | "backward";
  className?: string;
};

/**
 * Grid-distortion image effect (port of the React Bits component,
 * since rewritten on ogl).
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
export default function GridDistortion({
  imageSrc,
  grid = 15,
  mouse = 0.1,
  strength = 0.15,
  relaxation = 0.9,
  transitionMs = 1200,
  dispIntensity = 0.5,
  direction = "forward",
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<GridDistortionUniforms | null>(null);
  /** Mutable backing for the displacement DataTexture — we mutate
   *  this Float32Array directly each frame and call texture.update()
   *  to push the new bytes to the GPU. Kept in a ref so the texture-
   *  loader effect can read it for clearData. */
  const dataArrRef = useRef<Float32Array | null>(null);
  const dataTextureRef = useRef<Texture | null>(null);
  /** The ogl-augmented WebGL context. Captured by the renderer effect
   *  so the texture-loading effect (separate lifecycle) can construct
   *  Texture instances without re-creating the renderer. */
  const glRef = useRef<OGLRenderingContext | null>(null);
  const imageAspectRef = useRef(1);
  const handleResizeRef = useRef<(() => void) | null>(null);
  const transitionRafRef = useRef<number | null>(null);

  // Renderer / scene / loop. Re-runs only when grid params change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio, 2),
      powerPreference: "high-performance",
    });
    const gl = renderer.gl;
    glRef.current = gl;
    gl.clearColor(0, 0, 0, 0);
    container.innerHTML = "";
    container.appendChild(gl.canvas);

    const scene = new Transform();
    const camera = new Camera(gl);
    camera.position.z = 2;

    const size = grid;
    // Zero-init the displacement texture. The original port seeded
    // every cell with random offsets in [-125, +125], which produced
    // a wild "checker / scrambled tiles" frame on first load that
    // only resolved to clean once the relaxation kicked in. Starting
    // at zero means the photo paints clean from the very first
    // frame — cursor movement then introduces displacement as
    // designed; nothing visual is lost.
    const data = new Float32Array(4 * size * size);
    dataArrRef.current = data;

    // Float-typed RGBA texture for the displacement field. On WebGL2
    // (default for ogl when supported) the internalFormat must be a
    // sized format (RGBA32F) for FLOAT data; on WebGL1 the linear
    // format works with the OES_texture_float extension which ogl's
    // Renderer auto-enables. NEAREST filtering on this texture so
    // each cell's offset reads exact (no inter-cell bleed).
    const isWebGL2 = (gl as WebGL2RenderingContext).RGBA32F !== undefined;
    const dataTexture = new Texture(gl, {
      image: data,
      width: size,
      height: size,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: isWebGL2
        ? (gl as WebGL2RenderingContext).RGBA32F
        : gl.RGBA,
      generateMipmaps: false,
      flipY: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    dataTextureRef.current = dataTexture;

    // Placeholder textures so the program has something to bind on
    // the very first frame — `imageSrc`-loading replaces these once
    // the photo decodes. A 1×1 transparent works fine; the shader
    // never sees it for more than one frame.
    const placeholder = new Texture(gl);

    const uniforms: GridDistortionUniforms = {
      time: { value: 0 },
      resolution: { value: new Vec4() },
      uTexture: { value: placeholder },
      // Second texture slot used while a photo crossfade is in
      // flight. Points at the same texture as uTexture between
      // transitions so the shader's sample of t2 is always valid.
      uTexture2: { value: placeholder },
      uDataTexture: { value: dataTexture },
      uProgress: { value: 0 },
      uDispIntensity: { value: dispIntensity },
      uAxisFlip: { value: direction === "backward" ? 1 : 0 },
    };
    uniformsRef.current = uniforms;

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms,
      transparent: true,
      // `cullFace: null` mirrors three's DoubleSide — both sides of
      // the plane render, which matters here because the orthographic
      // camera can in principle look at either side depending on
      // future tweaks. No back-face culling overhead either.
      cullFace: null,
    });

    const geometry = new Plane(gl, {
      width: 1,
      height: 1,
      widthSegments: size - 1,
      heightSegments: size - 1,
    });
    const plane = new Mesh(gl, { geometry, program });
    plane.setParent(scene);

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const containerAspect = width / height;
      renderer.setSize(width, height);

      // Cover-fit: scale plane up by the larger of (containerAspect,
      // imageAspect) so the image fills the container without ever
      // showing transparent edges.
      const imageAspect = imageAspectRef.current;
      const sx = Math.max(containerAspect, imageAspect);
      const sy = sx / imageAspect;
      plane.scale.set(sx, sy, 1);

      const frustumHeight = 1;
      const frustumWidth = frustumHeight * containerAspect;
      camera.orthographic({
        left: -frustumWidth / 2,
        right: frustumWidth / 2,
        top: frustumHeight / 2,
        bottom: -frustumHeight / 2,
        near: -1000,
        far: 1000,
      });

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
      for (let i = 0; i < data.length; i++) data[i] = 0;
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

      for (let i = 0; i < size * size; i++) {
        let a = data[i * 4] * decay;
        let b = data[i * 4 + 1] * decay;
        // Clamp absolute value — a runaway accumulation here is what
        // produces the dark-grid glitch the user reported.
        if (a > MAX_OFFSET) a = MAX_OFFSET;
        else if (a < -MAX_OFFSET) a = -MAX_OFFSET;
        if (b > MAX_OFFSET) b = MAX_OFFSET;
        else if (b < -MAX_OFFSET) b = -MAX_OFFSET;
        data[i * 4] = a;
        data[i * 4 + 1] = b;
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
            data[index] += strength * 100 * mouseState.vX * power;
            data[index + 1] -= strength * 100 * mouseState.vY * power;
          }
        }
      }

      // Push the mutated displacement buffer to the GPU. ogl's
      // `needsUpdate = true` re-uploads the underlying `image` to
      // the same texture handle on the next render pass.
      dataTexture.needsUpdate = true;
      renderer.render({ scene, camera });
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

      // ogl has no .dispose() per object — drop refs and tear down
      // the WebGL context via the standard extension. The browser
      // GCs the textures + buffers attached to the now-dead context.
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas);
      }
      uniformsRef.current = null;
      dataArrRef.current = null;
      dataTextureRef.current = null;
      glRef.current = null;
      handleResizeRef.current = null;
    };
  }, [grid, mouse, strength, relaxation, dispIntensity, direction]);

  // Direction prop drives a single uniform — no need to rebuild the
  // renderer / scene just to flip the sweep axis.
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    uniforms.uAxisFlip.value = direction === "backward" ? 1 : 0;
  }, [direction]);

  // Texture loading + crossfade. Swapping `imageSrc` doesn't tear
  // down the renderer — we just load the new image, drop it into
  // the second texture slot, and animate uProgress 0 → 1 so the
  // shader's right-to-left noise reveal sweeps the new photo in
  // over `transitionMs`. After the animation settles the new
  // texture is moved to the primary slot; the old one is just
  // dereferenced (ogl has no .dispose(), browser GCs it).
  // If a fresh imageSrc arrives mid-transition we snap-finish
  // whatever was already in flight before kicking off the next
  // (rare — autoplay is 7 s, transition 1.2 s).
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (disposed) return;
      const gl = glRef.current;
      if (!gl) return;
      const texture = new Texture(gl, {
        image: img,
        generateMipmaps: false,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
      });
      texture.needsUpdate = true;

      // First load: no previous photo to fade from. Mirror the
      // texture into both slots so the shader's t2 sample is
      // valid before the first transition kicks in.
      const placeholderStillBound =
        uniforms.uTexture.value === uniforms.uTexture2.value &&
        !uniforms.uTexture.value.image;
      if (placeholderStillBound) {
        uniforms.uTexture.value = texture;
        uniforms.uTexture2.value = texture;
        uniforms.uProgress.value = 0;
        imageAspectRef.current = img.naturalWidth / img.naturalHeight;
        handleResizeRef.current?.();
        return;
      }

      // Snap-finish any in-flight transition before starting the
      // next one: settle uTexture := uTexture2 (the partially-
      // revealed incoming photo), reset progress.
      if (transitionRafRef.current !== null) {
        cancelAnimationFrame(transitionRafRef.current);
        transitionRafRef.current = null;
        uniforms.uTexture.value = uniforms.uTexture2.value;
        uniforms.uProgress.value = 0;
      }

      uniforms.uTexture2.value = texture;
      uniforms.uProgress.value = 0;
      imageAspectRef.current = img.naturalWidth / img.naturalHeight;
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
        }
      };
      transitionRafRef.current = requestAnimationFrame(tick);
    };
    img.src = imageSrc;

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
