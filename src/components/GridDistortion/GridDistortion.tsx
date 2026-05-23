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
   *  Uploaded directly to the GPU as an RGBA32F texture each frame
   *  via `dataTexture.needsUpdate = true`. */
  const dataArrRef = useRef<Float32Array | null>(null);
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
    // Zero-init: no displacement everywhere on first frame.
    const data = new Float32Array(4 * size * size);
    dataArrRef.current = data;

    // RGBA32F displacement texture (WebGL2 sized format). On WebGL1
    // ogl falls back to RGBA + FLOAT with OES_texture_float (auto-
    // enabled by the Renderer for WebGL1 contexts). NEAREST so each
    // cell reads exact, CLAMP_TO_EDGE so border cells don't wrap.
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
      if (disposed || !renderer || !dataArrRef.current) {
        return;
      }
      raf = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;

      const dt = Math.min((now - lastFrame) / 16.67, 30);
      lastFrame = now;
      const decay = Math.pow(relaxation, dt);

      // Single combined pass per cell: decay → mouse push → clamp →
      // store. Three.js had two passes (decay then mouse); we merge
      // them. With the float-texture path back the encoding pass is
      // gone too — the texture stores raw floats directly.
      const gridMouseX = size * mouseState.x;
      const gridMouseY = size * mouseState.y;
      const maxDist = size * mouse;
      const maxDistSq = maxDist * maxDist;
      const pushScale = strength * 100;
      const pushX = pushScale * mouseState.vX;
      const pushY = pushScale * mouseState.vY;

      for (let j = 0; j < size; j++) {
        const dyMouse = gridMouseY - j;
        const dyMouseSq = dyMouse * dyMouse;
        for (let i = 0; i < size; i++) {
          const idx = 4 * (i + size * j);
          let a = data[idx] * decay;
          let b = data[idx + 1] * decay;

          const dxMouse = gridMouseX - i;
          const distSq = dxMouse * dxMouse + dyMouseSq;
          if (distSq < maxDistSq) {
            // Math.sqrt is the only sqrt we pay for, and only inside
            // the mouse radius. For grid=18 with mouse=0.1 that's
            // ~1-2 cells per frame.
            const power = Math.min(maxDist / Math.sqrt(distSq), 10);
            a += pushX * power;
            b -= pushY * power;
          }

          if (a > MAX_OFFSET) a = MAX_OFFSET;
          else if (a < -MAX_OFFSET) a = -MAX_OFFSET;
          if (b > MAX_OFFSET) b = MAX_OFFSET;
          else if (b < -MAX_OFFSET) b = -MAX_OFFSET;
          data[idx] = a;
          data[idx + 1] = b;
        }
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
