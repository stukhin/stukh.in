"use client";

import { useEffect, useRef } from "react";
// Second attempt at ogl. The first attempt (commit a07b551, reverted
// in 748f3af) crashed Chrome's renderer on the home route. This
// version is more conservative: precision highp on BOTH shaders,
// RGBA8 displacement texture (not RGBA32F), try/catch around the
// render loop, LightRays-style cleanup.
import {
  Camera,
  Mesh,
  type OGLRenderingContext,
  Plane,
  Program,
  Renderer,
  Texture,
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

/** Encoding scale for the RGBA8 displacement texture.
 *  Displacement values live in roughly [-50, 50] (clamped by
 *  MAX_OFFSET below); the texture stores them as bytes with 128
 *  meaning "no displacement." Encoding: (v + 50) * 2.55 → [0, 255].
 *  Shader decodes via (sampled - 0.5) * 100.0. */
const DISP_RANGE = 50;
const DISP_SCALE = 255 / (DISP_RANGE * 2);

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
 * uniform's texture is reassigned.
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
  const glRef = useRef<OGLRenderingContext | null>(null);
  /** Float backing array for displacement values (in [-50, 50]).
   *  Each frame's decay + cursor-push math mutates this; the
   *  per-frame encode step copies it into `dataBytes` (uint8) for
   *  GPU upload. Keeping floats here means we don't lose precision
   *  across decay iterations. */
  const dataArrRef = useRef<Float32Array | null>(null);
  /** Uint8 bytes uploaded to the displacement texture. Re-encoded
   *  from `dataArr` each frame before texture.needsUpdate fires. */
  const dataBytesRef = useRef<Uint8Array | null>(null);
  const dataTextureRef = useRef<Texture | null>(null);
  const imageAspectRef = useRef(1);
  const handleResizeRef = useRef<(() => void) | null>(null);
  const transitionRafRef = useRef<number | null>(null);

  // Renderer / scene / loop. Re-runs only when grid params change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof window === "undefined") return;

    let renderer: Renderer | null = null;
    let raf = 0;
    let disposed = false;

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio, 2),
        powerPreference: "high-performance",
      });
    } catch (error) {
      console.warn("GridDistortion: Renderer init failed", error);
      return;
    }

    const gl = renderer.gl;
    glRef.current = gl;
    gl.clearColor(0, 0, 0, 0);
    container.innerHTML = "";
    container.appendChild(gl.canvas);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";

    const camera = new Camera(gl);
    camera.position.z = 2;

    const size = grid;
    // Zero-init the displacement state. 128 in encoded bytes = "no
    // displacement" (since (128/255 - 0.5) * 100 ≈ 0). Float backing
    // starts at literal 0.
    const data = new Float32Array(4 * size * size);
    const dataBytes = new Uint8Array(4 * size * size);
    dataBytes.fill(0);
    for (let i = 0; i < size * size; i++) {
      dataBytes[i * 4] = 128;
      dataBytes[i * 4 + 1] = 128;
      dataBytes[i * 4 + 2] = 128;
      dataBytes[i * 4 + 3] = 255;
    }
    dataArrRef.current = data;
    dataBytesRef.current = dataBytes;

    // RGBA8 displacement texture. NEAREST filtering so each cell
    // reads exact (no inter-cell blend), CLAMP_TO_EDGE so cells at
    // the texture border don't wrap.
    const dataTexture = new Texture(gl, {
      image: dataBytes,
      width: size,
      height: size,
      type: gl.UNSIGNED_BYTE,
      format: gl.RGBA,
      internalFormat: gl.RGBA,
      generateMipmaps: false,
      flipY: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
    dataTextureRef.current = dataTexture;

    // Placeholder image texture so the shader's sampler2D bindings
    // are valid before the first photo loads. ogl auto-uploads a
    // 1×1 white emptyPixel for textures without an `image`.
    const placeholder = new Texture(gl);

    const uniforms: GridDistortionUniforms = {
      time: { value: 0 },
      resolution: { value: new Vec4() },
      uTexture: { value: placeholder },
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
      cullFace: null,
    });

    const geometry = new Plane(gl, {
      width: 1,
      height: 1,
      widthSegments: size - 1,
      heightSegments: size - 1,
    });
    const plane = new Mesh(gl, { geometry, program });

    const handleResize = () => {
      if (!container || !renderer) return;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const containerAspect = width / height;
      renderer.setSize(width, height);

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
    const MAX_DELTA = 0.04;
    const MAX_OFFSET = 50;
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
      for (let i = 0; i < size * size; i++) {
        dataBytes[i * 4] = 128;
        dataBytes[i * 4 + 1] = 128;
        dataBytes[i * 4 + 2] = 128;
      }
      dataTexture.needsUpdate = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!container) return;
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

    const handleVisibility = () => {
      if (document.hidden) return;
      resetMouse();
      clearData();
    };
    const handleBlur = () => resetMouse();

    window.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    handleResize();

    let lastFrame = performance.now();
    const animate = (now: number) => {
      if (disposed || !renderer || !dataArrRef.current || !dataBytesRef.current) {
        return;
      }
      raf = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;

      const dt = Math.min((now - lastFrame) / 16.67, 30);
      lastFrame = now;
      const decay = Math.pow(relaxation, dt);

      // Decay floats with clamp.
      for (let i = 0; i < size * size; i++) {
        let a = data[i * 4] * decay;
        let b = data[i * 4 + 1] * decay;
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

      // Encode floats → uint8 with 128 centre. (v + DISP_RANGE) * scale,
      // clamped to [0, 255].
      for (let i = 0; i < size * size; i++) {
        const fx = data[i * 4];
        const fy = data[i * 4 + 1];
        let bx = (fx + DISP_RANGE) * DISP_SCALE;
        let by = (fy + DISP_RANGE) * DISP_SCALE;
        if (bx < 0) bx = 0;
        else if (bx > 255) bx = 255;
        if (by < 0) by = 0;
        else if (by > 255) by = 255;
        dataBytes[i * 4] = bx | 0;
        dataBytes[i * 4 + 1] = by | 0;
      }

      dataTexture.needsUpdate = true;
      try {
        renderer.render({ scene: plane, camera });
      } catch (error) {
        console.warn("GridDistortion: render error", error);
      }
    };
    animate(performance.now());

    return () => {
      disposed = true;
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
      // the WebGL context. Wrap in try/catch so a cleanup error
      // doesn't escape the effect and break React's re-mount path.
      try {
        const canvas = renderer?.gl.canvas;
        const loseCtx = renderer?.gl.getExtension("WEBGL_lose_context");
        loseCtx?.loseContext();
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      } catch (error) {
        console.warn("GridDistortion: cleanup error", error);
      }
      uniformsRef.current = null;
      dataArrRef.current = null;
      dataBytesRef.current = null;
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
  // shader's right-to-left noise reveal sweeps the new photo in.
  // ogl has no .dispose() — the previous texture is just released
  // to GC when its uniform reference is replaced.
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    let disposed = false;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (disposed) return;
      const gl = glRef.current;
      if (!gl) return;
      try {
        const texture = new Texture(gl, {
          image: img,
          generateMipmaps: false,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
        });
        texture.needsUpdate = true;

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
      } catch (error) {
        console.warn("GridDistortion: texture load error", error);
      }
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
