import type { AspectRatio, PromptConfig, StickerStyle, TextStyle } from './types';

export const stickerStyles: StickerStyle[] = [
  {
    id: 'classic-cartoon',
    name: 'Classic Cartoon',
    label: '经典卡通',
    promptModifier: 'vibrant flat cartoon sticker, thick bold black outlines, simple shading, vector art style, cute and expressive',
    color: '#f59e0b',
  },
  {
    id: 'kawaii-chibi',
    name: 'Kawaii Chibi',
    label: '可爱Q版',
    promptModifier: 'adorable kawaii chibi sticker, pastel colors, giant sparkling eyes, soft rounded shapes, bubbly aesthetic, white outline',
    color: '#ec4899',
  },
  {
    id: '3d-glossy',
    name: '3D Glossy',
    label: '3D 光泽',
    promptModifier: '3D rendered toy sticker, plastic glossy texture, claymation style, soft studio lighting, cute character design, volumetric',
    color: '#3b82f6',
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    label: '像素艺术',
    promptModifier: 'pixel art sticker, 8-bit retro game style, blocky details, limited color palette, clean edges, white outline',
    color: '#8b5cf6',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    label: '水彩画',
    promptModifier: 'watercolor painted sticker, artistic brush strokes, soft gradients, paper texture, dreamy and whimsical, hand-painted look',
    color: '#14b8a6',
  },
  {
    id: 'anime',
    name: 'Anime',
    label: '日系动漫',
    promptModifier: 'anime manga sticker, cel shaded, vibrant japanese animation style, expressive, clean lines',
    color: '#fb7185',
  },
  {
    id: 'vintage-badge',
    name: 'Vintage Badge',
    label: '复古徽章',
    promptModifier: 'retro vintage sticker, muted color palette, textured paper feel, 70s badge style, distressed look, typography elements',
    color: '#ea580c',
  },
  {
    id: 'paper-cutout',
    name: 'Paper Cutout',
    label: '剪纸艺术',
    promptModifier: 'layered paper cutout style sticker, craft art, textured paper, depth shadows, handmade feel',
    color: '#84cc16',
  },
];

export const aspectRatios: Array<{ value: AspectRatio; label: string }> = [
  { value: '1:1', label: '正方形 1:1' },
  { value: '3:4', label: '竖图 3:4' },
  { value: '4:3', label: '横图 4:3' },
  { value: '16:9', label: '宽屏 16:9' },
];

export const textStyles: Array<{ value: TextStyle; label: string; fontFamily: string; promptName: string }> = [
  { value: 'Standard', label: 'Standard', fontFamily: 'Fredoka, sans-serif', promptName: 'clean rounded standard display' },
  { value: 'Comic', label: 'Comic', fontFamily: 'Bangers, cursive', promptName: 'bold playful comic lettering' },
  { value: 'Script', label: 'Script', fontFamily: 'Pacifico, cursive', promptName: 'flowing hand-lettered script' },
];

export const defaultConfig: PromptConfig = {
  subject: '一只戴着宇航头盔的橘猫',
  styleId: 'classic-cartoon',
  layoutMode: 'collection',
  collectionCount: 9,
  collectionItems: ['', '', '', '', '', '', '', '', ''],
  aspectRatio: '1:1',
  includeText: false,
  text: '',
  textStyle: 'Standard',
  useBorder: true,
  backgroundEnabled: false,
  backgroundColor: 'white',
  facialFeatures: true,
  referenceEnabled: false,
};

export const buildStickerPrompt = (config: PromptConfig) => {
  const style = stickerStyles.find((item) => item.id === config.styleId) || stickerStyles[0];
  const requestedCollectionItems = config.collectionItems.map((item) => item.trim()).filter(Boolean);
  const stickerCollectionItemCount = Math.max(2, Math.min(12, config.collectionCount || requestedCollectionItems.length || 6));

  const textInstruction = config.includeText
    ? config.text.trim()
      ? `Important: The image MUST include the text "${config.text.trim()}" written prominently in a ${config.textStyle} font style. Text style: with a thick white outline/border.`
      : `Important: Include short, relevant sticker text chosen by you. The text should fit the subject and be written prominently in a ${config.textStyle} font style. Text style: with a thick white outline/border.`
    : 'Strictly NO text, NO letters, NO numbers, and NO typography in the image. The image must be purely visual.';

  const faceInstruction = config.facialFeatures
    ? 'Facial features (eyes, mouth, expressions) are permitted and encouraged to convey character/emotion.'
    : 'STRICTLY NO FACES. Do NOT generate any facial features (eyes, nose, mouth). The subject must be faceless, shown from behind, or obscured. If the subject is an object, do not anthropomorphize it with a face.';

  const promptBgColor = config.backgroundEnabled
    ? config.backgroundColor || 'white'
    : config.useBorder
      ? 'black'
      : 'white';
  const bgInstruction = `Isolated on a solid ${promptBgColor} background`;

  let viewInstruction = 'sticker design, high quality vector graphics, centered composition';

  if (config.layoutMode === 'collection') {
    viewInstruction = `Sticker Collection Sheet: Generate exactly ${stickerCollectionItemCount} distinct small stickers on one single canvas. They must feel like one coherent series with a unified character language, consistent color palette, matching line weight, and related poses/expressions/objects. Arrange the stickers in a clean grid or loose sticker-sheet layout with generous spacing between each mini sticker, no overlap, and no cropped edges. Each mini sticker should be complete and individually usable.`;

    if (requestedCollectionItems.length > 0) {
      viewInstruction += ` The mini stickers must follow this exact subject list, one mini sticker per item, in reading order: ${requestedCollectionItems.map((item, index) => `${index + 1}. ${item}`).join('; ')}. Do not omit listed items.`;
      if (requestedCollectionItems.length < stickerCollectionItemCount) {
        viewInstruction += ` Add ${stickerCollectionItemCount - requestedCollectionItems.length} additional related mini stickers to reach the requested count.`;
      }
    }

    if (config.useBorder) {
      viewInstruction += ' Give every mini sticker its own die-cut white border/outline.';
    } else {
      viewInstruction += ' Keep every mini sticker borderless with no white outline.';
    }
  } else if (config.useBorder) {
    viewInstruction += ', die-cut sticker with a thick white border/outline surrounding the subject';
  } else {
    viewInstruction += ', borderless, strictly NO white outline, NO die-cut border, edge-to-edge design';
  }

  if (config.layoutMode === 'threeViews') {
    viewInstruction = 'Character Reference Sheet: Generate a formal three-view orthographic drawing (Three Divisions/Three Views). The image must display the SUBJECT from three distinct angles: Front View, Side View, and Back View. Arrange them horizontally in a clean, professional layout. Maintain consistent character details, proportions, and style across all views.';

    if (!config.useBorder) {
      viewInstruction += ' Do not add white sticker outlines around the characters.';
    }
  }

  const reference = config.referenceEnabled
    ? ' Use the provided image as the primary visual reference for the subject, pose, and composition. Re-create it strictly following the requested Style and Subject.'
    : '';

  return [
    `Style: ${style.promptModifier}.`,
    `Subject: ${config.subject.trim() || 'a cute sticker subject'}.`,
    faceInstruction,
    textInstruction,
    `Visuals: ${bgInstruction}, ${viewInstruction}`,
  ].join('\n') + reference;
};
