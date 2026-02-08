export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  ROTATE = 'ROTATE',
  SCALE = 'SCALE',
  CROP = 'CROP',
  RESULT = 'RESULT',
}

export interface ProcessingOptions {
  assumeEqualTilt: boolean;
  assumeEqualZoom: boolean;
  assumeEqualFraming: boolean;
  rotateLeftImage: boolean; // if false, rotate right
}

export interface ProcessedImages {
  left: HTMLCanvasElement | null;
  right: HTMLCanvasElement | null;
}
