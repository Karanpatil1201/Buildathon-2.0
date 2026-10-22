import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * ForgeSight AI — Interactive 3D Ceramic Tile Quality Inspection Line
 *
 * Adapted from the procedural miniature factory engine to simulate an industrial
 * ceramic tile quality inspection line with 7 specialized stations:
 * 1. Tile Infeed -> 2. Image Capture -> 3. AI Vision -> 4. Human Review ->
 * 5. Defect Tracking -> 6. Quality Gate -> 7. Corrective Action / Reinspection.
 *
 * Procedural Three.js: zero external 3D asset downloads, pure procedural canvas textures,
 * responsive layout, orbit controls, station focusing, and memory-safe unmount disposal.
 */

export type StationId =
  | 'infeed'
  | 'capture'
  | 'ai_engine'
  | 'human_review'
  | 'defect_tracking'
  | 'quality_gate'
  | 'reinspection'

export type MachineMode = 'assembled' | 'cutaway' | 'stations' | 'order'
export type MachineCamera = 'overview' | 'side' | 'top' | 'station' | 'flight'

export type MachineApi = {
  setMode: (name: string) => boolean
  focusStation: (id: string) => boolean
  setCamera: (name: string) => boolean
  play: () => boolean
  pause: () => boolean
}

declare global {
  interface Window {
    __machine?: MachineApi
    __machineDebug?: { getState: () => Record<string, unknown> }
  }
}

export type AgenticFactory3DProps = {
  /** Height of the scene box, e.g. 600, 720 or '100vh'. Default '100vh'. */
  height?: number | string
  className?: string
  /** Clean hero mode: hides debug chrome, offsets machine to right on wide displays. */
  embed?: boolean
  /** Active station ID to focus programmatically. */
  activeStationId?: StationId
  /** Callback when a station is clicked. */
  onStation?: (id: StationId) => void
  /** Callback when the first frame is rendered. */
  onReady?: () => void
}

