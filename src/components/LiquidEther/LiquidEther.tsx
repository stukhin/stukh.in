"use client";

/* Vendored from React Bits — fluid simulation rendered to a WebGL
 * canvas. We use it on /blog as the "liquid" inside a hovered
 * country: a single instance is mounted while hover is active and
 * clipped to the country's path via SVG <clipPath>. The simulation
 * is kept mostly verbatim so future upstream tweaks are easy to
 * follow; the GL layer is ported from three.js to ogl (already
 * shipped for LightRays / Grainient), which drops `three` from
 * /blog. Port notes:
 *  - ogl prepends nothing to shaders. The upstream sources were
 *    RawShaderMaterial already, so every attribute / uniform /
 *    varying is declared explicitly — keep it that way.
 *  - three state the port has to reproduce by hand: per-material
 *    blend funcs (non-premultiplied Normal / Additive), a
 *    premultiplied-alpha context, autoClear off, and the sRGB →
 *    linear conversion `new THREE.Color(hex)` applied to the palette.
 */

import { useEffect, useRef, type CSSProperties } from "react";
import {
  Geometry,
  Mesh,
  Plane,
  Program,
  Renderer,
  RenderTarget,
  Texture,
  Transform,
  Vec2,
  type OGLRenderingContext,
} from "ogl";
import "./LiquidEther.css";

type Props = {
  mouseForce?: number;
  cursorSize?: number;
  isViscous?: boolean;
  viscous?: number;
  iterationsViscous?: number;
  iterationsPoisson?: number;
  dt?: number;
  BFECC?: boolean;
  resolution?: number;
  isBounce?: boolean;
  colors?: string[];
  style?: CSSProperties;
  className?: string;
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  takeoverDuration?: number;
  autoResumeDelay?: number;
  autoRampDuration?: number;
};

// ---- Shader pass types ---------------------------------------------------

type UniformRecord = Record<string, { value: unknown }>;

type ShaderPassMaterialProps = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: UniformRecord;
};

type ShaderPassPropsBase = {
  material?: ShaderPassMaterialProps;
  output?: RenderTarget | null;
  output0?: RenderTarget;
  output1?: RenderTarget;
};

// Per-pass uniform shapes — narrows the `unknown` in UniformRecord at
// the few access sites that read .value back out for assignment.
type AdvectionUniforms = {
  boundarySpace: { value: Vec2 };
  px: { value: Vec2 };
  fboSize: { value: Vec2 };
  velocity: { value: Texture };
  dt: { value: number };
  isBFECC: { value: boolean };
};
type ExternalForceUniforms = {
  px: { value: Vec2 };
  force: { value: Vec2 };
  center: { value: Vec2 };
  scale: { value: Vec2 };
};
type ViscousUniforms = {
  boundarySpace: { value: Vec2 };
  velocity: { value: Texture };
  velocity_new: { value: Texture };
  v: { value: number };
  px: { value: Vec2 };
  dt: { value: number };
};
type DivergenceUniforms = {
  boundarySpace: { value: Vec2 };
  velocity: { value: Texture };
  px: { value: Vec2 };
  dt: { value: number };
};
type PoissonUniforms = {
  boundarySpace: { value: Vec2 };
  pressure: { value: Texture };
  divergence: { value: Texture };
  px: { value: Vec2 };
};
type PressureUniforms = {
  boundarySpace: { value: Vec2 };
  pressure: { value: Texture };
  velocity: { value: Texture };
  px: { value: Vec2 };
  dt: { value: number };
};

type SimProps = {
  cellScale: Vec2;
  fboSize: Vec2;
  dt: number;
  src: RenderTarget;
  dst: RenderTarget;
  dst_?: RenderTarget;
  src_p?: RenderTarget;
  src_v?: RenderTarget;
  cursor_size?: number;
  boundarySpace?: Vec2;
  viscous?: number;
};

type SimulationOptions = {
  iterations_poisson: number;
  iterations_viscous: number;
  mouse_force: number;
  resolution: number;
  cursor_size: number;
  viscous: number;
  isBounce: boolean;
  dt: number;
  isViscous: boolean;
  BFECC: boolean;
};

type SimulationFboKey =
  | "vel_0"
  | "vel_1"
  | "vel_viscous0"
  | "vel_viscous1"
  | "div"
  | "pressure_0"
  | "pressure_1";

type AutoDriverOpts = {
  enabled: boolean;
  speed: number;
  resumeDelay?: number;
  rampDuration?: number;
};

type WebGLManagerProps = {
  $wrapper: HTMLElement;
  simOptions: SimulationOptions;
  autoDemo: boolean;
  autoSpeed: number;
  autoIntensity: number;
  takeoverDuration: number;
  autoResumeDelay: number;
  autoRampDuration: number;
};

// GL enums WebGLRenderingContext doesn't type (WebGL2 core / WebGL1
// extension values) — `gl` is typed as the WebGL1 | WebGL2 union.
const GL_RGBA32F = 0x8814;
const GL_RGBA16F = 0x881a;
const GL_HALF_FLOAT = 0x140b;
const GL_HALF_FLOAT_OES = 0x8d61;

// three.js `SRGBToLinear` — what `new THREE.Color("#hex")` did to
// every palette stop under its default colour management. The palette
// texture is sampled raw and written straight to the canvas, so the
// upstream look depends on these linearised (darker) values.
const srgbToLinear = (c: number) =>
  c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);

// Any CSS colour → [r, g, b] in 0..1 sRGB. Normalised through a 2D
// context so names / rgb() keep working like THREE.Color's parser;
// anything unparseable falls back to white.
function parseCssColor(css: string): [number, number, number] {
  let hex = css;
  const ctx = document.createElement("canvas").getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = css;
    hex = String(ctx.fillStyle);
  }
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  return [
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255,
  ];
}

// ---- Component -----------------------------------------------------------

