import type { Quaternion, Vector3 } from "../core/coordinates/CoordinateFrames.js";

export interface RenderEntitySnapshot {
  readonly entityId: string;
  readonly assetId: string;
  readonly worldPositionMetres: Vector3;
  readonly bodyToWorldOrientation: Quaternion;
  readonly animationState?: Readonly<Record<string, number>>;
}

export interface RenderSnapshot {
  readonly simulationTick: number;
  readonly simulationTimeSeconds: number;
  readonly entities: readonly RenderEntitySnapshot[];
}

export interface RendererPort {
  readonly rendererId: string;
  initialize(canvas: HTMLCanvasElement): Promise<void>;
  resize(widthCssPixels: number, heightCssPixels: number, devicePixelRatio: number): void;
  render(snapshot: RenderSnapshot, interpolationAlpha: number): void;
  dispose(): void;
}