export default function AgenticFactory3D({
  height = '100vh',
  className,
  embed = false,
  activeStationId,
  onStation,
  onReady,
}: AgenticFactory3DProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const handlers = useRef({ onStation, onReady })

  useEffect(() => {
    handlers.current = { onStation, onReady }
  }, [onStation, onReady])

  useEffect(() => {
    if (activeStationId && window.__machine) {
      window.__machine.focusStation(activeStationId)
    }
  }, [activeStationId])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let dispose: (() => void) | undefined
    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) return
      dispose = initMachineScene(root, getComputedStyle(root).fontFamily, {
        embedded: embed,
        onStation: (id) => handlers.current.onStation?.(id),
        onReady: () => handlers.current.onReady?.(),
      })
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [embed])

  return (
    <div
      ref={rootRef}
      className={['agentic-factory-3d', embed && 'embed', className].filter(Boolean).join(' ')}
      style={{ height }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        id="scene"
        role="img"
        aria-label="Interactive 3D Ceramic Tile Inspection Line with seven stations: Infeed, Capture, AI Vision, Human Review, Defect Tracking, Quality Gate, and Reinspection. Drag to rotate, scroll to zoom. Hover or tap a station to inspect."
      />
      <div className="vignette" />

      {/* Top Industrial Header */}
      <header className="topbar debug-ui">
        <div className="identity">
          <div className="mark">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 4h12v12H4zM4 10h12M10 4v12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <strong>ForgeSight AI // Ceramic Line 01</strong>
            <small>Automated Tile Quality & Defect Twin</small>
          </div>
        </div>
        <div className="status" id="status">
          <i />
          <span id="status-text">Line Running · 600×600 mm</span>
          <span>STATIONS: 07 / 07</span>
        </div>
      </header>

      {/* Scene Heading */}
      <div className="scene-heading debug-ui">
        Ceramic Tile Quality Inspection Line <span className="index">7 STATIONS / 1 CLOSED LOOP</span>
      </div>
      <div className="coordinates debug-ui">
        SYSTEM: FORGESIGHT AI · ISO 10545 TILE STANDARD · MOBILENETV3
      </div>

      {/* Journey tracker for single tile flow */}
      <div id="journey" className="debug-ui">
        <div className="journey-icon">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8h6M8 5v6" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <strong id="journey-title">Tile Infeed</strong>
          <small id="journey-detail">Station 01 · Vitrified porcelain slab entering inspection bed</small>
        </div>
        <div className="track">
          <i id="journey-progress" />
        </div>
      </div>

      {/* Station floating labels in 3D projection */}
      <div id="labels" />

      {/* Tooltip on station hover */}
      <div id="tooltip" role="tooltip">
        <strong />
        <p />
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="controls debug-ui">
        <nav className="mode-bar" aria-label="Line visual mode">
          <button data-mode="assembled" aria-pressed="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5l6 3.3v6.4l-6 3.3-6-3.3V4.8L8 1.5zM2 4.8l6 3.4 6-3.4M8 8.2v6.3"
                stroke="currentColor"
                strokeLinejoin="round"
              />
            </svg>
            Assembled
          </button>
          <button data-mode="cutaway" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M3 2h10v12H3zM8 2v12M10.5 4l2.5 2.5m-2.5 0L13 9m-2.5 0 2.5 2.5"
                stroke="currentColor"
                strokeLinejoin="round"
              />
            </svg>
            Internal Drives
          </button>
          <button data-mode="stations" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5l6 3-6 3-6-3 6-3zM2 8l6 3 6-3M2 11.5l6 3 6-3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            7 Stations
          </button>
          <button data-mode="order" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 2.5l9 5.5-9 5.5v-11z" stroke="currentColor" strokeLinejoin="round" />
            </svg>
            Follow Tile
          </button>
        </nav>

        <nav className="camera-row" aria-label="Camera perspective">
          <span className="caption">CAMERA</span>
          <button data-camera="overview" aria-pressed="true">Overview</button>
          <button data-camera="side" aria-pressed="false">Side</button>
          <button data-camera="top" aria-pressed="false">Top-Down</button>
          <button data-camera="station" aria-pressed="false">Station</button>
          <button data-camera="flight" aria-pressed="false">Orbit</button>
          <span className="divider" />
          <button id="play" aria-label="Pause the line animation" aria-pressed="false">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="2.5" height="10" rx=".5" />
              <rect x="7.5" y="1" width="2.5" height="10" rx=".5" />
            </svg>
          </button>
        </nav>
      </div>

      {/* Footer info bar */}
      <footer className="footer">
        <span className="wordmark">
          ForgeSight AI · <span>Ceramic Tile Inspection Rig</span>
        </span>
        <span className="footer-center debug-ui">PROCEDURAL 3D TWIN · 60 FPS</span>
        <span className="hint debug-ui">
          <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
            <rect x="2" y="1" width="9" height="14" rx="4.5" stroke="currentColor" />
            <path d="M6.5 4v3" stroke="currentColor" strokeLinecap="round" />
          </svg>
          Drag to rotate · Scroll to zoom · Click station
        </span>
      </footer>

      {/* Loading state */}
      <div id="loading">
        <i />
        <span>Initializing Ceramic Inspection Line...</span>
      </div>

      {/* WebGL Error fallback */}
      <div id="error" role="alert">
        <strong>Could not start 3D Ceramic Line</strong>
        <p>Check that WebGL and hardware acceleration are enabled in your browser.</p>
        <button onClick={() => location.reload()}>Reload Scene</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scene Initialization: Ceramic Inspection Production Twin
// ---------------------------------------------------------------------------

export type MachineSceneOptions = {
  embedded: boolean
  onStation?: (id: StationId) => void
  onReady?: () => void
}

function initMachineScene(
  root: HTMLElement,
  fontFamily: string,
  options: MachineSceneOptions
): () => void {
  const cleanups: Array<() => void> = []

  const frameWidth = () => root.clientWidth || 800
  const frameHeight = () => root.clientHeight || 600

  const listen = (target: EventTarget, type: string, handler: (event: never) => void) => {
    const fn = handler as unknown as EventListener
    target.addEventListener(type, fn)
    cleanups.push(() => target.removeEventListener(type, fn))
  }

  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = root.querySelector<T>(`#${id}`)
    if (!el) throw new Error(`Scene markup missing #${id}`)
    return el
  }

  function showError(message?: string) {
    $('loading').classList.add('done')
    $('error').style.display = 'block'
    if (message) $('error').querySelector('p')!.textContent = message
  }

  const dispose = () => {
    for (const fn of cleanups.reverse()) fn()
    cleanups.length = 0
  }

  try {
    const TAU = Math.PI * 2
    const embedded = options.embedded
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

    // Industrial color palette: Slate, Zinc, Titanium, Warm Amber, Laser Cyan, Alert Crimson
    const palette = {
      amber: 0xf59e0b,
      cyan: 0x06b6d4,
      crimson: 0xef4444,
      emerald: 0x10b981,
      steel: 0x64748b,
      darkBase: 0x0f172a,
      ceramicIvory: 0xf1f5f9,
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, frameWidth() / frameHeight(), 0.1, 150)
    
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch (e) {
      showError('WebGL is not available in your browser settings.')
      throw e
    }

    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(devicePixelRatio, frameWidth() < 900 ? 1.5 : 1.75))
    renderer.setSize(frameWidth(), frameHeight())
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.localClippingEnabled = true
    $('scene').appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.065
    controls.enablePan = false
    controls.minDistance = 8
    controls.maxDistance = 55
    controls.minPolarAngle = 0.08
    controls.maxPolarAngle = Math.PI * 0.475
    controls.rotateSpeed = 0.48
    controls.zoomSpeed = 0.7

    if (embedded) {
      controls.enableZoom = false
      if (matchMedia('(pointer:coarse)').matches) controls.enableRotate = false
    }

    // HDR Environment lighting
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.65
    room.dispose()
    pmrem.dispose()

    scene.add(new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 2.2))

    // Key inspection light
    const key = new THREE.DirectionalLight(0xfff7ed, 4.4)
    key.position.set(-5, 14, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, {
      left: -12,
      right: 12,
      top: 10,
      bottom: -10,
      near: 0.5,
      far: 40,
    })
    key.shadow.normalBias = 0.035
    key.shadow.bias = -0.0002
    key.shadow.radius = 3.5
    scene.add(key)

    const rim = new THREE.DirectionalLight(0xbae6fd, 2.8)
    rim.position.set(4, 8, -9)
    scene.add(rim)

    const warm = new THREE.PointLight(0xf59e0b, 24, 22, 2)
    warm.position.set(-4, 6, 3)
    scene.add(warm)

    const scanCyan = new THREE.PointLight(0x06b6d4, 18, 15, 2)
    scanCyan.position.set(-2, 4, -1)
    scene.add(scanCyan)

    // Materials definition
    const mat = (
      color: number,
      metalness = 0.15,
      roughness = 0.45,
      extra: THREE.MeshStandardMaterialParameters = {}
    ) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })

    const M = {
      body: mat(0x272e3b, 0.65, 0.35),
      base: mat(0x18202f, 0.85, 0.3),
      edge: mat(0x64748b, 0.8, 0.25),
      chrome: mat(0xd1d5db, 0.95, 0.16),
      dark: mat(0x0b0f17, 0.4, 0.4),
      rubber: mat(0x0f172a, 0.1, 0.65),
      amber: mat(palette.amber, 0.5, 0.25),
      cyan: mat(palette.cyan, 0.6, 0.2),
      ivory: mat(0xe2e8f0, 0.3, 0.3),
      copper: mat(0xc27838, 0.85, 0.28),
      black: mat(0x05070a, 0.1, 0.5),
      tileGlaze: mat(0xf8fafc, 0.05, 0.18),
      tileDefect: mat(0xfecdd3, 0.1, 0.4),
      laserBeam: mat(0x38bdf8, 0.1, 0.2, { emissive: 0x06b6d4, emissiveIntensity: 2.2 }),
      amberLight: mat(palette.amber, 0.2, 0.25, { emissive: palette.amber, emissiveIntensity: 1.6 }),
      greenLight: mat(palette.emerald, 0.2, 0.25, { emissive: palette.emerald, emissiveIntensity: 1.5 }),
      crimsonLight: mat(palette.crimson, 0.2, 0.25, { emissive: palette.crimson, emissiveIntensity: 1.8 }),
      glass: mat(0x94a3b8, 0.5, 0.15, { transparent: true, opacity: 0.22, depthWrite: false }),
    }

    type Vec3 = [number, number, number]
    type Material = THREE.Material

    const geometries = new Map<string, THREE.BufferGeometry>()
    function boxGeo(w: number, h: number, d: number, r = 0.04) {
      const k = `b${w},${h},${d},${r}`
      if (!geometries.has(k)) {
        geometries.set(
          k,
          r
            ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
            : new THREE.BoxGeometry(w, h, d)
        )
      }
      return geometries.get(k)!
    }

    function box(
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: Material = M.body,
      r = 0.04
    ) {
      const o = new THREE.Mesh(boxGeo(w, h, d, r), m)
      o.position.set(x, y, z)
      o.castShadow = true
      o.receiveShadow = true
      parent.add(o)
      return o
    }

    function cyl(
      parent: THREE.Object3D,
      r: number,
      h: number,
      x: number,
      y: number,
      z: number,
      m: Material = M.chrome,
      r2: number = r,
      segments = 24
    ) {
      const k = `c${r},${r2},${h},${segments}`
      if (!geometries.has(k)) geometries.set(k, new THREE.CylinderGeometry(r, r2, h, segments))
      const o = new THREE.Mesh(geometries.get(k)!, m)
      o.position.set(x, y, z)
      o.castShadow = true
      o.receiveShadow = true
      parent.add(o)
      return o
    }

    function tube(parent: THREE.Object3D, pts: Vec3[], r: number, m: Material = M.chrome) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
      const o = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(12, pts.length * 7), r, 8, false),
        m
      )
      o.castShadow = true
      parent.add(o)
      return o
    }

    function screw(parent: THREE.Object3D, x: number, y: number, z: number) {
      cyl(parent, 0.055, 0.026, x, y, z, M.chrome, undefined, 12)
      box(parent, 0.068, 0.005, 0.009, x, y + 0.014, z, M.dark, 0)
    }

    type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void
    function canvasTexture(w: number, h: number, draw: Draw) {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      draw(ctx, w, h)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      return { texture: t, canvas: c, ctx }
    }

    function print(
      ctx: CanvasRenderingContext2D,
      txt: string,
      x: number,
      y: number,
      size = 20,
      color = '#f8fafc',
      weight = 500
    ) {
      ctx.fillStyle = color
      ctx.font = `${weight} ${size}px ${fontFamily}`
      ctx.fillText(txt, x, y)
    }

    function screen(
      parent: THREE.Object3D,
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      tex: THREE.Texture | { texture: THREE.Texture }
    ) {
      const map = 'texture' in tex ? tex.texture : tex
      const o = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map, toneMapped: false })
      )
      o.position.set(x, y, z)
      parent.add(o)
      return o
    }

    const machine = new THREE.Group()
    scene.add(machine)

    // Floor & contact shadows
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.44
    floor.receiveShadow = true
    scene.add(floor)

    const shadow = canvasTexture(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(64, 64, 16, 64, 64, 64)
      g.addColorStop(0, 'rgba(0,0,0,.85)')
      g.addColorStop(0.55, 'rgba(0,0,0,.45)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    })
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(21, 14),
      new THREE.MeshBasicMaterial({
        map: shadow.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      })
    )
    contact.rotation.x = -Math.PI / 2
    contact.position.y = -0.42
    scene.add(contact)

    // Main machine bed / platform
    box(machine, 14.8, 0.38, 9.4, 0, -0.09, 0, M.base, 0.18)
    box(machine, 14.6, 0.055, 9.2, 0, 0.13, 0, M.edge, 0.12)
    box(machine, 14.48, 0.09, 9.08, 0, 0.19, 0, M.body, 0.1)
    box(machine, 14.52, 0.027, 9.12, 0, -0.19, 0, M.dark, 0.06)

    // Ambient status light band around base
    box(machine, 13.9, 0.026, 0.032, 0, -0.17, 4.68, M.amberLight, 0.01)

    // Foundation support feet
    for (const x of [-6.6, 6.6]) {
      for (const z of [-4.0, 4.0]) {
        cyl(machine, 0.42, 0.25, x, -0.31, z, M.rubber)
        cyl(machine, 0.3, 0.09, x, -0.4, z, M.dark)
        screw(machine, x, 0.253, z)
      }
    }

    // Machine bed plate engraving
    const engraving = canvasTexture(1600, 180, (c, w, h) => {
      c.fillStyle = '#1e293b'
      c.fillRect(0, 0, w, h)
      c.strokeStyle = '#334155'
      c.lineWidth = 2
      c.strokeRect(2, 2, w - 4, h - 4)
      print(c, 'FORGESIGHT AI', 48, 76, 38, '#f8fafc', 700)
      print(c, '·  CERAMIC TILE QUALITY INSPECTION  ·  LINE 01', 370, 75, 30, '#94a3b8', 500)
      print(c, 'ISO 10545 VITRIFIED PORCELAIN SPECIFICATION  /  100% IN-LINE VISION & TRACEABILITY', 50, 132, 18, '#64748b', 500)
      print(c, 'STATION RIG #07', 1370, 130, 22, '#f59e0b', 600)
    })
    const plate = screen(machine, 8.8, 0.95, -0.2, 0.25, 4.05, engraving)
    plate.rotation.x = -Math.PI / 2

    // -----------------------------------------------------------------------
    // The 7 Quality Inspection Stations Definition
    // -----------------------------------------------------------------------
    type StationDef = {
      id: StationId
      name: string
      step: number
      output: string
      pos: Vec3
      desc: string
      statusType: 'normal' | 'active' | 'warning' | 'alert'
    }

    type Station = StationDef & {
      group: THREE.Group
      base: THREE.Vector3
      glowMat: THREE.MeshStandardMaterial
      label: HTMLDivElement
      index: number
      anchor: THREE.Vector3
    }

    const definitions: StationDef[] = [
      {
        id: 'infeed',
        name: 'Tile Infeed',
        step: 1,
        output: 'Raw Tile',
        pos: [-5.2, 0.29, 0.4],
        desc: 'Conveyor infeed receiving 600×600 mm uninspected porcelain tiles with mechanical centering.',
        statusType: 'normal',
      },
      {
        id: 'capture',
        name: 'Image Capture',
        step: 2,
        output: '4K Evidence',
        pos: [-3.3, 0.29, -1.8],
        desc: 'High-frequency 4K optical line-scan cameras with dual high-CRI strobe arrays for surface glaze capture.',
        statusType: 'active',
      },
      {
        id: 'ai_engine',
        name: 'AI Vision Engine',
        step: 3,
        output: 'Inference',
        pos: [-0.6, 0.29, -2.4],
        desc: 'Deep learning classification (MobileNetV3) generating defect probabilities and Grad-CAM spatial heatmaps.',
        statusType: 'active',
      },
      {
        id: 'human_review',
        name: 'Human Review',
        step: 4,
        output: 'Disposition',
        pos: [2.2, 0.29, -2.2],
        desc: 'Operator workbench enforcing separation of duties; inspector validates or challenges AI flags.',
        statusType: 'warning',
      },
      {
        id: 'defect_tracking',
        name: 'Defect Tracking',
        step: 5,
        output: 'CAPA Record',
        pos: [4.9, 0.29, -0.1],
        desc: 'Automated defect traveler issuance with flaw class, severity score, lot ID, and kiln/glaze CAPA routing.',
        statusType: 'alert',
      },
      {
        id: 'quality_gate',
        name: 'Quality Gate',
        step: 6,
        output: 'Pass / Hold',
        pos: [3.4, 0.29, 2.3],
        desc: 'High-speed pneumatic diverter arm automatically routing verified tiles to packaging or quarantine buffer.',
        statusType: 'normal',
      },
      {
        id: 'reinspection',
        name: 'Reinspection & CAPA',
        step: 7,
        output: 'Rework Verify',
        pos: [-1.2, 0.29, 2.5],
        desc: 'Secondary verification staging for reworked/re-fired tiles before line clearance and lot release.',
        statusType: 'active',
      },
    ]

    const stations: Station[] = []
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10)
    const shellMaterials: THREE.Material[] = []

    function shell<T extends THREE.Material>(m: T): T {
      const s = m.clone() as T
      s.clippingPlanes = [cutPlane]
      s.clipShadows = true
      s.side = THREE.DoubleSide
      shellMaterials.push(s)
      return s
    }

    const S = {
      body: shell(M.body),
      ivory: shell(M.ivory),
      amber: shell(M.amber),
      edge: shell(M.edge),
      dark: shell(M.dark),
    }

    const gears: Array<{ g: THREE.Group; vertical: boolean }> = []
    function gear(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.28, vertical = false) {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      if (vertical) g.rotation.x = Math.PI / 2
      parent.add(g)
      cyl(g, r, 0.08, 0, 0, 0, M.copper)
      cyl(g, r * 0.65, 0.095, 0, 0, 0, M.dark)
      cyl(g, r * 0.2, 0.12, 0, 0, 0, M.chrome)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU
        const b = box(g, r * 0.26, 0.08, r * 0.18, Math.cos(a) * r, 0, Math.sin(a) * r, M.copper, 0.008)
        b.rotation.y = -a
      }
      g.userData.moving = true
      gears.push({ g, vertical })
      return g
    }

    // Build each station group and attach station plaque & HTML labels
    definitions.forEach((d, i) => {
      const group = new THREE.Group()
      group.position.fromArray(d.pos)
      machine.add(group)

      const glowMat = M.amberLight.clone()
      glowMat.emissiveIntensity = 0.45

      box(group, 1.85, 0.12, 1.6, 0, 0.03, 0, M.dark, 0.1)
      box(group, 1.78, 0.03, 1.52, 0, 0.11, 0, glowMat, 0.08)
      box(group, 1.82, 0.16, 1.56, 0, 0.2, 0, M.body, 0.09)

      for (const x of [-0.75, 0.75]) {
        for (const z of [-0.6, 0.6]) {
          screw(group, x, 0.29, z)
        }
      }

      gear(group, -0.32, 0.42, 0, 0.24)
      gear(group, 0.2, 0.42, 0.1, 0.18)

      tube(
        group,
        [
          [-0.6, 0.38, -0.3],
          [-0.45, 0.45, 0.35],
          [0.3, 0.42, 0.5],
          [0.6, 0.52, 0.2],
        ],
        0.02,
        M.laserBeam
      )

      // Station Plaque
      const plaque = canvasTexture(512, 116, (c, w, h) => {
        c.fillStyle = '#0f172a'
        c.fillRect(0, 0, w, h)
        print(c, String(d.step).padStart(2, '0'), 24, 76, 42, '#f59e0b', 700)
        print(c, d.name.toUpperCase(), 105, 73, 31, '#f1f5f9', 600)
      })
      screen(group, 1.45, 0.32, 0, 0.26, 0.81, plaque)

      // Floating HTML label in the 3D space
      const label = document.createElement('div')
      label.className = 'station-label'
      label.innerHTML = `
        <div class="stem"></div>
        <div class="label-card">
          <div class="label-title">
            <span>${String(d.step).padStart(2, '0')}</span>
            ${d.name}
          </div>
          <div class="label-meta">${d.output} · Active</div>
        </div>
      `
      $('labels').appendChild(label)
      cleanups.push(() => label.remove())

      stations.push({
        ...d,
        group,
        base: new THREE.Vector3(...d.pos),
        glowMat,
        label,
        index: i,
        anchor: new THREE.Vector3(0, 2.4, 0),
      })
    })

    // -----------------------------------------------------------------------
    // Individual Station Geometries (Industrial Ceramic Tile Inspection)
    // -----------------------------------------------------------------------

    // Station 1: TILE INFEED (Conveyor guide rails, tile intake hopper)
    const infeed = stations[0].group
    box(infeed, 1.5, 0.5, 1.1, 0, 0.58, 0, S.body, 0.08)
    for (const x of [-0.65, 0.65]) {
      cyl(infeed, 0.05, 1.6, x, 1.25, -0.15, M.chrome)
      box(infeed, 0.18, 1.6, 0.18, x, 1.25, -0.38, S.ivory, 0.03)
    }
    // Hopper feeder plates
    box(infeed, 1.5, 0.22, 0.04, 0, 1.4, -0.3, M.edge, 0.02)
    box(infeed, 1.5, 0.22, 0.04, 0, 1.4, 0.3, M.edge, 0.02)
    // Feed rollers
    for (let r = 0; r < 5; r++) {
      const roll = cyl(infeed, 0.08, 1.3, 0, 0.88, -0.4 + r * 0.2, M.rubber)
      roll.rotation.z = Math.PI / 2
    }

    // Station 2: IMAGE CAPTURE (Optical line-scan gantry, 4K camera housing, LED light bars)
    const capture = stations[1].group
    box(capture, 1.6, 0.55, 1.15, 0, 0.6, 0, S.body, 0.08)
    // Twin vertical arch gantry
    for (const x of [-0.7, 0.7]) {
      cyl(capture, 0.065, 1.9, x, 1.45, 0, M.chrome)
    }
    // Cross bridge beam
    box(capture, 1.6, 0.22, 0.38, 0, 2.38, 0, S.ivory, 0.04)
    // 4K Camera optical housing
    const cameraHousing = new THREE.Group()
    cameraHousing.position.set(0, 2.05, 0)
    capture.add(cameraHousing)
    box(cameraHousing, 0.44, 0.32, 0.4, 0, 0, 0, M.dark, 0.04)
    cyl(cameraHousing, 0.12, 0.18, 0, -0.22, 0, M.chrome, 0.08)
    // Dual high-intensity LED strobe arrays
    for (const z of [-0.3, 0.3]) {
      box(cameraHousing, 0.9, 0.08, 0.12, 0, -0.06, z, M.laserBeam, 0.02)
    }

    // Station 3: AI VISION ENGINE (Deep Learning rack, status display, neural heatsinks)
    const aiEngine = stations[2].group
    box(aiEngine, 1.65, 0.62, 1.2, 0, 0.65, 0, S.body, 0.09)
    // Server tower enclosure
    box(aiEngine, 1.4, 1.4, 0.85, 0, 1.48, -0.12, S.dark, 0.06)
    // Heatsink ventilation fins
    for (let f = 0; f < 8; f++) {
      box(aiEngine, 1.25, 0.02, 0.12, 0, 1.0 + f * 0.11, 0.32, M.edge, 0.005)
    }
    // AI Inference screen
    const aiScreenTex = canvasTexture(512, 256, (c, w, h) => {
      c.fillStyle = '#090d16'
      c.fillRect(0, 0, w, h)
      print(c, 'MOBILENETV3 INFERENCE', 24, 45, 22, '#38bdf8', 600)
      print(c, 'CLASSIFIER: 87.97% ACC', 24, 78, 16, '#94a3b8')
      print(c, 'GRAD-CAM HEATMAP: ACTIVE', 24, 108, 16, '#f59e0b')
      c.fillStyle = '#1e293b'
      c.fillRect(24, 130, 464, 28)
      c.fillStyle = '#06b6d4'
      c.fillRect(24, 130, 390, 28)
      print(c, 'LATENCY: 42 MS / TILE', 24, 195, 18, '#10b981', 600)
    })
    screen(aiEngine, 1.2, 0.6, 0, 1.8, 0.32, aiScreenTex)

    // Station 4: HUMAN REVIEW CONSOLE (Operator desk, review screen, confirm knobs)
    const review = stations[3].group
    box(review, 1.7, 0.6, 1.2, 0, 0.64, 0, S.body, 0.09)
    const reviewConsole = new THREE.Group()
    reviewConsole.position.set(0, 0.98, -0.05)
    reviewConsole.rotation.x = -0.3
    review.add(reviewConsole)
    box(reviewConsole, 1.55, 0.1, 1.15, 0, 0, 0, S.ivory, 0.04)

    const reviewScreenTex = canvasTexture(640, 340, (c, w, h) => {
      c.fillStyle = '#0f172a'
      c.fillRect(0, 0, w, h)
      print(c, 'HUMAN REVIEW WORKBENCH', 25, 42, 22, '#f8fafc', 600)
      print(c, 'SEPARATION OF DUTIES ENFORCED', 25, 72, 14, '#94a3b8')
      c.fillStyle = '#1e293b'
      c.fillRect(25, 95, 280, 160)
      c.fillStyle = '#f59e0b'
      c.strokeRect(40, 115, 140, 110)
      print(c, 'FLAGGED: CRACK', 45, 140, 14, '#f59e0b')
      print(c, 'CONF: 98.4%', 45, 165, 14, '#f8fafc')
      c.fillStyle = '#10b981'
      c.fillRect(330, 105, 130, 45)
      print(c, 'CONFIRM PASS', 345, 133, 14, '#ffffff', 600)
      c.fillStyle = '#ef4444'
      c.fillRect(475, 105, 130, 45)
      print(c, 'REJECT DEFECT', 490, 133, 14, '#ffffff', 600)
    })
    const rs = screen(reviewConsole, 1.35, 0.72, 0, 0.065, -0.15, reviewScreenTex)
    rs.rotation.x = -Math.PI / 2

    // Control toggles
    for (let t = 0; t < 3; t++) {
      cyl(reviewConsole, 0.06, 0.04, -0.4 + t * 0.4, 0.09, 0.4, M.dark)
      cyl(reviewConsole, 0.025, 0.14, -0.4 + t * 0.4, 0.16, 0.4, M.chrome)
    }

    // Station 5: DEFECT TRACKING & CAPA (Digital defect printer, QA ticket, Defect log)
    const defectStation = stations[4].group
    box(defectStation, 1.6, 0.6, 1.15, 0, 0.64, 0, S.body, 0.09)
    box(defectStation, 1.35, 1.25, 0.8, 0, 1.38, -0.1, S.ivory, 0.06)

    // Defect Traveler Ticket
    const ticketTex = canvasTexture(320, 480, (c, w, h) => {
      c.fillStyle = '#f8fafc'
      c.fillRect(0, 0, w, h)
      print(c, 'DEFECT TRAVELER', 24, 48, 22, '#0f172a', 700)
      print(c, 'ID: DEF-2026-0042', 24, 82, 16, '#64748b')
      c.strokeStyle = '#94a3b8'
      c.setLineDash([4, 4])
      c.beginPath()
      c.moveTo(20, 105)
      c.lineTo(300, 105)
      c.stroke()
      print(c, 'DEFECT: SURFACE CRACK', 24, 145, 17, '#ef4444', 600)
      print(c, 'SEVERITY: CRITICAL', 24, 180, 16, '#0f172a')
      print(c, 'BATCH: #T-904 (LOT A)', 24, 215, 16, '#0f172a')
      print(c, 'CAPA: KILN COOLING TEMP', 24, 250, 16, '#f59e0b', 600)
      for (let b = 0; b < 28; b++) {
        c.fillStyle = '#0f172a'
        c.fillRect(24 + b * 9, 320, 4, 60)
      }
    })
    const ticketMesh = screen(defectStation, 0.62, 0.92, 0, 1.5, 0.32, ticketTex)
    ticketMesh.material.side = THREE.DoubleSide

    // Station 6: QUALITY GATE (Pneumatic diverter arm, twin routing lanes)
    const qualityGate = stations[5].group
    box(qualityGate, 1.7, 0.58, 1.2, 0, 0.63, 0, S.body, 0.09)
    // Twin sorting lane dividers
    box(qualityGate, 0.08, 0.32, 1.4, -0.65, 1.05, 0, M.edge, 0.02)
    box(qualityGate, 0.08, 0.32, 1.4, 0.65, 1.05, 0, M.edge, 0.02)
    // Pneumatic diverter arm
    const diverterArm = new THREE.Group()
    diverterArm.position.set(-0.55, 1.05, -0.4)
    diverterArm.userData.moving = true
    qualityGate.add(diverterArm)
    box(diverterArm, 0.95, 0.18, 0.06, 0.45, 0, 0, M.amber, 0.02)
    cyl(diverterArm, 0.06, 0.28, 0, 0, 0, M.chrome)

    // Quality gate status displays
    const passIndicator = box(qualityGate, 0.24, 0.12, 0.12, -0.4, 1.35, 0.5, M.greenLight, 0.02)
    const holdIndicator = box(qualityGate, 0.24, 0.12, 0.12, 0.4, 1.35, 0.5, M.crimsonLight, 0.02)

    // Station 7: REINSPECTION & CAPA BAY (Secondary verification cradle, scan beacon)
    const reinspection = stations[6].group
    box(reinspection, 1.6, 0.58, 1.15, 0, 0.63, 0, S.body, 0.09)
    // Remediated tile holding buffer
    box(reinspection, 1.25, 0.08, 0.85, 0, 0.98, 0, S.ivory, 0.03)
    // Secondary optical scanner arch
    for (const x of [-0.55, 0.55]) {
      cyl(reinspection, 0.045, 1.2, x, 1.4, 0, M.chrome)
    }
    box(reinspection, 1.25, 0.12, 0.25, 0, 2.0, 0, M.body, 0.02)
    cyl(reinspection, 0.08, 0.12, 0, 1.88, 0, M.laserBeam)

    // -----------------------------------------------------------------------
    // The Closed-Loop Conveyor Path
    // -----------------------------------------------------------------------
    const path = new THREE.CatmullRomCurve3(
      [
        [-5.0, 0.84, 0.5],
        [-3.6, 0.84, -1.0],
        [-1.0, 0.84, -1.9],
        [1.8, 0.84, -1.8],
        [4.2, 0.84, -0.3],
        [4.3, 0.84, 1.4],
        [2.6, 0.84, 2.4],
        [-1.0, 0.84, 2.4],
        [-4.5, 0.84, 1.6],
      ].map((p) => new THREE.Vector3(...p)),
      true,
      'catmullrom',
      0.25
    )

    const belt = new THREE.Group()
    machine.add(belt)

    const frameMesh = new THREE.Mesh(new THREE.TubeGeometry(path, 160, 0.38, 8, true), M.dark)
    frameMesh.scale.y = 0.3
    frameMesh.position.y = 0.52
    belt.add(frameMesh)

    // Instanced belt slats
    const beltCount = 152
    const beltSlats = new THREE.InstancedMesh(boxGeo(0.14, 0.065, 0.72, 0.012), M.body, beltCount)
    beltSlats.receiveShadow = true
    belt.add(beltSlats)
    beltSlats.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const dummy = new THREE.Object3D()
    const pVec = new THREE.Vector3()
    const tVec = new THREE.Vector3()

    function updateBelt(t: number) {
      for (let i = 0; i < beltCount; i++) {
        const u = (i / beltCount + t * 0.012) % 1
        path.getPointAt(u, pVec)
        path.getTangentAt(u, tVec)
        dummy.position.copy(pVec)
        dummy.rotation.set(0, -Math.atan2(tVec.z, tVec.x), 0)
        dummy.updateMatrix()
        beltSlats.setMatrixAt(i, dummy.matrix)
      }
      beltSlats.instanceMatrix.needsUpdate = true
    }
    updateBelt(0)

    // Chrome guide rails
    for (const side of [-1, 1]) {
      const pts = []
      for (let i = 0; i <= 160; i++) {
        path.getPointAt(i / 160, pVec)
        path.getTangentAt(i / 160, tVec)
        pts.push(pVec.clone().add(new THREE.Vector3(-tVec.z * 0.42 * side, 0.1, tVec.x * 0.42 * side)))
      }
      const railPath = new THREE.CatmullRomCurve3(pts)
      belt.add(new THREE.Mesh(new THREE.TubeGeometry(railPath, 160, 0.026, 6, false), M.chrome))
    }

    // Conveyor support legs
    for (let i = 0; i < 16; i++) {
      const p = path.getPointAt(i / 16)
      cyl(belt, 0.045, 0.45, p.x, 0.54, p.z, M.chrome)
    }

    // Connecting pneumatic copper lines between stations
    const pipes = new THREE.Group()
    machine.add(pipes)
    for (let i = 0; i < stations.length; i++) {
      const a = stations[i].base
      const b = stations[(i + 1) % stations.length].base
      const points = [
        a.clone().add(new THREE.Vector3(0.3, 0.12, 0)),
        a.clone().lerp(b, 0.35).add(new THREE.Vector3(0, 0.1, -0.4)),
        a.clone().lerp(b, 0.65).add(new THREE.Vector3(0, 0.1, -0.4)),
        b.clone().add(new THREE.Vector3(-0.3, 0.12, 0)),
      ]
      const curve = new THREE.CatmullRomCurve3(points)
      pipes.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.04, 8, false), M.copper))
    }

    // -----------------------------------------------------------------------
    // Ceramic Tile Cargo Slabs along the Conveyor
    // -----------------------------------------------------------------------
    // Slabs with procedural canvas textures representing porcelain glaze & defects
    const tileNormalTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#f8fafc'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#e2e8f0'
      c.fillRect(8, 8, w - 16, h - 16)
      c.strokeStyle = '#cbd5e1'
      c.lineWidth = 2
      c.strokeRect(12, 12, w - 24, h - 24)
      print(c, 'VITRIFIED PORCELAIN', 24, 52, 14, '#64748b', 600)
      print(c, 'BATCH #T-904', 24, 76, 12, '#94a3b8')
    })

    const tileScanningTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#f8fafc'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#e2e8f0'
      c.fillRect(8, 8, w - 16, h - 16)
      // Laser scan sweep line
      c.fillStyle = '#38bdf8'
      c.fillRect(8, 110, w - 16, 8)
      print(c, 'OPTICAL SCANNING...', 24, 52, 14, '#0284c7', 600)
    })

    const tileDefectTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#f8fafc'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#e2e8f0'
      c.fillRect(8, 8, w - 16, h - 16)
      // Red bounding box around hairline defect
      c.strokeStyle = '#ef4444'
      c.lineWidth = 3
      c.strokeRect(60, 60, 110, 80)
      c.fillStyle = 'rgba(239, 68, 68, 0.15)'
      c.fillRect(60, 60, 110, 80)
      print(c, 'GLAZE CRACK', 65, 80, 12, '#ef4444', 700)
      print(c, '98.4%', 65, 96, 11, '#ef4444')
    })

    const tileVerifiedTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#f8fafc'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#e2e8f0'
      c.fillRect(8, 8, w - 16, h - 16)
      c.fillStyle = 'rgba(16, 185, 129, 0.2)'
      c.fillRect(50, 50, 140, 60)
      c.strokeStyle = '#10b981'
      c.lineWidth = 2
      c.strokeRect(50, 50, 140, 60)
      print(c, 'QC PASSED', 80, 85, 16, '#059669', 700)
    })

    const tileTextures = [tileNormalTex, tileScanningTex, tileDefectTex, tileVerifiedTex]

    const tileCount = 7
    const tiles: Array<{
      group: THREE.Group
      faces: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]
      halo: THREE.Mesh
      stage: number
      phase: number
    }> = []

    for (let i = 0; i < tileCount; i++) {
      const g = new THREE.Group()
      g.userData.moving = true
      machine.add(g)

      // Ceramic tile slab (600x600 mm proportion)
      box(g, 0.62, 0.04, 0.62, 0, 0, 0, M.tileGlaze, 0.015)

      // Surface texture face
      const faces = tileTextures.map((tex) => {
        const s = screen(g, 0.58, 0.58, 0, 0.022, 0, tex)
        s.rotation.x = -Math.PI / 2
        s.visible = false
        return s
      })

      // Active tile marker halo
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.48, 0.52, 40),
        new THREE.MeshBasicMaterial({
          color: palette.amber,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.y = -0.02
      g.add(halo)
      halo.visible = false

      tiles.push({ group: g, faces, halo, stage: -1, phase: 0 })
    }

    // Geometry optimization: compact static parts
    function compact(group: THREE.Object3D) {
      for (const child of [...group.children]) {
        if ((child as THREE.Group).isGroup) compact(child)
      }
      const buckets = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>()
      for (const object of group.children) {
        const child = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material> & {
          isInstancedMesh?: boolean
        }
        if (
          !child.isMesh ||
          child.isInstancedMesh ||
          child.userData.moving ||
          Array.isArray(child.material)
        )
          continue
        const key = child.material.uuid
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push(child)
      }
      for (const list of buckets.values()) {
        if (list.length < 2) continue
        const geos = list.map((m) => {
          m.updateMatrix()
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
          return g.applyMatrix4(m.matrix)
        })
        const merged = mergeGeometries(geos, false)
        for (const geo of geos) geo.dispose()
        if (!merged) continue
        const mesh = new THREE.Mesh(merged, list[0].material)
        mesh.castShadow = list.some((x) => x.castShadow)
        mesh.receiveShadow = list.some((x) => x.receiveShadow)
        for (const m of list) group.remove(m)
        group.add(mesh)
      }
    }

    ;[diverterArm, cameraHousing].forEach((g) => (g.userData.moving = true))
    compact(machine)

    stations.forEach((s) => {
      s.group.traverse((o) => {
        o.userData.station = s.id
      })
    })

    const pickables = stations.map((s) => s.group)

    // State machine
    let mode: MachineMode = 'assembled'
    let cameraMode: MachineCamera = 'overview'
    let playing = !reduceMotion
    let simTime = 0
    let spread = 0
    let selected: string = 'capture'
    let hovered: string | null = null

    let width = frameWidth()
    let height = frameHeight()
    let mobile = width <= 900
    let lastInteraction = performance.now()
    let dragging = false
    let wasDragged = false
    let downX = 0
    let downY = 0
    let cameraAnimating = true
    let flightTime = 0
    let lastDraw = -1
    let visible = true
    let contextLost = false

    const desiredPosition = new THREE.Vector3()
    const desiredTarget = new THREE.Vector3(0, 1.2, 0)
    const viewDirection = new THREE.Vector3(11, 12, 18).normalize()

    let baseDistance = 26
    let sized = false
    let readySent = false

    function layoutCamera() {
      if (!frameWidth() || !frameHeight()) return
      const first = !sized
      sized = true
      width = frameWidth()
      height = frameHeight()
      mobile = width <= 900
      renderer.setSize(width, height)
      camera.aspect = width / height

      camera.setViewOffset(
        width,
        height,
        mobile || !embedded ? 0 : -width * 0.22,
        mobile || embedded ? 0 : height * 0.02,
        width,
        height
      )

      const aspect = width / height
      const availableWidth = mobile ? 0.92 : Math.min(0.55, aspect > 2 ? 0.54 : 0.58)
      const horizontalFit =
        18.5 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect * availableWidth)
      const verticalFit =
        12.0 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (embedded ? 0.85 : 0.65))

      baseDistance =
        (Math.max(horizontalFit, verticalFit) * (mobile ? 0.98 : 1)) /
        (embedded ? (mobile ? 1.15 : 1.45) : 1)

      controls.maxDistance = Math.max(55, baseDistance * 1.6)
      camera.updateProjectionMatrix()
      setCameraGoal()
      cameraAnimating = true

      if (first) {
        camera.position.copy(desiredPosition)
        controls.target.copy(desiredTarget)
        controls.update()
        cameraAnimating = false
      }
    }

    function setCameraGoal() {
      const expand = mode === 'stations' ? 1.25 : 1
      if (cameraMode === 'station') {
        const s = stations.find((st) => st.id === selected) || stations[1]
        desiredTarget.copy(s.group.position).add(new THREE.Vector3(0, 1.4, 0))
        desiredPosition.copy(desiredTarget).addScaledVector(viewDirection, mobile ? 10 : 13)
      } else {
        desiredTarget.set(0, 1.1, 0)
        const distance = baseDistance * expand
        if (cameraMode === 'side') {
          desiredPosition.set(15, 6, 21).normalize().multiplyScalar(distance).add(desiredTarget)
        } else if (cameraMode === 'top') {
          desiredPosition.set(0.01, distance, 0.8).add(desiredTarget)
        } else {
          desiredPosition.copy(viewDirection).multiplyScalar(distance).add(desiredTarget)
        }
      }
    }

    function syncButtons() {
      root
        .querySelectorAll<HTMLElement>('[data-mode]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)))
      root
        .querySelectorAll<HTMLElement>('[data-camera]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.camera === cameraMode)))
      $('journey').classList.toggle('visible', mode === 'order')
    }

    const modeAliases: Record<string, MachineMode> = {
      assembled: 'assembled',
      cutaway: 'cutaway',
      stations: 'stations',
      order: 'order',
    }

    function setMode(name: string) {
      if (!Object.hasOwn(modeAliases, name)) return false
      mode = modeAliases[name]
      lastInteraction = performance.now()
      if (mode === 'order') {
        simTime = 0
        lastDraw = -1
        play()
        cameraMode = 'overview'
      } else if (cameraMode === 'station') {
        cameraMode = 'overview'
      }
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }

    function focusStation(id: string) {
      const s = stations.find((st) => st.id === id)
      if (!s) return false
      selected = id
      if (mode === 'order') mode = 'assembled'
      cameraMode = 'station'
      lastInteraction = performance.now()
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }

    function setCamera(name: string) {
      const valid = ['overview', 'side', 'top', 'station', 'flight']
      if (!valid.includes(name)) return false
      cameraMode = name as MachineCamera
      if (mode === 'order') mode = 'assembled'
      lastInteraction = performance.now()
      flightTime = 0
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }

    function syncPlayback() {
      const b = $('play')
      b.setAttribute('aria-label', playing ? 'Pause the line animation' : 'Resume the line animation')
      b.setAttribute('aria-pressed', String(!playing))
      b.innerHTML = playing
        ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="2.5" height="10" rx=".5"/><rect x="7.5" y="1" width="2.5" height="10" rx=".5"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1l8 5-8 5z"/></svg>'
      $('status').classList.toggle('paused', !playing)
      $('status-text').textContent = playing
        ? 'Line Running · 600×600 mm'
        : 'Inspection Paused'
    }

    function play() {
      playing = true
      syncPlayback()
      return true
    }

    function pause() {
      playing = false
      syncPlayback()
      return true
    }

    const api: MachineApi = { setMode, focusStation, setCamera, play, pause }
    window.__machine = api
    cleanups.push(() => {
      if (window.__machine === api) delete window.__machine
    })

    root
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => listen(b, 'click', () => setMode(b.dataset.mode ?? '')))
    root
      .querySelectorAll<HTMLElement>('[data-camera]')
      .forEach((b) => listen(b, 'click', () => setCamera(b.dataset.camera ?? '')))
    listen($('play'), 'click', () => (playing ? pause() : play()))

    syncPlayback()
    layoutCamera()

    camera.position.copy(desiredPosition)
    controls.target.copy(desiredTarget)
    controls.update()
    cameraAnimating = false

    listen(window, 'resize', layoutCamera)
    const resizeObserver = new ResizeObserver(() => layoutCamera())
    resizeObserver.observe(root)
    cleanups.push(() => resizeObserver.disconnect())

    controls.addEventListener('start', () => {
      dragging = true
      cameraAnimating = false
      lastInteraction = performance.now()
    })
    controls.addEventListener('end', () => {
      dragging = false
      lastInteraction = performance.now()
    })
    controls.addEventListener('change', () => {
      if (dragging) lastInteraction = performance.now()
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const tooltip = $('tooltip')

    function hitStation(x: number, y: number) {
      pointer.set((x / width) * 2 - 1, (-y / height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(pickables, true)
      return hits.length ? stations.find((s) => s.id === hits[0].object.userData.station) : null
    }

    listen(renderer.domElement, 'pointermove', (e: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      if (Math.hypot(px - downX, py - downY) > 5) wasDragged = true
      if (dragging) return
      const s = hitStation(px, py)
      hovered = s ? s.id : null
      renderer.domElement.style.cursor = s ? 'pointer' : 'grab'
      tooltip.classList.toggle('visible', !!s)
      if (s) {
        tooltip.querySelector('strong')!.innerHTML = `<span>${String(s.step).padStart(2, '0')}</span>${s.name}`
        tooltip.querySelector('p')!.textContent = s.desc
        tooltip.style.left = Math.min(width - 255, Math.max(10, px + 16)) + 'px'
        tooltip.style.top = Math.max(10, Math.min(height - 95, py - 65)) + 'px'
      }
    })

    listen(renderer.domElement, 'pointerleave', () => {
      hovered = null
      tooltip.classList.remove('visible')
    })

    listen(renderer.domElement, 'pointerdown', (e: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      downX = e.clientX - rect.left
      downY = e.clientY - rect.top
      wasDragged = false
      tooltip.classList.remove('visible')
    })

    listen(renderer.domElement, 'pointerup', (e: PointerEvent) => {
      if (wasDragged) return
      const rect = root.getBoundingClientRect()
      const s = hitStation(e.clientX - rect.left, e.clientY - rect.top)
      if (!s) return
      focusStation(s.id)
      options.onStation?.(s.id as StationId)
    })

    listen(document, 'visibilitychange', () => {
      visible = !document.hidden
      lastFrame = performance.now()
    })

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting && !document.hidden
        lastFrame = performance.now()
      },
      { threshold: 0.01 }
    )
    intersectionObserver.observe(renderer.domElement)
    cleanups.push(() => intersectionObserver.disconnect())

    listen(renderer.domElement, 'webglcontextlost', (e: Event) => {
      e.preventDefault()
      contextLost = true
      showError('Graphics context interrupted. Scene will restore once WebGL recovers.')
    })
    listen(renderer.domElement, 'webglcontextrestored', () => {
      contextLost = false
      $('error').style.display = 'none'
      lastFrame = performance.now()
    })

    const journeySteps = [
      ['Tile Infeed', 'Station 01 · Raw vitrified porcelain tile #T-904 arrives'],
      ['Image Capture', 'Station 02 · 4K multi-spectrum LED strobe surface scan'],
      ['AI Vision', 'Station 03 · MobileNetV3 inference & Grad-CAM heatmap localization'],
      ['Human Review', 'Station 04 · Inspector console confirming separation of duties'],
      ['Defect Tracking', 'Station 05 · Defect traveler DEF-0042 logged with root cause'],
      ['Quality Gate', 'Station 06 · Pneumatic diverter sorting Pass vs Hold quarantine'],
      ['Reinspection Loop', 'Station 07 · Post-remediation verification scan'],
    ]

    let prevJourney = -1
    let lastFrame = performance.now()
    let frameCount = 0
    let measureTime = 0
    let pixelRatio = renderer.getPixelRatio()
    let rafId = 0
    const anchor = new THREE.Vector3()

    function animate(now: number) {
      rafId = requestAnimationFrame(animate)
      const dt = Math.max(0, Math.min((now - lastFrame) / 1000, 0.045))
      lastFrame = now
      if (!visible || contextLost) return

      if (playing) {
        simTime += dt
        flightTime += dt
      }

      const t = simTime
      const tact = (t * TAU) / 4
      const smooth = 1 - Math.exp(-dt * 5)

      spread = THREE.MathUtils.lerp(spread, mode === 'stations' ? 1 : 0, smooth)
      cutPlane.constant = THREE.MathUtils.lerp(
        cutPlane.constant,
        mode === 'cutaway' ? 0.98 : 10,
        smooth
      )

      // Station spreading and pulse effect
      stations.forEach((s, i) => {
        s.group.position.copy(s.base)
        s.group.position.x *= 1 + spread * 0.28
        s.group.position.z *= 1 + spread * 0.35
        s.group.position.y += spread * (i % 2 ? 0.35 : 0.55)
        const pulse = Math.pow(Math.max(0, Math.sin(tact - i * 0.9)), 7)
        s.glowMat.emissiveIntensity = THREE.MathUtils.lerp(
          s.glowMat.emissiveIntensity,
          hovered === s.id || (cameraMode === 'station' && selected === s.id)
            ? 3.2
            : 0.45 + pulse * 0.7,
          smooth
        )
      })

      belt.scale.set(1 + spread * 0.12, 1, 1 + spread * 0.15)
      pipes.scale.set(1 + spread * 0.22, 1, 1 + spread * 0.28)

      // Mechanical movements
      gears.forEach(({ g, vertical }, i) => {
        if (vertical) g.rotation.z = t * (i % 2 ? -1 : 1) * 1.2
        else g.rotation.y = t * (i % 2 ? -1 : 1) * 1.2
      })

      // Diverter arm swing
      diverterArm.rotation.y = Math.sin(tact * 0.5) * 0.35

      // Tile conveyor update
      if (t - lastDraw > 1 / 20 || lastDraw < 0) {
        updateBelt(t)
        lastDraw = t
      }

      // Tile positions and phases along conveyor
      tiles.forEach((tile, i) => {
        const phase = (t / 28 + i / tileCount) % 1
        tile.phase = phase

        // Map phase to conveyor path position
        path.getPointAt(phase, tile.group.position)
        path.getTangentAt(phase, tVec)
        tile.group.rotation.set(0, -Math.atan2(tVec.z, tVec.x) + Math.PI / 2, 0)
        tile.group.position.y += 0.44

        // Stage determines which texture is revealed:
        // phase 0 - 0.25: infeed/capture -> stage 0/1
        // phase 0.25 - 0.5: ai vision -> stage 2 (defect bounding box)
        // phase 0.5 - 0.8: review/gate -> stage 3 (qc verified)
        let stage = 0
        if (phase >= 0.18 && phase < 0.35) stage = 1 // Scanning
        else if (phase >= 0.35 && phase < 0.65) stage = 2 // Defect flagged
        else if (phase >= 0.65) stage = 3 // Verified / Reinspected

        if (tile.stage !== stage) {
          tile.faces.forEach((f, j) => (f.visible = j === stage))
          tile.stage = stage
        }

        tile.group.visible = mode !== 'order' || i === 0
        tile.halo.visible = mode === 'order' && i === 0
        tile.group.scale.setScalar(mode === 'order' ? 1.25 : 1)
      })

      // Journey tracker in One Tile mode
      if (mode === 'order') {
        const leadTile = tiles[0]
        const step = Math.min(6, Math.floor(leadTile.phase * 7))
        if (step !== prevJourney) {
          $('journey-title').textContent = journeySteps[step][0]
          $('journey-detail').textContent = journeySteps[step][1]
          prevJourney = step
        }
        $('journey-progress').style.width = leadTile.phase * 100 + '%'
        if (!dragging && playing) {
          desiredTarget.copy(leadTile.group.position)
          desiredPosition.copy(desiredTarget).addScaledVector(viewDirection, mobile ? 11 : 16)
          cameraAnimating = true
        }
      } else if (cameraMode === 'flight' && playing && !dragging) {
        const a = flightTime * 0.12
        const d = baseDistance * (mode === 'stations' ? 1.25 : 1)
        desiredTarget.set(0, 1.2, 0)
        desiredPosition
          .set(
            Math.sin(a + 0.5) * d * 0.85,
            d * (0.55 + Math.sin(a * 0.6) * 0.08),
            Math.cos(a + 0.5) * d * 0.85
          )
          .add(desiredTarget)
        cameraAnimating = true
      } else if (cameraMode === 'station' && cameraAnimating) {
        setCameraGoal()
      }

      if (cameraAnimating && !dragging) {
        const speed = 1 - Math.exp(-dt * (mode === 'order' ? 2.2 : 3.2))
        camera.position.lerp(desiredPosition, speed)
        controls.target.lerp(desiredTarget, speed)
        if (
          cameraMode !== 'flight' &&
          mode !== 'order' &&
          camera.position.distanceTo(desiredPosition) < 0.015 &&
          controls.target.distanceTo(desiredTarget) < 0.015
        ) {
          cameraAnimating = false
        }
      }

      controls.autoRotate =
        playing &&
        !reduceMotion &&
        !dragging &&
        !cameraAnimating &&
        mode !== 'order' &&
        cameraMode === 'overview' &&
        now - lastInteraction > 6500
      controls.autoRotateSpeed = 0.22
      controls.update(dt)

      // Project station HTML labels in Stations mode
      stations.forEach((s) => {
        const show = mode === 'stations'
        s.label.classList.toggle('visible', show)
        if (!show) return
        anchor.copy(s.group.position).add(s.anchor).project(camera)
        let x = (anchor.x * 0.5 + 0.5) * width - 40
        let y = (-anchor.y * 0.5 + 0.5) * height - 52
        x = THREE.MathUtils.clamp(x, 10, width - 150)
        y = THREE.MathUtils.clamp(y, 110, height - 190)
        s.label.style.transform = `translate(${x}px,${y}px)`
      })

      renderer.render(scene, camera)

      if (!readySent && sized) {
        readySent = true
        options.onReady?.()
      }

      if (playing) {
        frameCount++
        measureTime += dt
        if (measureTime > 4) {
          if (frameCount / measureTime < 42 && pixelRatio > 1) {
            pixelRatio = Math.max(1, pixelRatio - 0.25)
            renderer.setPixelRatio(pixelRatio)
          }
          frameCount = 0
          measureTime = 0
        }
      }
    }

    rafId = requestAnimationFrame(animate)

    cleanups.push(() => {
      cancelAnimationFrame(rafId)
      controls.dispose()
      const textures = new Set<THREE.Texture>()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const list = mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : []
        for (const material of list) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) textures.add(value)
          }
          material.dispose()
        }
      })
      geometries.forEach((g) => g.dispose())
      textures.forEach((t) => t.dispose())
      env.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    })

    renderer.compile(scene, camera)

    $('loading').classList.add('done')
    $('error').style.display = 'none'

    Object.defineProperty(window, '__machineDebug', {
      value: {
        getState: () => ({
          mode,
          camera: cameraMode,
          playing,
          time: simTime,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          stations: stations.map((s) => ({ id: s.id, name: s.name })),
        }),
      },
      configurable: true,
    })
    cleanups.push(() => {
      delete window.__machineDebug
    })
  } catch (error) {
    console.error('ForgeSight 3D Line: failed to start', error)
    showError()
  }

  return dispose
}

