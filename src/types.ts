export type LayoutMode = 'single' | 'threeViews' | 'collection';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9';
export type TextStyle = 'Standard' | 'Comic' | 'Script';

export interface StickerStyle {
  id: string;
  name: string;
  label: string;
  promptModifier: string;
  color: string;
}

export interface PromptConfig {
  subject: string;
  styleId: string;
  layoutMode: LayoutMode;
  collectionCount: number;
  collectionItems: string[];
  aspectRatio: AspectRatio;
  includeText: boolean;
  text: string;
  textStyle: TextStyle;
  useBorder: boolean;
  backgroundEnabled: boolean;
  backgroundColor: string;
  facialFeatures: boolean;
  referenceEnabled: boolean;
}

export interface StickerImage {
  id: string;
  dataUrl: string;
  name: string;
  prompt: string;
  createdAt: number;
  pieces?: StickerPiece[];
}

export interface StickerPiece {
  id: string;
  dataUrl: string;
  index: number;
  sourceDataUrl: string;
  sourceBox: ImageCropBox;
  cropAdjustments?: CropAdjustments;
}

export interface SplitPiece {
  dataUrl: string;
  box: ImageCropBox;
  sourceDataUrl: string;
}

export interface ImageCropBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CropAdjustments {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