export default function LiquidEther({
  mouseForce = 20,
  cursorSize = 100,
  isViscous = false,
  viscous = 30,
  iterationsViscous = 32,
  iterationsPoisson = 32,
  dt = 0.014,
  BFECC = true,
  resolution = 0.5,
  isBounce = false,
  colors = ["#5227FF", "#FF9FFC", "#B497CF"],
  style = {},
  className = "",
  autoDemo = true,
  autoSpeed = 0.5,
  autoIntensity = 2.2,
  takeoverDuration = 0.25,
  autoResumeDelay = 1000,
  autoRampDuration = 0.6,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // WebGLManager / Output / Simulation are all defined inside the
  // useEffect closure so they can share the CommonClass / MouseClass
  // singletons there. The ref only needs the lifecycle surface.
  const webglRef = useRef<WebGLManagerLike | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const isVisibleRef = useRef(true);
  const resizeRafRef = useRef<number | null>(null);

  // Every prop is a dep, so a prop change tears the whole sim down
  // and rebuilds it with the new values — there is no separate
  // "apply options" path.
  useEffect(() => {
    if (!mountRef.current) return;

    // Every GL object the sim allocates, so teardown (normal dispose
    // and a constructor that throws halfway) can free them explicitly
    // instead of waiting on the context loss.
    const gpu = {
      programs: [] as Program[],
      geometries: [] as Geometry[],
      targets: [] as RenderTarget[],
      textures: [] as Texture[],
    };

    function makePaletteTexture(
      gl: OGLRenderingContext,
      stops: string[]
    ): Texture {
      let arr: string[];
      if (Array.isArray(stops) && stops.length > 0) {
        if (stops.length === 1) {
          arr = [stops[0], stops[0]];
        } else {
          arr = stops;
        }
      } else {
        arr = ["#ffffff", "#ffffff"];
      }
      const w = arr.length;
      const data = new Uint8Array(w * 4);
      for (let i = 0; i < w; i++) {
        const [r, g, b] = parseCssColor(arr[i]).map(srgbToLinear);
        data[i * 4 + 0] = Math.round(r * 255);
        data[i * 4 + 1] = Math.round(g * 255);
        data[i * 4 + 2] = Math.round(b * 255);
        data[i * 4 + 3] = 255;
      }
      const tex = new Texture(gl, {
        image: data,
        width: w,
        height: 1,
        magFilter: gl.LINEAR,
        minFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
        generateMipmaps: false,
        flipY: false,
      });
      gpu.textures.push(tex);
      return tex;
    }

    const bgVec4 = [0, 0, 0, 0];

    class CommonClass {
      width = 0;
      height = 0;
      aspect = 1;
      pixelRatio = 1;
      isMobile = false;
      breakpoint = 768;
      fboWidth: number | null = null;
      fboHeight: number | null = null;
      time = 0;
      delta = 0;
      container: HTMLElement | null = null;
      renderer: Renderer | null = null;
      gl: OGLRenderingContext | null = null;
      private lastTime = 0;

      init(container: HTMLElement) {
        this.container = container;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.resize();
        // three's WebGLRenderer defaults, made explicit: premultiplied
        // context (the colour pass writes rgb·a), no depth / stencil
        // (no pass ever tests them), no auto-clear (each pass covers
        // its whole target; the browser clears the canvas per frame).
        // ogl throws on the null context when WebGL is unavailable —
        // caught by the effect below.
        this.renderer = new Renderer({
          webgl: 2,
          antialias: false,
          alpha: true,
          premultipliedAlpha: true,
          depth: false,
          stencil: false,
          autoClear: false,
          dpr: this.pixelRatio,
        });
        this.gl = this.renderer.gl;
        this.gl.clearColor(0, 0, 0, 0);
        this.setRendererSize();
        this.lastTime = performance.now();
      }
      // ogl's setSize writes px into the canvas style — re-assert the
      // fluid fill the container expects.
      setRendererSize() {
        if (!this.renderer) return;
        this.renderer.setSize(this.width, this.height);
        const canvas = this.renderer.gl.canvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
      }
      resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.width = Math.max(1, Math.floor(rect.width));
        this.height = Math.max(1, Math.floor(rect.height));
        this.aspect = this.width / this.height;
        this.setRendererSize();
      }
      update() {
        const now = performance.now();
        this.delta = (now - this.lastTime) / 1000;
        this.lastTime = now;
        this.time += this.delta;
      }
    }
    const Common = new CommonClass();

    class MouseClass {
      mouseMoved = false;
      coords = new Vec2();
      coords_old = new Vec2();
      diff = new Vec2();
      timer: number | null = null;
      container: HTMLElement | null = null;
      docTarget: Document | null = null;
      listenerTarget: Window | null = null;
      isHoverInside = false;
      hasUserControl = false;
      isAutoActive = false;
      autoIntensity = 2.0;
      takeoverActive = false;
      takeoverStartTime = 0;
      takeoverDuration = 0.25;
      takeoverFrom = new Vec2();
      takeoverTo = new Vec2();
      onInteract: (() => void) | null = null;
      private readonly _onMouseMove: (event: MouseEvent) => void;
      private readonly _onTouchStart: (event: TouchEvent) => void;
      private readonly _onTouchMove: (event: TouchEvent) => void;
      private readonly _onTouchEnd: () => void;
      private readonly _onDocumentLeave: () => void;

      constructor() {
        this._onMouseMove = this.onDocumentMouseMove.bind(this);
        this._onTouchStart = this.onDocumentTouchStart.bind(this);
        this._onTouchMove = this.onDocumentTouchMove.bind(this);
        this._onTouchEnd = this.onTouchEnd.bind(this);
        this._onDocumentLeave = this.onDocumentLeave.bind(this);
      }
      init(container: HTMLElement) {
        this.container = container;
        this.docTarget = container.ownerDocument || null;
        const defaultView =
          (this.docTarget && this.docTarget.defaultView) ||
          (typeof window !== "undefined" ? window : null);
        if (!defaultView) return;
        this.listenerTarget = defaultView;
        this.listenerTarget.addEventListener("mousemove", this._onMouseMove);
        this.listenerTarget.addEventListener("touchstart", this._onTouchStart, {
          passive: true,
        });
        this.listenerTarget.addEventListener("touchmove", this._onTouchMove, {
          passive: true,
        });
        this.listenerTarget.addEventListener("touchend", this._onTouchEnd);
        if (this.docTarget) {
          this.docTarget.addEventListener("mouseleave", this._onDocumentLeave);
        }
      }
      // Safe to call more than once, and before / without init().
      dispose() {
        if (this.timer !== null) {
          window.clearTimeout(this.timer);
          this.timer = null;
        }
        this.onInteract = null;
        if (this.listenerTarget) {
          this.listenerTarget.removeEventListener(
            "mousemove",
            this._onMouseMove
          );
          this.listenerTarget.removeEventListener(
            "touchstart",
            this._onTouchStart
          );
          this.listenerTarget.removeEventListener(
            "touchmove",
            this._onTouchMove
          );
          this.listenerTarget.removeEventListener("touchend", this._onTouchEnd);
        }
        if (this.docTarget) {
          this.docTarget.removeEventListener(
            "mouseleave",
            this._onDocumentLeave
          );
        }
        this.listenerTarget = null;
        this.docTarget = null;
        this.container = null;
      }
      isPointInside(clientX: number, clientY: number): boolean {
        if (!this.container) return false;
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      }
      updateHoverState(clientX: number, clientY: number): boolean {
        this.isHoverInside = this.isPointInside(clientX, clientY);
        return this.isHoverInside;
      }
      setCoords(x: number, y: number) {
        if (!this.container) return;
        if (this.timer !== null) window.clearTimeout(this.timer);
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const nx = (x - rect.left) / rect.width;
        const ny = (y - rect.top) / rect.height;
        this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
        this.mouseMoved = true;
        this.timer = window.setTimeout(() => {
          this.mouseMoved = false;
        }, 100);
      }
      setNormalized(nx: number, ny: number) {
        this.coords.set(nx, ny);
        this.mouseMoved = true;
      }
      onDocumentMouseMove(event: MouseEvent) {
        if (!this.updateHoverState(event.clientX, event.clientY)) return;
        if (this.onInteract) this.onInteract();
        if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
          if (!this.container) return;
          const rect = this.container.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const nx = (event.clientX - rect.left) / rect.width;
          const ny = (event.clientY - rect.top) / rect.height;
          this.takeoverFrom.copy(this.coords);
          this.takeoverTo.set(nx * 2 - 1, -(ny * 2 - 1));
          this.takeoverStartTime = performance.now();
          this.takeoverActive = true;
          this.hasUserControl = true;
          this.isAutoActive = false;
          return;
        }
        this.setCoords(event.clientX, event.clientY);
        this.hasUserControl = true;
      }
      onDocumentTouchStart(event: TouchEvent) {
        if (event.touches.length !== 1) return;
        const t = event.touches[0];
        if (!this.updateHoverState(t.clientX, t.clientY)) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
        this.hasUserControl = true;
      }
      onDocumentTouchMove(event: TouchEvent) {
        if (event.touches.length !== 1) return;
        const t = event.touches[0];
        if (!this.updateHoverState(t.clientX, t.clientY)) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
      }
      onTouchEnd() {
        this.isHoverInside = false;
      }
      onDocumentLeave() {
        this.isHoverInside = false;
      }
      update() {
        if (this.takeoverActive) {
          const t =
            (performance.now() - this.takeoverStartTime) /
            (this.takeoverDuration * 1000);
          if (t >= 1) {
            this.takeoverActive = false;
            this.coords.copy(this.takeoverTo);
            this.coords_old.copy(this.coords);
            this.diff.set(0, 0);
          } else {
            const k = t * t * (3 - 2 * t);
            this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
          }
        }
        this.diff.sub(this.coords, this.coords_old);
        this.coords_old.copy(this.coords);
        if (this.coords_old.x === 0 && this.coords_old.y === 0)
          this.diff.set(0, 0);
        if (this.isAutoActive && !this.takeoverActive)
          this.diff.scale(this.autoIntensity);
      }
    }
    const Mouse = new MouseClass();

    type AutoDriverManager = { lastUserInteraction: number };

    class AutoDriver {
      mouse: MouseClass;
      manager: AutoDriverManager;
      enabled: boolean;
      speed: number;
      resumeDelay: number;
      rampDurationMs: number;
      active = false;
      current = new Vec2(0, 0);
      target = new Vec2();
      lastTime = performance.now();
      activationTime = 0;
      margin = 0.2;
      private _tmpDir = new Vec2();

      constructor(
        mouse: MouseClass,
        manager: AutoDriverManager,
        opts: AutoDriverOpts
      ) {
        this.mouse = mouse;
        this.manager = manager;
        this.enabled = opts.enabled;
        this.speed = opts.speed;
        this.resumeDelay = opts.resumeDelay ?? 3000;
        this.rampDurationMs = (opts.rampDuration ?? 0) * 1000;
        this.pickNewTarget();
      }
      pickNewTarget() {
        const r = Math.random;
        this.target.set(
          (r() * 2 - 1) * (1 - this.margin),
          (r() * 2 - 1) * (1 - this.margin)
        );
      }
      forceStop() {
        this.active = false;
        this.mouse.isAutoActive = false;
      }
      update() {
        if (!this.enabled) return;
        const now = performance.now();
        const idle = now - this.manager.lastUserInteraction;
        if (idle < this.resumeDelay) {
          if (this.active) this.forceStop();
          return;
        }
        if (this.mouse.isHoverInside) {
          if (this.active) this.forceStop();
          return;
        }
        if (!this.active) {
          this.active = true;
          this.current.copy(this.mouse.coords);
          this.lastTime = now;
          this.activationTime = now;
        }
        if (!this.active) return;
        this.mouse.isAutoActive = true;
        let dtSec = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dtSec > 0.2) dtSec = 0.016;
        const dir = this._tmpDir.sub(this.target, this.current);
        const dist = dir.len();
        if (dist < 0.01) {
          this.pickNewTarget();
          return;
        }
        dir.normalize();
        let ramp = 1;
        if (this.rampDurationMs > 0) {
          const t = Math.min(
            1,
            (now - this.activationTime) / this.rampDurationMs
          );
          ramp = t * t * (3 - 2 * t);
        }
        const step = this.speed * dtSec * ramp;
        const move = Math.min(step, dist);
        this.current.x += dir.x * move;
        this.current.y += dir.y * move;
        this.mouse.setNormalized(this.current.x, this.current.y);
      }
    }

    // ---- Shaders ----
    // GLSL ES 1.00, exactly what three compiled from the upstream
    // RawShaderMaterials (no preamble either way). Only change:
    // pressure_frag's local `step` (shadowed the builtin) → `offs`.

    const face_vert = `
  attribute vec3 position;
  uniform vec2 px;
  uniform vec2 boundarySpace;
  varying vec2 uv;
  precision highp float;
  void main(){
  vec3 pos = position;
  vec2 scale = 1.0 - boundarySpace * 2.0;
  pos.xy = pos.xy * scale;
  uv = vec2(0.5)+(pos.xy)*0.5;
  gl_Position = vec4(pos, 1.0);
}
`;
    const line_vert = `
  attribute vec3 position;
  uniform vec2 px;
  precision highp float;
  varying vec2 uv;
  void main(){
  vec3 pos = position;
  uv = 0.5 + pos.xy * 0.5;
  vec2 n = sign(pos.xy);
  pos.xy = abs(pos.xy) - px * 1.0;
  pos.xy *= n;
  gl_Position = vec4(pos, 1.0);
}
`;
    const mouse_vert = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
    vec2 pos = position.xy * scale * 2.0 * px + center;
    vUv = uv;
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;
    const advection_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform bool isBFECC;
    uniform vec2 fboSize;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
    vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
    if(isBFECC == false){
        vec2 vel = texture2D(velocity, uv).xy;
        vec2 uv2 = uv - vel * dt * ratio;
        vec2 newVel = texture2D(velocity, uv2).xy;
        gl_FragColor = vec4(newVel, 0.0, 0.0);
    } else {
        vec2 spot_new = uv;
        vec2 vel_old = texture2D(velocity, uv).xy;
        vec2 spot_old = spot_new - vel_old * dt * ratio;
        vec2 vel_new1 = texture2D(velocity, spot_old).xy;
        vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
        vec2 error = spot_new2 - spot_new;
        vec2 spot_new3 = spot_new - error / 2.0;
        vec2 vel_2 = texture2D(velocity, spot_new3).xy;
        vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
        vec2 newVel2 = texture2D(velocity, spot_old2).xy;
        gl_FragColor = vec4(newVel2, 0.0, 0.0);
    }
}
`;
    const color_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D palette;
    uniform vec4 bgColor;
    varying vec2 uv;
    void main(){
    vec2 vel = texture2D(velocity, uv).xy;
    float lenv = clamp(length(vel), 0.0, 1.0);
    vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb;
    vec3 outRGB = mix(bgColor.rgb, c, lenv);
    float outA = mix(bgColor.a, 1.0, lenv);
    gl_FragColor = vec4(outRGB, outA);
}
`;
    const divergence_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
    float x0 = texture2D(velocity, uv-vec2(px.x, 0.0)).x;
    float x1 = texture2D(velocity, uv+vec2(px.x, 0.0)).x;
    float y0 = texture2D(velocity, uv-vec2(0.0, px.y)).y;
    float y1 = texture2D(velocity, uv+vec2(0.0, px.y)).y;
    float divergence = (x1 - x0 + y1 - y0) / 2.0;
    gl_FragColor = vec4(divergence / dt);
}
`;
    const externalForce_frag = `
    precision highp float;
    uniform vec2 force;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
    vec2 circle = (vUv - 0.5) * 2.0;
    float d = 1.0 - min(length(circle), 1.0);
    d *= d;
    gl_FragColor = vec4(force * d, 0.0, 1.0);
}
`;
    const poisson_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D divergence;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
    float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
    float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
    float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
    float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
    float div = texture2D(divergence, uv).r;
    float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
    gl_FragColor = vec4(newP);
}
`;
    const pressure_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D velocity;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
    float offs = 1.0;
    float p0 = texture2D(pressure, uv + vec2(px.x * offs, 0.0)).r;
    float p1 = texture2D(pressure, uv - vec2(px.x * offs, 0.0)).r;
    float p2 = texture2D(pressure, uv + vec2(0.0, px.y * offs)).r;
    float p3 = texture2D(pressure, uv - vec2(0.0, px.y * offs)).r;
    vec2 v = texture2D(velocity, uv).xy;
    vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
    v = v - gradP * dt;
    gl_FragColor = vec4(v, 0.0, 1.0);
}
`;
    const viscous_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D velocity_new;
    uniform float v;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
    vec2 old = texture2D(velocity, uv).xy;
    vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy;
    vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy;
    vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy;
    vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy;
    vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
    newv /= 4.0 * (1.0 + v * dt);
    gl_FragColor = vec4(newv, 0.0, 0.0);
}
`;

    // ---- GL helpers ----

    function requireGL(): OGLRenderingContext {
      if (!Common.gl) throw new Error("LiquidEther: no GL context");
      return Common.gl;
    }

    // Program with three's RawShaderMaterial defaults minus the depth
    // test (there is no depth buffer). Culling stays off: every quad
    // here is screen-aligned, so three's back-face cull never culled
    // anything — disabling it just removes a winding dependency.
    function makeProgram(
      vertex: string,
      fragment: string,
      uniforms: UniformRecord
    ): Program {
      const gl = requireGL();
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms,
        cullFace: false,
        depthTest: false,
        depthWrite: false,
      });
      gpu.programs.push(program);
      // ogl only console.warns on a failed link — fail loudly so the
      // effect's catch skips the fluid rather than drawing with an
      // invalid program every frame.
      if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
        throw new Error("LiquidEther: shader program failed to link");
      }
      return program;
    }

    function makePlane(width: number, height: number): Plane {
      const geometry = new Plane(requireGL(), { width, height });
      gpu.geometries.push(geometry);
      return geometry;
    }

    // ---- ShaderPass + subclasses ----

    class ShaderPass<TUniforms extends UniformRecord = UniformRecord> {
      props: ShaderPassPropsBase;
      uniforms: TUniforms | undefined;
      scene: Transform | null = null;
      program: Program | null = null;
      plane: Mesh | null = null;

      constructor(props: ShaderPassPropsBase) {
        this.props = props || {};
        this.uniforms = (this.props.material?.uniforms as TUniforms) ?? undefined;
      }
      init() {
        this.scene = new Transform();
        if (this.uniforms && this.props.material) {
          this.program = makeProgram(
            this.props.material.vertexShader,
            this.props.material.fragmentShader,
            this.props.material.uniforms
          );
          this.plane = new Mesh(requireGL(), {
            geometry: makePlane(2.0, 2.0),
            program: this.program,
          });
          this.plane.setParent(this.scene);
        }
      }
      // Optional `unknown` arg so subclasses can override with their
      // own required-arg signature — TS method variance forbids
      // tightening a base no-arg signature into a required arg.
      update(_args?: unknown) {
        if (!Common.renderer || !this.scene) return;
        // Scene order = draw order (three sorted the same meshes by
        // material id, i.e. creation order). No camera: every vertex
        // shader writes clip space directly.
        Common.renderer.render({
          scene: this.scene,
          target: this.props.output ?? undefined,
          sort: false,
          frustumCull: false,
        });
      }
    }

    class Advection extends ShaderPass<AdvectionUniforms> {
      line: Mesh | null = null;
      constructor(simProps: SimProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: advection_frag,
            uniforms: {
              boundarySpace: { value: simProps.cellScale },
              px: { value: simProps.cellScale },
              fboSize: { value: simProps.fboSize },
              velocity: { value: simProps.src.texture },
              dt: { value: simProps.dt },
              isBFECC: { value: true },
            },
          },
          output: simProps.dst,
        });
        this.uniforms = this.props.material!.uniforms as AdvectionUniforms;
        this.init();
      }
      init() {
        super.init();
        this.createBoundary();
      }
      createBoundary() {
        if (!this.scene || !this.uniforms) return;
        const gl = requireGL();
        const vertices_boundary = new Float32Array([
          -1, -1, 0, -1, 1, 0, -1, 1, 0, 1, 1, 0, 1, 1, 0, 1, -1, 0, 1, -1, 0,
          -1, -1, 0,
        ]);
        const boundaryG = new Geometry(gl, {
          position: { size: 3, data: vertices_boundary },
        });
        gpu.geometries.push(boundaryG);
        // Shares the plane's uniform object, as upstream did.
        const boundaryM = makeProgram(
          line_vert,
          advection_frag,
          this.uniforms as unknown as UniformRecord
        );
        this.line = new Mesh(gl, {
          geometry: boundaryG,
          program: boundaryM,
          mode: gl.LINES,
        });
        this.line.setParent(this.scene);
      }
      update({
        dt,
        isBounce,
        BFECC,
      }: {
        dt: number;
        isBounce: boolean;
        BFECC: boolean;
      }) {
        if (!this.uniforms || !this.line) return;
        this.uniforms.dt.value = dt;
        this.line.visible = isBounce;
        this.uniforms.isBFECC.value = BFECC;
        super.update();
      }
    }

    class ExternalForce extends ShaderPass<ExternalForceUniforms> {
      mouse: Mesh | null = null;
      mouseUniforms: ExternalForceUniforms | null = null;
      constructor(simProps: SimProps) {
        super({ output: simProps.dst });
        this.init(simProps);
      }
      init(simProps?: SimProps) {
        super.init();
        if (!this.scene || !simProps) return;
        const gl = requireGL();
        this.mouseUniforms = {
          px: { value: simProps.cellScale },
          force: { value: new Vec2(0.0, 0.0) },
          center: { value: new Vec2(0.0, 0.0) },
          scale: {
            value: new Vec2(
              simProps.cursor_size ?? 0,
              simProps.cursor_size ?? 0
            ),
          },
        };
        const mouseM = makeProgram(
          mouse_vert,
          externalForce_frag,
          this.mouseUniforms
        );
        // three's AdditiveBlending on a non-premultiplied material.
        mouseM.setBlendFunc(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
        this.mouse = new Mesh(gl, {
          geometry: makePlane(1, 1),
          program: mouseM,
        });
        this.mouse.setParent(this.scene);
      }
      update(props: {
        cursor_size: number;
        mouse_force: number;
        cellScale: Vec2;
      }) {
        if (!this.mouse || !this.mouseUniforms) return;
        const forceX = (Mouse.diff.x / 2) * props.mouse_force;
        const forceY = (Mouse.diff.y / 2) * props.mouse_force;
        const cursorSizeX = props.cursor_size * props.cellScale.x;
        const cursorSizeY = props.cursor_size * props.cellScale.y;
        const centerX = Math.min(
          Math.max(Mouse.coords.x, -1 + cursorSizeX + props.cellScale.x * 2),
          1 - cursorSizeX - props.cellScale.x * 2
        );
        const centerY = Math.min(
          Math.max(Mouse.coords.y, -1 + cursorSizeY + props.cellScale.y * 2),
          1 - cursorSizeY - props.cellScale.y * 2
        );
        const uniforms = this.mouseUniforms;
        uniforms.force.value.set(forceX, forceY);
        uniforms.center.value.set(centerX, centerY);
        uniforms.scale.value.set(props.cursor_size, props.cursor_size);
        super.update();
      }
    }

    class Viscous extends ShaderPass<ViscousUniforms> {
      constructor(simProps: SimProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: viscous_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace! },
              velocity: { value: simProps.src.texture },
              velocity_new: { value: simProps.dst_!.texture },
              v: { value: simProps.viscous! },
              px: { value: simProps.cellScale },
              dt: { value: simProps.dt },
            },
          },
          output: simProps.dst,
          output0: simProps.dst_,
          output1: simProps.dst,
        });
        this.uniforms = this.props.material!.uniforms as ViscousUniforms;
        this.init();
      }
      update({
        viscous,
        iterations,
        dt,
      }: {
        viscous: number;
        iterations: number;
        dt: number;
      }): RenderTarget | undefined {
        if (!this.uniforms) return undefined;
        let fbo_in: RenderTarget | undefined;
        let fbo_out: RenderTarget | undefined;
        this.uniforms.v.value = viscous;
        for (let i = 0; i < iterations; i++) {
          if (i % 2 === 0) {
            fbo_in = this.props.output0;
            fbo_out = this.props.output1;
          } else {
            fbo_in = this.props.output1;
            fbo_out = this.props.output0;
          }
          if (fbo_in) this.uniforms.velocity_new.value = fbo_in.texture;
          this.props.output = fbo_out;
          this.uniforms.dt.value = dt;
          super.update();
        }
        return fbo_out;
      }
    }

    class Divergence extends ShaderPass<DivergenceUniforms> {
      constructor(simProps: SimProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: divergence_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace! },
              velocity: { value: simProps.src.texture },
              px: { value: simProps.cellScale },
              dt: { value: simProps.dt },
            },
          },
          output: simProps.dst,
        });
        this.uniforms = this.props.material!.uniforms as DivergenceUniforms;
        this.init();
      }
      update({ vel }: { vel: RenderTarget }) {
        if (!this.uniforms) return;
        this.uniforms.velocity.value = vel.texture;
        super.update();
      }
    }

    class Poisson extends ShaderPass<PoissonUniforms> {
      constructor(simProps: SimProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: poisson_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace! },
              pressure: { value: simProps.dst_!.texture },
              divergence: { value: simProps.src.texture },
              px: { value: simProps.cellScale },
            },
          },
          output: simProps.dst,
          output0: simProps.dst_,
          output1: simProps.dst,
        });
        this.uniforms = this.props.material!.uniforms as PoissonUniforms;
        this.init();
      }
      update({
        iterations,
      }: {
        iterations: number;
      }): RenderTarget | undefined {
        if (!this.uniforms) return undefined;
        let p_in: RenderTarget | undefined;
        let p_out: RenderTarget | undefined;
        for (let i = 0; i < iterations; i++) {
          if (i % 2 === 0) {
            p_in = this.props.output0;
            p_out = this.props.output1;
          } else {
            p_in = this.props.output1;
            p_out = this.props.output0;
          }
          if (p_in) this.uniforms.pressure.value = p_in.texture;
          this.props.output = p_out;
          super.update();
        }
        return p_out;
      }
    }

    class Pressure extends ShaderPass<PressureUniforms> {
      constructor(simProps: SimProps) {
        super({
          material: {
            vertexShader: face_vert,
            fragmentShader: pressure_frag,
            uniforms: {
              boundarySpace: { value: simProps.boundarySpace! },
              pressure: { value: simProps.src_p!.texture },
              velocity: { value: simProps.src_v!.texture },
              px: { value: simProps.cellScale },
              dt: { value: simProps.dt },
            },
          },
          output: simProps.dst,
        });
        this.uniforms = this.props.material!.uniforms as PressureUniforms;
        this.init();
      }
      update({
        vel,
        pressure,
      }: {
        vel: RenderTarget;
        pressure: RenderTarget;
      }) {
        if (!this.uniforms) return;
        this.uniforms.velocity.value = vel.texture;
        this.uniforms.pressure.value = pressure.texture;
        super.update();
      }
    }

    class Simulation {
      options: SimulationOptions;
      fbos: Record<SimulationFboKey, RenderTarget | null>;
      fboSize = new Vec2();
      cellScale = new Vec2();
      boundarySpace = new Vec2();
      advection!: Advection;
      externalForce!: ExternalForce;
      viscous!: Viscous;
      divergence!: Divergence;
      poisson!: Poisson;
      pressure!: Pressure;

      constructor(options?: Partial<SimulationOptions>) {
        this.options = {
          iterations_poisson: 32,
          iterations_viscous: 32,
          mouse_force: 20,
          resolution: 0.5,
          cursor_size: 100,
          viscous: 30,
          isBounce: false,
          dt: 0.014,
          isViscous: false,
          BFECC: true,
          ...(options ?? {}),
        };
        this.fbos = {
          vel_0: null,
          vel_1: null,
          vel_viscous0: null,
          vel_viscous1: null,
          div: null,
          pressure_0: null,
          pressure_1: null,
        };
        this.init();
      }
      init() {
        this.calcSize();
        this.createAllFBO();
        this.createShaderPass();
      }
      // Upstream: FLOAT everywhere, HALF_FLOAT on iOS (no linear
      // filtering of 32F there). Same rule, plus the capability
      // check three skipped: 32F also needs linear filtering and
      // blending (the external-force pass blends additively).
      // ogl's Renderer already requested EXT_color_buffer_float /
      // OES_texture_float(_linear) / OES_texture_half_float.
      getFloatFormat(gl: OGLRenderingContext, preferFull: boolean) {
        const isWebgl2 = !!Common.renderer?.isWebgl2;
        const isIOS = /(iPad|iPhone|iPod)/i.test(navigator.userAgent);
        const full =
          preferFull &&
          !isIOS &&
          !!gl.getExtension("OES_texture_float_linear") &&
          (!isWebgl2 || !!gl.getExtension("EXT_float_blend"));
        if (isWebgl2) {
          return full
            ? { type: gl.FLOAT, internalFormat: GL_RGBA32F }
            : { type: GL_HALF_FLOAT, internalFormat: GL_RGBA16F };
        }
        return full
          ? { type: gl.FLOAT, internalFormat: gl.RGBA }
          : { type: GL_HALF_FLOAT_OES, internalFormat: gl.RGBA };
      }
      makeTarget(gl: OGLRenderingContext, preferFull: boolean): RenderTarget {
        const { type, internalFormat } = this.getFloatFormat(gl, preferFull);
        const target = new RenderTarget(gl, {
          width: this.fboSize.x,
          height: this.fboSize.y,
          type,
          format: gl.RGBA,
          internalFormat,
          depth: false,
          stencil: false,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
        });
        gpu.targets.push(target);
        return target;
      }
      isComplete(gl: OGLRenderingContext, target: RenderTarget): boolean {
        Common.renderer!.bindFramebuffer(target);
        const ok =
          gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        Common.renderer!.bindFramebuffer();
        return ok;
      }
      createAllFBO() {
        const gl = requireGL();
        // Probe the first target: if the driver can't render to 32F,
        // fall back to half float; if neither works, throw so the
        // effect skips the fluid.
        let preferFull = true;
        let probe = this.makeTarget(gl, preferFull);
        if (!this.isComplete(gl, probe)) {
          preferFull = false;
          gl.deleteTexture(probe.texture.texture);
          gl.deleteFramebuffer(probe.buffer);
          gpu.targets.pop();
          probe = this.makeTarget(gl, preferFull);
          if (!this.isComplete(gl, probe)) {
            throw new Error("LiquidEther: float render targets unsupported");
          }
        }
        (Object.keys(this.fbos) as SimulationFboKey[]).forEach((key, i) => {
          this.fbos[key] = i === 0 ? probe : this.makeTarget(gl, preferFull);
        });
      }
      createShaderPass() {
        this.advection = new Advection({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          dt: this.options.dt,
          src: this.fbos.vel_0!,
          dst: this.fbos.vel_1!,
        });
        this.externalForce = new ExternalForce({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          dt: this.options.dt,
          src: this.fbos.vel_0!,
          dst: this.fbos.vel_1!,
          cursor_size: this.options.cursor_size,
        });
        this.viscous = new Viscous({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          boundarySpace: this.boundarySpace,
          viscous: this.options.viscous,
          src: this.fbos.vel_1!,
          dst: this.fbos.vel_viscous1!,
          dst_: this.fbos.vel_viscous0!,
          dt: this.options.dt,
        });
        this.divergence = new Divergence({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          boundarySpace: this.boundarySpace,
          src: this.fbos.vel_viscous0!,
          dst: this.fbos.div!,
          dt: this.options.dt,
        });
        this.poisson = new Poisson({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          boundarySpace: this.boundarySpace,
          src: this.fbos.div!,
          dst: this.fbos.pressure_1!,
          dst_: this.fbos.pressure_0!,
          dt: this.options.dt,
        });
        this.pressure = new Pressure({
          cellScale: this.cellScale,
          fboSize: this.fboSize,
          boundarySpace: this.boundarySpace,
          src_p: this.fbos.pressure_0!,
          src_v: this.fbos.vel_viscous0!,
          src: this.fbos.vel_viscous0!,
          dst: this.fbos.vel_0!,
          dt: this.options.dt,
        });
      }
      calcSize() {
        const width = Math.max(
          1,
          Math.round(this.options.resolution * Common.width)
        );
        const height = Math.max(
          1,
          Math.round(this.options.resolution * Common.height)
        );
        const px_x = 1.0 / width;
        const px_y = 1.0 / height;
        this.cellScale.set(px_x, px_y);
        this.fboSize.set(width, height);
      }
      resize() {
        this.calcSize();
        (Object.keys(this.fbos) as SimulationFboKey[]).forEach((key) => {
          this.fbos[key]?.setSize(this.fboSize.x, this.fboSize.y);
        });
      }
      update() {
        if (this.options.isBounce) {
          this.boundarySpace.set(0, 0);
        } else {
          this.boundarySpace.copy(this.cellScale);
        }
        this.advection.update({
          dt: this.options.dt,
          isBounce: this.options.isBounce,
          BFECC: this.options.BFECC,
        });
        this.externalForce.update({
          cursor_size: this.options.cursor_size,
          mouse_force: this.options.mouse_force,
          cellScale: this.cellScale,
        });
        let vel: RenderTarget = this.fbos.vel_1!;
        if (this.options.isViscous) {
          const viscousResult = this.viscous.update({
            viscous: this.options.viscous,
            iterations: this.options.iterations_viscous,
            dt: this.options.dt,
          });
          if (viscousResult) vel = viscousResult;
        }
        this.divergence.update({ vel });
        const pressure = this.poisson.update({
          iterations: this.options.iterations_poisson,
        });
        if (pressure) this.pressure.update({ vel, pressure });
      }
    }

    class Output {
      simulation: Simulation;
      scene: Transform;
      output: Mesh;

      constructor(options: SimulationOptions) {
        const gl = requireGL();
        this.simulation = new Simulation(options);
        this.scene = new Transform();
        const program = makeProgram(face_vert, color_frag, {
          velocity: { value: this.simulation.fbos.vel_0!.texture },
          boundarySpace: { value: new Vec2() },
          palette: { value: makePaletteTexture(gl, colors) },
          bgColor: { value: bgVec4 },
        });
        // three's NormalBlending on a transparent, non-premultiplied
        // material (ogl's own default would be premultiplied here).
        program.setBlendFunc(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA
        );
        this.output = new Mesh(gl, { geometry: makePlane(2, 2), program });
        this.output.setParent(this.scene);
      }
      resize() {
        this.simulation.resize();
      }
      render() {
        if (!Common.renderer) return;
        Common.renderer.render({
          scene: this.scene,
          sort: false,
          frustumCull: false,
        });
      }
      update() {
        this.simulation.update();
        this.render();
      }
    }

    // Free everything the sim allocated, detach the canvas and drop
    // the context. Idempotent, and safe at any point of construction —
    // the failed-init path below relies on that.
    function teardownGL() {
      Mouse.dispose();
      const gl = Common.gl;
      if (gl) {
        try {
          gpu.programs.forEach((p) => {
            gl.deleteShader(p.vertexShader);
            gl.deleteShader(p.fragmentShader);
            p.remove();
          });
          gpu.geometries.forEach((g) => g.remove());
          gpu.targets.forEach((t) => {
            t.textures.forEach((tex) => gl.deleteTexture(tex.texture));
            gl.deleteFramebuffer(t.buffer);
          });
          gpu.textures.forEach((tex) => gl.deleteTexture(tex.texture));
          const canvas = gl.canvas;
          if (canvas && canvas.parentNode)
            canvas.parentNode.removeChild(canvas);
          // ogl has no forceContextLoss — release the context now
          // rather than whenever GC gets to it.
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          /* canvas already torn down */
        }
      }
      gpu.programs.length = 0;
      gpu.geometries.length = 0;
      gpu.targets.length = 0;
      gpu.textures.length = 0;
      Common.gl = null;
      Common.renderer = null;
    }

    class WebGLManager implements WebGLManagerLike {
      props: WebGLManagerProps;
      lastUserInteraction: number;
      autoDriver: AutoDriver;
      output?: Output;
      running = false;
      private readonly _loop: () => void;
      private readonly _resize: () => void;
      private readonly _onVisibility: () => void;

      constructor(props: WebGLManagerProps) {
        this.props = props;
        Common.init(props.$wrapper);
        Mouse.init(props.$wrapper);
        Mouse.autoIntensity = props.autoIntensity;
        Mouse.takeoverDuration = props.takeoverDuration;
        this.lastUserInteraction = performance.now();
        Mouse.onInteract = () => {
          this.lastUserInteraction = performance.now();
          if (this.autoDriver) this.autoDriver.forceStop();
        };
        this.autoDriver = new AutoDriver(Mouse, this, {
          enabled: props.autoDemo,
          speed: props.autoSpeed,
          resumeDelay: props.autoResumeDelay,
          rampDuration: props.autoRampDuration,
        });
        this.init();
        // Window / document listeners go on last: nothing after this
        // point can throw, so the failed-init path never has to
        // unhook them.
        this._loop = this.loop.bind(this);
        this._resize = this.resize.bind(this);
        window.addEventListener("resize", this._resize);
        this._onVisibility = () => {
          const hidden = document.hidden;
          if (hidden) {
            this.pause();
          } else if (isVisibleRef.current) {
            this.start();
          }
        };
        document.addEventListener("visibilitychange", this._onVisibility);
      }
      init() {
        if (Common.gl) {
          this.props.$wrapper.prepend(Common.gl.canvas);
        }
        this.output = new Output(this.props.simOptions);
      }
      resize() {
        Common.resize();
        this.output?.resize();
      }
      render() {
        if (this.autoDriver) this.autoDriver.update();
        Mouse.update();
        Common.update();
        this.output?.update();
      }
      loop() {
        if (!this.running) return;
        // A GL error mid-frame (lost context, bad state) stops the
        // loop instead of throwing out of rAF every frame.
        try {
          this.render();
        } catch (error) {
          console.warn("LiquidEther rendering error:", error);
          this.pause();
          return;
        }
        rafRef.current = requestAnimationFrame(this._loop);
      }
      start() {
        if (this.running) return;
        this.running = true;
        this._loop();
      }
      pause() {
        this.running = false;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
      dispose() {
        this.pause();
        window.removeEventListener("resize", this._resize);
        document.removeEventListener("visibilitychange", this._onVisibility);
        teardownGL();
        this.output = undefined;
      }
    }

    const container = mountRef.current;
    container.style.position = container.style.position || "relative";
    container.style.overflow = container.style.overflow || "hidden";

    let webgl: WebGLManager;
    try {
      webgl = new WebGLManager({
        $wrapper: container,
        simOptions: {
          mouse_force: mouseForce,
          cursor_size: cursorSize,
          isViscous,
          viscous,
          iterations_viscous: iterationsViscous,
          iterations_poisson: iterationsPoisson,
          dt,
          BFECC,
          resolution,
          isBounce,
        },
        autoDemo,
        autoSpeed,
        autoIntensity,
        takeoverDuration,
        autoResumeDelay,
        autoRampDuration,
      });
    } catch (error) {
      // No WebGL context (disabled / blocklisted GPU — ogl throws on
      // the null context), no float render targets, or a shader that
      // failed to link. Undo whatever got built — mouse listeners,
      // the prepended canvas, GL objects — and skip the fluid; the
      // country's hover fill still shows.
      console.warn("LiquidEther disabled:", error);
      teardownGL();
      return;
    }
    webglRef.current = webgl;

    webgl.start();

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isVisible = entry.isIntersecting && entry.intersectionRatio > 0;
        isVisibleRef.current = isVisible;
        if (!webglRef.current) return;
        if (isVisible && !document.hidden) {
          webglRef.current.start();
        } else {
          webglRef.current.pause();
        }
      },
      { threshold: [0, 0.01, 0.1] }
    );
    io.observe(container);
    intersectionObserverRef.current = io;

    const ro = new ResizeObserver(() => {
      if (!webglRef.current) return;
      if (resizeRafRef.current !== null)
        cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        if (!webglRef.current) return;
        webglRef.current.resize();
      });
    });
    ro.observe(container);
    resizeObserverRef.current = ro;

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
        } catch {
          /* observer already disconnected */
        }
      }
      if (intersectionObserverRef.current) {
        try {
          intersectionObserverRef.current.disconnect();
        } catch {
          /* observer already disconnected */
        }
      }
      if (webglRef.current) {
        webglRef.current.dispose();
      }
      webglRef.current = null;
    };
  }, [
    BFECC,
    cursorSize,
    dt,
    isBounce,
    isViscous,
    iterationsPoisson,
    iterationsViscous,
    mouseForce,
    resolution,
    viscous,
    colors,
    autoDemo,
    autoSpeed,
    autoIntensity,
    takeoverDuration,
    autoResumeDelay,
    autoRampDuration,
  ]);

  return (
    <div
      ref={mountRef}
      className={`liquid-ether-container ${className || ""}`}
      style={style}
    />
  );
}

// Structural shape for `webglRef` — the lifecycle surface of the
// WebGLManager class defined inside the useEffect closure; defined
// at module scope so useRef can be statically typed.
interface WebGLManagerLike {
  start(): void;
  pause(): void;
  resize(): void;
  dispose(): void;
}
