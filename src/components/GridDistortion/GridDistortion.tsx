"use client";

import { useEffect, useRef } from "react";
import {
  Camera,
  Mesh,
  Plane,
  Program,
  Renderer,
  Texture,
  type OGLRenderingContext,
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
  /** Called when WebGL can't start; the parent shows a plain photo. */
  onError?: () => void;
};

// WebGL2 sized float format (not on the WebGL1 | WebGL2 union type).
const GL_RGBA32F = 0x8814;

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
 *
 * Shader sources and the matching `GridDistortionUniforms` type live
 * in `./gridShaders.ts` so this file stays focused on the React +
 * ogl plumbing.
 *
 * Ported from three.js to ogl (like LiquidEther), which drops `three`
 * from the app. three state the port reproduces by hand, so the photo
 * renders the same:
 *  - no colour conversion anywhere: TextureLoader textures were
 *    NoColorSpace (uploaded raw, UNPACK_COLORSPACE_CONVERSION = NONE)
 *    and a ShaderMaterial without `colorspace_fragment` writes
 *    gl_FragColor untouched despite outputColorSpace = sRGB;
 *  - photo textures: flipY on, linear min/mag, no mipmaps, clamp;
 *    the grid DataTexture: RGBA float, nearest, flipY off, align 1;
 *  - a premultiplied-alpha context cleared to (0, 0, 0, 0) with
 *    three's NormalBlending for a non-premultiplied material;
 *  - DoubleSide → no face culling.
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
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Uniforms shape mirrors the GLSL fragment shader — each entry is
  // an ogl `{ value }` envelope. Typed explicitly so the texture-
  // loader effect can write `uniforms.uTexture.value = newTexture`
  // without the `any` escape hatch the earlier port relied on.
  const uniformsRef = useRef<GridDistortionUniforms | null>(null);
  // The live context, for the texture-loader effect to upload into.
  const glRef = useRef<OGLRenderingContext | null>(null);
  const imageAspectRef = useRef(1);
  const handleResizeRef = useRef<(() => void) | null>(null);
  const transitionRafRef = useRef<number | null>(null);
  // Set whenever something outside the render loop changes what's on
  // screen (resize, new texture, transition end) — the loop otherwise
  // skips frames once the grid has relaxed.
  const renderPendingRef = useRef(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Renderer / scene / loop. Re-runs only when grid params change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ogl falls back to WebGL1 when WebGL2 is missing and throws on
    // the null context when WebGL is unavailable altogether. three's
    // WebGLRenderer defaults, made explicit: premultiplied alpha,
    // antialias, no stencil. No depth buffer — a single plane, so
    // three's depth test never rejected a fragment.
    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        antialias: true,
        alpha: true,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        dpr: Math.min(window.devicePixelRatio, 2),
      });
    } catch {
      onErrorRef.current?.();
      return;
    }
    const gl = renderer.gl;
    const canvas = gl.canvas;
    // Everything allocated below, so a failed init and the effect
    // cleanup share one teardown.
    let program: Program | null = null;
    let geometry: Plane | null = null;
    let dataTexture: Texture | null = null;
    const teardownGL = () => {
      try {
        if (program) {
          gl.deleteShader(program.vertexShader);
          gl.deleteShader(program.fragmentShader);
          program.remove();
        }
        geometry?.remove();
        if (dataTexture) gl.deleteTexture(dataTexture.texture);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        // ogl has no forceContextLoss — release the context now
        // rather than whenever GC gets to it.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* context already gone */
      }
    };

    // The grid is uploaded as RGBA float. WebGL2 has float textures
    // in core (RGBA32F, nearest-sampled so no _linear extension is
    // needed); WebGL1 needs OES_texture_float (ogl's Renderer already
    // requested it — this reads it back). Without it, fall back.
    if (!renderer.isWebgl2 && !gl.getExtension("OES_texture_float")) {
      teardownGL();
      onErrorRef.current?.();
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    // three uploads NoColorSpace textures with colour conversion off;
    // the browser default would apply an embedded ICC profile. ogl
    // never touches this flag, so set it once for the context.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    container.innerHTML = "";
    container.appendChild(canvas);

    const camera = new Camera(gl, {
      left: -0.5,
      right: 0.5,
      top: 0.5,
      bottom: -0.5,
      near: -1000,
      far: 1000,
    });
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

    // three's DataTexture defaults: nearest filtering, no mipmaps,
    // no flip, clamp, 1-byte row alignment.
    const grid32 = new Texture(gl, {
      image: data,
      width: size,
      height: size,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: renderer.isWebgl2 ? GL_RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
      flipY: false,
      unpackAlignment: 1,
    });
    dataTexture = grid32;

    const uniforms: GridDistortionUniforms = {
      time: { value: 0 },
      resolution: { value: [0, 0, 1, 1] },
      uTexture: { value: null },
      // Second texture slot used while a photo crossfade is in
      // flight. Points at the same texture as uTexture between
      // transitions so the shader's sample of t2 is always valid.
      uTexture2: { value: null },
      uDataTexture: { value: grid32 },
      uProgress: { value: 0 },
      uDispIntensity: { value: dispIntensity },
      uAxisFlip: { value: direction === "backward" ? 1 : 0 },
    };

    let plane: Mesh;
    try {
      program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms,
        transparent: true,
        cullFace: false,
        depthTest: false,
        depthWrite: false,
      });
      // ogl only console.warns on a failed link — treat it as WebGL
      // not starting so the parent shows the plain photo instead.
      if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
        throw new Error("GridDistortion: shader program failed to link");
      }
      // three's NormalBlending on a transparent, non-premultiplied
      // material (ogl's own default would be premultiplied here).
      program.setBlendFunc(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );
      geometry = new Plane(gl, {
        width: 1,
        height: 1,
        widthSegments: size - 1,
        heightSegments: size - 1,
      });
      plane = new Mesh(gl, { geometry, program });
      // Always fills the view (cover-fit); skip ogl's bounds test.
      plane.frustumCulled = false;
    } catch {
      teardownGL();
      onErrorRef.current?.();
      return;
    }
    uniformsRef.current = uniforms;
    glRef.current = gl;

    const handleResize = () => {
      renderPendingRef.current = true;
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
      // Cover formula: the max of width-driven and height-driven scales.
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
      });

      uniforms.resolution.value = [width, height, 1, 1];
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
      data.fill(0);
      grid32.needsUpdate = true;
      renderPendingRef.current = true;
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
      grid32.needsUpdate = true;
      renderPendingRef.current = true;
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

      // The last mousemove's velocity would otherwise be re-applied
      // every frame, so the warp never settled under a resting cursor.
      mouseState.vX *= decay;
      mouseState.vY *= decay;

      const arr = data;
      let peak = 0;
      for (let i = 0; i < size * size; i++) {
        let a = arr[i * 4] * decay;
        let b = arr[i * 4 + 1] * decay;
        peak = Math.max(peak, Math.abs(a), Math.abs(b));
        // Clamp absolute value — a runaway accumulation here is what
        // produces the dark-grid glitch the user reported.
        if (a > MAX_OFFSET) a = MAX_OFFSET;
        else if (a < -MAX_OFFSET) a = -MAX_OFFSET;
        if (b > MAX_OFFSET) b = MAX_OFFSET;
        else if (b < -MAX_OFFSET) b = -MAX_OFFSET;
        arr[i * 4] = a;
        arr[i * 4 + 1] = b;
      }

      // Idle: grid relaxed, cursor still, no crossfade — skip the
      // grid pass and the draw (the frame on screen is already right).
      const moving =
        Math.abs(mouseState.vX) > 1e-4 || Math.abs(mouseState.vY) > 1e-4;
      if (
        !moving &&
        peak < 1e-3 &&
        transitionRafRef.current === null &&
        !renderPendingRef.current
      ) {
        return;
      }
      renderPendingRef.current = false;

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

      grid32.needsUpdate = true;
      // Nothing to draw until the first photo is in (ogl can't bind
      // a null sampler); the loader re-arms renderPendingRef.
      if (!uniforms.uTexture.value) return;
      try {
        renderer.render({ scene: plane, camera });
      } catch {
        /* context lost mid-frame — the next frame retries */
      }
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

      // uTexture2 holds the same texture as uTexture between
      // transitions; only delete the in-flight incoming texture if
      // it differs (mid-transition unmount).
      const t1 = uniforms.uTexture.value;
      const t2 = uniforms.uTexture2.value;
      try {
        if (t1) gl.deleteTexture(t1.texture);
        if (t2 && t2 !== t1) gl.deleteTexture(t2.texture);
      } catch {
        /* context already gone */
      }
      teardownGL();
      uniformsRef.current = null;
      glRef.current = null;
      handleResizeRef.current = null;
    };
  }, [grid, mouse, strength, relaxation, dispIntensity]);

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
  // texture is moved to the primary slot and the old one is
  // disposed; if a fresh imageSrc arrives mid-transition we snap-
  // finish whatever was already in flight before kicking off the
  // next one (rare in practice — autoplay is 7 s, transition 1.2 s).
  useEffect(() => {
    const uniforms = uniformsRef.current;
    const gl = glRef.current;
    if (!uniforms || !gl) return;
    let disposed = false;
    const disposeTexture = (t: Texture) => {
      try {
        gl.deleteTexture(t.texture);
      } catch {
        /* context already gone */
      }
    };
    // What three's TextureLoader did: an <img> with crossOrigin
    // "anonymous" (a no-op for our same-origin /images, but keeps the
    // canvas untainted if photos ever move to a CDN).
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (disposed) return;
      // TextureLoader defaults + the filters the three version set:
      // flipY on (uv 0,0 = image bottom-left), linear, no mipmaps
      // (three skips them for a LinearFilter min), clamp, straight
      // alpha, raw RGB (no colour-space conversion, see above).
      // ogl uploads lazily on the first draw that binds it.
      const texture = new Texture(gl, {
        image: img,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
        generateMipmaps: false,
        flipY: true,
        premultiplyAlpha: false,
      });
      const aspect = img.naturalWidth / img.naturalHeight;

      // First load: no previous photo to fade from. Mirror the
      // texture into both slots so the shader's t2 sample is
      // valid before the first transition kicks in.
      if (!uniforms.uTexture.value) {
        uniforms.uTexture.value = texture;
        uniforms.uTexture2.value = texture;
        uniforms.uProgress.value = 0;
        imageAspectRef.current = aspect;
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
        const outer = uniforms.uTexture.value;
        if (outer && outer !== uniforms.uTexture2.value) {
          disposeTexture(outer);
        }
        uniforms.uTexture.value = uniforms.uTexture2.value;
        uniforms.uProgress.value = 0;
      }

      const previousCurrent = uniforms.uTexture.value;
      uniforms.uTexture2.value = texture;
      uniforms.uProgress.value = 0;
      imageAspectRef.current = aspect;
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
          renderPendingRef.current = true;
          if (previousCurrent && previousCurrent !== uniforms.uTexture.value) {
            disposeTexture(previousCurrent);
          }
        }
      };
      transitionRafRef.current = requestAnimationFrame(tick);
    };
    img.src = imageSrc;
    return () => {
      disposed = true;
      img.onload = null;
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
