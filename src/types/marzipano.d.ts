declare module 'marzipano' {
  export interface ViewerOptions {
    controls?: {
      mouseViewMode?: 'drag' | 'qtvr'
    }
  }

  export interface ViewLimiter {
    (params: { yaw: number; pitch: number; fov: number }): { yaw: number; pitch: number; fov: number }
  }

  export interface ViewParams {
    yaw: number
    pitch: number
    fov: number
  }

  export interface HotspotPosition {
    yaw: number
    pitch: number
  }

  export interface ScreenCoords {
    x: number
    y: number
  }

  export class RectilinearView {
    constructor(params: ViewParams, limiter?: ViewLimiter)
    yaw(): number
    pitch(): number
    fov(): number
    setYaw(yaw: number): void
    setPitch(pitch: number): void
    setFov(fov: number): void
    screenToCoordinates(coords: ScreenCoords): { yaw: number; pitch: number } | null
    addEventListener(event: string, handler: () => void): void
    removeEventListener(event: string, handler: () => void): void

    static limit: {
      traditional(maxRes: number, maxFov: number): ViewLimiter
    }
  }

  export class EquirectGeometry {
    constructor(levels: Array<{ width: number }>)
  }

  export class ImageUrlSource {
    static fromString(url: string): ImageUrlSource
  }

  export interface HotspotContainer {
    createHotspot(element: HTMLElement, position: HotspotPosition): void
  }

  export interface Scene {
    view(): RectilinearView
    hotspotContainer(): HotspotContainer
    switchTo(options?: { transitionDuration?: number }): void
    destroy(): void
  }

  export interface SceneOptions {
    source: ImageUrlSource
    geometry: EquirectGeometry
    view: RectilinearView
    pinFirstLevel?: boolean
  }

  export interface Stage {
    addEventListener(event: string, handler: () => void): void
    removeEventListener(event: string, handler: () => void): void
  }

  export class Viewer {
    constructor(container: HTMLElement, options?: ViewerOptions)
    createScene(options: SceneOptions): Scene
    stage(): Stage
    destroy(): void
  }
}