// ---------------------------------------------------------------------------
// Scoped Styles for the 3D Component
// ---------------------------------------------------------------------------
const STYLES = String.raw`
.agentic-factory-3d {
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #090b10;
  color-scheme: dark;
  --bg: #090b10;
  --white: #f8fafc;
  --amber: #f59e0b;
  --cyan: #06b6d4;
  --line: rgba(248, 250, 252, 0.1);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--white);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}
.agentic-factory-3d, .agentic-factory-3d * {
  box-sizing: border-box;
}
.agentic-factory-3d #scene {
  position: absolute;
  inset: 0;
  touch-action: none;
  outline: none;
}
.agentic-factory-3d #scene canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.agentic-factory-3d .vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 50%,
    transparent 35%,
    rgba(9, 11, 16, 0.3) 65%,
    rgba(9, 11, 16, 0.85) 100%
  );
}
.agentic-factory-3d .topbar {
  position: absolute;
  inset: 20px 24px auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
  z-index: 10;
}
.agentic-factory-3d .identity {
  display: flex;
  gap: 12px;
  align-items: center;
}
.agentic-factory-3d .mark {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--amber);
  background: rgba(24, 32, 47, 0.85);
  backdrop-filter: blur(8px);
}
.agentic-factory-3d .identity strong {
  display: block;
  font-weight: 700;
  letter-spacing: -0.2px;
  font-size: 13px;
  color: #f1f5f9;
  font-family: ui-monospace, Menlo, monospace;
}
.agentic-factory-3d .identity small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  letter-spacing: 1px;
  color: #94a3b8;
  text-transform: uppercase;
}
.agentic-factory-3d .status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.75);
  padding: 6px 12px;
  border-radius: 9999px;
  border: 1px solid rgba(51, 65, 85, 0.6);
  backdrop-filter: blur(8px);
  font-family: ui-monospace, Menlo, monospace;
}
.agentic-factory-3d .status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
}
.agentic-factory-3d .status.paused i {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}
.agentic-factory-3d .status span:last-child {
  color: #64748b;
  margin-left: 8px;
}
.agentic-factory-3d .scene-heading {
  position: absolute;
  top: 72px;
  left: 24px;
  right: 24px;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #94a3b8;
  text-transform: uppercase;
  font-family: ui-monospace, Menlo, monospace;
}
.agentic-factory-3d .scene-heading:before {
  content: '';
  width: 20px;
  height: 2px;
  background: var(--amber);
}
.agentic-factory-3d .scene-heading .index {
  margin-left: auto;
  color: #64748b;
}
.agentic-factory-3d .coordinates {
  position: absolute;
  top: 105px;
  right: 24px;
  color: #475569;
  writing-mode: vertical-rl;
  font: 9px ui-monospace, Menlo, monospace;
  letter-spacing: 1.6px;
  pointer-events: none;
}
.agentic-factory-3d .controls {
  position: absolute;
  bottom: 60px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12px;
  z-index: 15;
}
.agentic-factory-3d .mode-bar {
  display: flex;
  gap: 3px;
  align-items: center;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(18, 24, 38, 0.9);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
}
.agentic-factory-3d .mode-bar button {
  border: 0;
  background: none;
  color: #94a3b8;
  white-space: nowrap;
  padding: 8px 14px;
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.agentic-factory-3d .mode-bar button:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}
.agentic-factory-3d .mode-bar button[aria-pressed='true'] {
  background: var(--amber);
  color: #0f172a;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
}
.agentic-factory-3d svg {
  flex-shrink: 0;
  display: block;
}
.agentic-factory-3d .mode-bar svg {
  width: 14px;
  height: 14px;
}
.agentic-factory-3d .camera-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(15, 23, 42, 0.7);
  padding: 3px 8px;
  border-radius: 9999px;
  border: 1px solid rgba(51, 65, 85, 0.5);
  backdrop-filter: blur(8px);
}
.agentic-factory-3d .camera-row .caption {
  font-size: 9px;
  letter-spacing: 1.2px;
  color: #64748b;
  margin-right: 6px;
  font-family: ui-monospace, Menlo, monospace;
}
.agentic-factory-3d .camera-row button {
  border: 0;
  background: transparent;
  color: #94a3b8;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.2s;
}
.agentic-factory-3d .camera-row button:hover,
.agentic-factory-3d .camera-row button[aria-pressed='true'] {
  color: #f8fafc;
  font-weight: 600;
}
.agentic-factory-3d .camera-row button[aria-pressed='true']:after {
  content: '';
  display: block;
  width: 3px;
  height: 3px;
  background: var(--amber);
  border-radius: 50%;
  margin: 3px auto -5px;
}
.agentic-factory-3d .camera-row .divider {
  width: 1px;
  height: 12px;
  background: var(--line);
  margin: 0 6px;
}
.agentic-factory-3d .camera-row #play {
  padding: 4px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
}
.agentic-factory-3d .footer {
  position: absolute;
  bottom: 16px;
  left: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}
.agentic-factory-3d .wordmark {
  font-size: 11px;
  color: #64748b;
  pointer-events: auto;
  font-family: ui-monospace, Menlo, monospace;
}
.agentic-factory-3d .wordmark span {
  color: #94a3b8;
}
.agentic-factory-3d .hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 10px;
}
.agentic-factory-3d .footer-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font: 9px ui-monospace, Menlo, monospace;
  letter-spacing: 1.4px;
  color: #475569;
}
@media (max-width: 1150px) {
  .agentic-factory-3d .footer-center {
    display: none;
  }
}
.agentic-factory-3d #labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.agentic-factory-3d .station-label {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  transition: opacity 0.3s;
  will-change: transform;
  pointer-events: none;
  min-width: 140px;
}
.agentic-factory-3d .station-label.visible {
  opacity: 1;
}
.agentic-factory-3d .station-label .stem {
  height: 24px;
  width: 1px;
  background: linear-gradient(rgba(245, 158, 11, 0), rgba(245, 158, 11, 0.7));
  margin: 0 0 0 10px;
}
.agentic-factory-3d .station-label .label-card {
  background: rgba(18, 24, 38, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}
.agentic-factory-3d .station-label .label-title {
  font-weight: 700;
  font-size: 11px;
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
}
.agentic-factory-3d .station-label .label-title span {
  color: var(--amber);
  font: 9px ui-monospace, Menlo, monospace;
}
.agentic-factory-3d .station-label .label-meta {
  font-size: 9px;
  color: #94a3b8;
  margin: 4px 0 0 20px;
  white-space: nowrap;
}
.agentic-factory-3d #tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(18, 24, 38, 0.95);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  max-width: 250px;
}
.agentic-factory-3d #tooltip.visible {
  opacity: 1;
}
.agentic-factory-3d #tooltip strong {
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
}
.agentic-factory-3d #tooltip strong span {
  font-size: 10px;
  color: var(--amber);
  margin-right: 8px;
  font-family: ui-monospace, Menlo, monospace;
}
.agentic-factory-3d #tooltip p {
  font-size: 11px;
  color: #94a3b8;
  margin: 5px 0 0;
  line-height: 1.45;
}
.agentic-factory-3d #journey {
  position: absolute;
  left: 20%;
  right: 20%;
  top: 100px;
  opacity: 0;
  transform: translateY(-5px);
  transition: 0.4s;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(18, 24, 38, 0.85);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.3);
  backdrop-filter: blur(12px);
}
.agentic-factory-3d #journey.visible {
  opacity: 1;
  transform: none;
}
.agentic-factory-3d .journey-icon {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--amber);
  background: rgba(245, 158, 11, 0.1);
}
.agentic-factory-3d #journey strong {
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
}
.agentic-factory-3d #journey small {
  display: block;
  font-size: 10px;
  margin-top: 2px;
  color: #94a3b8;
}
.agentic-factory-3d #journey .track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  flex: 1;
  border-radius: 2px;
  overflow: hidden;
  margin-left: 8px;
}
.agentic-factory-3d #journey .track i {
  display: block;
  height: 100%;
  background: var(--amber);
  width: 0;
  border-radius: 2px;
}
.agentic-factory-3d #loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 12px;
  transition: opacity 0.4s;
  z-index: 30;
}
.agentic-factory-3d #loading i {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  border: 2px solid rgba(245, 158, 11, 0.2);
  border-top-color: var(--amber);
  animation: agentic-spin 1s linear infinite;
}
@keyframes agentic-spin {
  to { transform: rotate(360deg); }
}
.agentic-factory-3d #loading.done {
  opacity: 0;
  pointer-events: none;
}
.agentic-factory-3d #error {
  position: absolute;
  left: 20%;
  right: 20%;
  top: 40%;
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: #111827;
  padding: 24px;
  border-radius: 12px;
  display: none;
  font-size: 13px;
  line-height: 1.6;
  z-index: 30;
}
.agentic-factory-3d #error strong {
  color: #ef4444;
  font-weight: 700;
}
.agentic-factory-3d #error p {
  color: #9ca3af;
  margin: 6px 0 0;
}
.agentic-factory-3d #error button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: #1f2937;
  color: #f3f4f6;
  padding: 8px 16px;
  border-radius: 6px;
  margin-top: 14px;
  cursor: pointer;
}
.agentic-factory-3d.embed .debug-ui {
  display: none !important;
}
.agentic-factory-3d.embed .vignette {
  background: radial-gradient(
    ellipse at 70% 50%,
    transparent 35%,
    rgba(9, 11, 16, 0.25) 65%,
    rgba(9, 11, 16, 0.75) 100%
  );
}
@media (max-width: 900px) {
  .agentic-factory-3d .scene-heading {
    left: 16px;
    right: 16px;
    font-size: 9px;
  }
  .agentic-factory-3d .coordinates {
    display: none;
  }
  .agentic-factory-3d .controls {
    bottom: 55px;
    left: 10px;
    right: 10px;
  }
  .agentic-factory-3d .mode-bar button {
    padding: 8px 10px;
    font-size: 10px;
  }
  .agentic-factory-3d #journey {
    left: 16px;
    right: 16px;
    top: 96px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .agentic-factory-3d, .agentic-factory-3d * {
    transition: none !important;
  }
  .agentic-factory-3d #loading i {
    animation: none;
  }
}
`
