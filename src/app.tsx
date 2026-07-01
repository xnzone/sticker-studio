import { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Eraser,
  FileArchive,
  ImagePlus,
  Loader2,
  Layers,
  LayoutPanelLeft,
  type LucideIcon,
  Scissors,
  Sticker,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { aspectRatios, buildStickerPrompt, defaultConfig, stickerStyles, textStyles } from './prompt';
import type { CropAdjustments, LayoutMode, PromptConfig, SplitPiece, StickerImage, StickerPiece } from './types';
import {
  downloadDataUrl,
  downloadZip,
  fileToDataUrl,
  recropStickerFromSource,
  repairTransparency,
  splitAuto,
  splitGrid,
  validateImageDataUrl,
} from './image-processing';
import logoUrl from './assets/meme-helper-free.svg';

const backgroundOptions = ['white', 'black', '#fce7f3', '#dbeafe', '#dcfce7', '#fef3c7'];

const zeroCrop: CropAdjustments = { top: 0, right: 0, bottom: 0, left: 0 };

const makePieces = (pieces: SplitPiece[]): StickerPiece[] => pieces.map((piece, index) => ({
  id: crypto.randomUUID(),
  dataUrl: piece.dataUrl,
  index: index + 1,
  sourceDataUrl: piece.sourceDataUrl,
  sourceBox: piece.box,
  cropAdjustments: zeroCrop,
}));

const updateCollectionLength = (items: string[], count: number) => (
  Array.from({ length: count }, (_, index) => items[index] || '')
);

export default function App() {
  const [config, setConfig] = useState<PromptConfig>(defaultConfig);
  const [images, setImages] = useState<StickerImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState(2);
  const [gridColumns, setGridColumns] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [cropAdjustments, setCropAdjustments] = useState<CropAdjustments>(zeroCrop);
  const [copied, setCopied] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [collectionItemsOpen, setCollectionItemsOpen] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const activeImage = images.find((image) => image.id === activeImageId) || images[0];
  const prompt = useMemo(() => buildStickerPrompt(config), [config]);
  const activeStyle = stickerStyles.find((style) => style.id === config.styleId) || stickerStyles[0];
  const allPieces = activeImage?.pieces || [];
  const filledCollectionItems = config.collectionItems.filter((item) => item.trim()).length;
  const layoutOptions: Array<{ value: LayoutMode; label: string; icon: LucideIcon }> = [
    { value: 'single', label: '单张', icon: Sticker },
    { value: 'threeViews', label: '三视图', icon: LayoutPanelLeft },
    { value: 'collection', label: '贴纸组', icon: Layers },
  ];
  const cropTarget = allPieces.find((piece) => piece.id === cropTargetId) || null;
  const cropFrameStyle = useMemo(() => {
    const toInset = (value: number) => `${Math.max(0, Math.min(48, 14 + value))}%`;
    return {
      top: toInset(cropAdjustments.top),
      right: toInset(cropAdjustments.right),
      bottom: toInset(cropAdjustments.bottom),
      left: toInset(cropAdjustments.left),
    };
  }, [cropAdjustments]);

  const patchConfig = <Key extends keyof PromptConfig>(key: Key, value: PromptConfig[Key]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const setLayout = (layoutMode: LayoutMode) => {
    setConfig((prev) => ({ ...prev, layoutMode }));
  };

  const setCollectionCount = (nextCount: number) => {
    const collectionCount = Math.max(2, Math.min(12, Math.round(nextCount || 2)));
    setConfig((prev) => ({
      ...prev,
      collectionCount,
      collectionItems: updateCollectionLength(prev.collectionItems, collectionCount),
    }));
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleReferenceUpload = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await fileToDataUrl(file);
    setReferenceImage(dataUrl);
    patchConfig('referenceEnabled', true);
    if (referenceInputRef.current) referenceInputRef.current.value = '';
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    patchConfig('referenceEnabled', false);
    if (referenceInputRef.current) referenceInputRef.current.value = '';
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const uploaded: StickerImage[] = [];
    const failed: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await fileToDataUrl(file);
        await validateImageDataUrl(dataUrl);
        uploaded.push({
          id: crypto.randomUUID(),
          dataUrl,
          name: file.name.replace(/\.[^.]+$/, ''),
          prompt,
          createdAt: Date.now(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '图片读取失败';
        failed.push(`${file.name}: ${message}`);
      }
    }

    if (uploaded.length > 0) {
      setImages((prev) => [...uploaded, ...prev]);
      setActiveImageId(uploaded[0].id);
    }

    if (failed.length > 0) setError(failed.join('；'));

    if (inputRef.current) inputRef.current.value = '';
  };

  const updateImage = (id: string, updater: (image: StickerImage) => StickerImage) => {
    setImages((prev) => prev.map((image) => (image.id === id ? updater(image) : image)));
  };

  const runRepair = async () => {
    if (!activeImage) return;
    setBusy('repair');
    setError('');
    try {
      const dataUrl = await repairTransparency(activeImage.dataUrl, config.backgroundColor);
      updateImage(activeImage.id, (image) => ({ ...image, dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '透明背景处理失败');
    } finally {
      setBusy(null);
    }
  };

  const runAutoSplit = async () => {
    if (!activeImage) return;
    setBusy('auto');
    setError('');
    try {
      const pieces = await splitAuto(activeImage.dataUrl, config.collectionCount, config.backgroundColor);
      if (pieces.length === 0) throw new Error('没有识别到可切分的贴纸，请改用网格切分。');
      updateImage(activeImage.id, (image) => ({ ...image, pieces: makePieces(pieces) }));
      setCropTargetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动切分失败');
    } finally {
      setBusy(null);
    }
  };

  const runGridSplit = async () => {
    if (!activeImage) return;
    setBusy('grid');
    setError('');
    try {
      const pieces = await splitGrid(activeImage.dataUrl, gridRows, gridColumns, config.backgroundColor);
      updateImage(activeImage.id, (image) => ({ ...image, pieces: makePieces(pieces) }));
      setCropTargetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网格切分失败');
    } finally {
      setBusy(null);
    }
  };

  const deleteImage = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
    if (activeImageId === id) setActiveImageId(null);
  };

  const openCropEditor = (piece: StickerPiece) => {
    setCropTargetId(piece.id);
    setCropAdjustments(piece.cropAdjustments || zeroCrop);
  };

  const applyCrop = async () => {
    if (!activeImage || !cropTarget) return;
    setBusy('crop');
    setError('');
    try {
      const dataUrl = await recropStickerFromSource(cropTarget.sourceDataUrl, cropTarget.sourceBox, cropAdjustments);
      updateImage(activeImage.id, (image) => ({
        ...image,
        pieces: image.pieces?.map((piece) => (
          piece.id === cropTarget.id ? { ...piece, dataUrl, cropAdjustments } : piece
        )),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '手动裁剪失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="app-shell">
      <section className="control-pane">
        <header className="brand">
          <img className="brand-mark" src={logoUrl} alt="" />
          <div>
            <h1>表情包不求人</h1>
            <p>打造自己或者情侣专属表情包有手就行</p>
          </div>
        </header>

        <div className="section">
          <label className="label" htmlFor="subject">贴纸主题</label>
          <textarea
            id="subject"
            className="textarea"
            value={config.subject}
            rows={4}
            onChange={(event) => patchConfig('subject', event.target.value)}
            placeholder="例如：一只戴着宇航头盔的橘猫"
          />
        </div>

        <div className="section">
          <span className="label">风格</span>
          <button
            className={`style-select ${stylePickerOpen ? 'open' : ''}`}
            type="button"
            onClick={() => setStylePickerOpen((prev) => !prev)}
          >
            <span className="swatch" style={{ background: activeStyle.color }} />
            <span>
              <strong>{activeStyle.label}</strong>
              <small>{activeStyle.name}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {stylePickerOpen && (
            <div className="style-options">
              {stickerStyles.map((style) => (
                <button
                  key={style.id}
                  className={`style-option ${config.styleId === style.id ? 'selected' : ''}`}
                  type="button"
                  onClick={() => {
                    patchConfig('styleId', style.id);
                    setStylePickerOpen(false);
                  }}
                >
                  <span className="swatch" style={{ background: style.color }} />
                  <span>
                    <strong>{style.label}</strong>
                    <small>{style.name}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="section section-card">
          <span className="label">布局</span>
          <div className="layout-segmented">
            {layoutOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={config.layoutMode === value ? 'active' : ''}
                onClick={() => setLayout(value as LayoutMode)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {config.layoutMode === 'collection' && (
          <div className="section">
            <div className="inline-row">
              <label className="label" htmlFor="count">贴纸数量</label>
              <div className="count-controls">
                {[4, 6, 9].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={config.collectionCount === count ? 'active' : ''}
                    onClick={() => setCollectionCount(count)}
                  >
                    {count}
                  </button>
                ))}
                <input
                  id="count"
                  className="number"
                  type="number"
                  min={2}
                  max={12}
                  value={config.collectionCount}
                  onChange={(event) => setCollectionCount(Number(event.target.value))}
                />
              </div>
            </div>
            <button
              className={`collection-toggle ${collectionItemsOpen ? 'open' : ''}`}
              type="button"
              onClick={() => setCollectionItemsOpen((prev) => !prev)}
            >
              <span>
                <strong>逐张描述</strong>
                <small>可选，默认让 AI 自己分配</small>
              </span>
              {filledCollectionItems > 0 && <em>{filledCollectionItems}/{config.collectionCount}</em>}
              <ChevronDown size={16} />
            </button>
            {collectionItemsOpen && (
              <div className="collection-items">
                {config.collectionItems.map((item, index) => (
                  <input
                    key={index}
                    className="input"
                    value={item}
                    onChange={(event) => {
                      const next = [...config.collectionItems];
                      next[index] = event.target.value;
                      patchConfig('collectionItems', next);
                    }}
                    placeholder={`第 ${index + 1} 个贴纸描述，可留空`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="section two-col">
          <div>
            <span className="label">画幅</span>
            <select className="select" value={config.aspectRatio} onChange={(event) => patchConfig('aspectRatio', event.target.value as PromptConfig['aspectRatio'])}>
              {aspectRatios.map((ratio) => (
                <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">背景参考</span>
            <select className="select" value={config.backgroundColor} onChange={(event) => patchConfig('backgroundColor', event.target.value)}>
              {backgroundOptions.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="section reference-card">
          <div className="reference-head">
            <div>
              <span className="label">参考图</span>
              <p>用于外部生成平台的图生图/参考图上传。</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={config.referenceEnabled}
                onChange={(event) => patchConfig('referenceEnabled', event.target.checked)}
              />
              <span />
            </label>
          </div>
          <input
            ref={referenceInputRef}
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => handleReferenceUpload(event.target.files?.[0])}
          />
          {referenceImage ? (
            <div className="reference-preview">
              <img src={referenceImage} alt="参考图" />
              <div className="reference-actions">
                <button type="button" onClick={() => referenceInputRef.current?.click()}>
                  <Upload size={16} />
                  替换
                </button>
                <button type="button" onClick={clearReferenceImage}>
                  <Trash2 size={16} />
                  清除
                </button>
              </div>
            </div>
          ) : (
            <button className="reference-upload" type="button" onClick={() => referenceInputRef.current?.click()}>
              <ImagePlus size={24} />
              上传参考图
            </button>
          )}
        </div>

        <div className={`section text-card ${config.includeText ? 'enabled' : ''}`}>
          <div className="text-head">
            <div className="text-title">
              <Type size={20} />
              <span>文字</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={config.includeText}
                onChange={(event) => patchConfig('includeText', event.target.checked)}
              />
              <span />
            </label>
          </div>
          {config.includeText && (
            <div className="text-body">
              <input
                className="input text-input"
                value={config.text}
                onChange={(event) => patchConfig('text', event.target.value)}
                placeholder="输入文字，留空则由 AI 自己决定"
              />
              <div className="text-style-segmented">
                {textStyles.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    className={config.textStyle === style.value ? 'active' : ''}
                    style={{ fontFamily: style.fontFamily }}
                    onClick={() => patchConfig('textStyle', style.value)}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="section checks">
          <label className="check-option"><input type="checkbox" checked={config.useBorder} onChange={(event) => patchConfig('useBorder', event.target.checked)} /> 白色贴纸边</label>
          <label className="check-option"><input type="checkbox" checked={config.backgroundEnabled} onChange={(event) => patchConfig('backgroundEnabled', event.target.checked)} /> 在 prompt 中要求纯色背景</label>
          <label className="check-option"><input type="checkbox" checked={config.facialFeatures} onChange={(event) => patchConfig('facialFeatures', event.target.checked)} /> 强调面部表情</label>
        </div>
      </section>

      <section className="workspace">
        <div className="prompt-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>复制 Prompt 到任意图片生成平台</h2>
            </div>
            <button className="primary-button" type="button" onClick={copyPrompt}>
              {copied ? <Check size={18} /> : <Clipboard size={18} />}
              {copied ? '已复制' : '复制 Prompt'}
            </button>
          </div>
          <pre className="prompt-output">{prompt}</pre>
          <div className="prompt-meta">
            <span>{activeStyle.label}</span>
            <span>{config.aspectRatio}</span>
            <span>{config.layoutMode === 'collection' ? `${config.collectionCount} 张` : '单图流程'}</span>
            {config.referenceEnabled && <span>需要同时上传参考图</span>}
          </div>
          {config.referenceEnabled && (
            <div className="reference-note">
              <strong>参考图不是文字 prompt 的附件。</strong>
              复制 prompt 后，需要在 Midjourney、ChatGPT、Gemini、即梦等平台里把这张参考图一起上传。
            </div>
          )}
        </div>

        <div className="upload-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>上传生成后的图片</h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
              <Upload size={18} />
              上传图片
            </button>
            <input ref={inputRef} hidden type="file" accept="image/*" multiple onChange={(event) => handleUpload(event.target.files)} />
          </div>

          {!activeImage ? (
            <button className="dropzone" type="button" onClick={() => inputRef.current?.click()}>
              <ImagePlus size={42} />
              <span>把生成好的贴纸图上传到这里</span>
            </button>
          ) : (
            <div className="image-workbench">
              <aside className="image-list">
                {images.map((image) => (
                  <button
                    key={image.id}
                    className={`thumb ${activeImage.id === image.id ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveImageId(image.id)}
                  >
                    <img src={image.dataUrl} alt={image.name} />
                    <span>{image.name}</span>
                  </button>
                ))}
              </aside>
              <div className="preview-area checkerboard">
                <img src={activeImage.dataUrl} alt={activeImage.name} />
              </div>
              <aside className="tools">
                <button className="tool-button" type="button" disabled={Boolean(busy)} onClick={runRepair}>
                  {busy === 'repair' ? <Loader2 className="spin" size={18} /> : <Eraser size={18} />}
                  去背景
                </button>
                <button className="tool-button" type="button" disabled={Boolean(busy)} onClick={runAutoSplit}>
                  {busy === 'auto' ? <Loader2 className="spin" size={18} /> : <Scissors size={18} />}
                  自动切分
                </button>
                <div className="grid-controls">
                  <input className="number" type="number" min={1} max={6} value={gridRows} onChange={(event) => setGridRows(Number(event.target.value))} />
                  <span>行</span>
                  <input className="number" type="number" min={1} max={6} value={gridColumns} onChange={(event) => setGridColumns(Number(event.target.value))} />
                  <span>列</span>
                </div>
                <button className="tool-button" type="button" disabled={Boolean(busy)} onClick={runGridSplit}>
                  {busy === 'grid' ? <Loader2 className="spin" size={18} /> : <Scissors size={18} />}
                  网格切分
                </button>
                <button className="tool-button" type="button" onClick={() => downloadDataUrl(activeImage.dataUrl, `${activeImage.name || 'sticker'}.png`)}>
                  <Download size={18} />
                  下载原图
                </button>
                <button className="danger-button" type="button" onClick={() => deleteImage(activeImage.id)}>
                  <Trash2 size={18} />
                  删除
                </button>
              </aside>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="pieces-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>切分结果</h2>
            </div>
            <button className="primary-button" type="button" disabled={allPieces.length === 0} onClick={() => downloadZip(allPieces)}>
              <FileArchive size={18} />
              一键下载 ZIP
            </button>
          </div>
          {allPieces.length === 0 ? (
            <div className="empty-pieces">切分后的单张贴纸会显示在这里。</div>
          ) : (
            <div className={`pieces-layout ${cropTarget ? 'with-crop' : ''}`}>
              <div className="pieces-grid">
                {allPieces.map((piece) => (
                <article key={piece.id} className={`piece-card ${cropTarget?.id === piece.id ? 'selected' : ''}`}>
                  <button className="piece-image checkerboard" type="button" onClick={() => openCropEditor(piece)}>
                    <img src={piece.dataUrl} alt={`sticker ${piece.index}`} />
                  </button>
                  <div className="piece-actions">
                    <button type="button" onClick={() => openCropEditor(piece)}>
                      <Scissors size={16} />
                      裁剪
                    </button>
                    <button type="button" onClick={() => downloadDataUrl(piece.dataUrl, `sticker-${String(piece.index).padStart(2, '0')}.png`)}>
                    <Download size={16} />
                    下载 #{piece.index}
                  </button>
                  </div>
                </article>
                ))}
              </div>
              {cropTarget && (
                <aside className="crop-editor">
                  <div className="crop-heading">
                    <div>
                      <h3>手动裁剪 #{cropTarget.index}</h3>
                      <p>负数扩大边界，正数向内收紧。</p>
                    </div>
                    <button type="button" onClick={() => setCropAdjustments(zeroCrop)}>重置</button>
                  </div>
                  <div className="crop-preview checkerboard">
                    <img src={cropTarget.dataUrl} alt={`crop ${cropTarget.index}`} />
                    <div className="crop-mask" />
                    <div className="crop-frame" style={cropFrameStyle} />
                  </div>
                  <div className="crop-sliders">
                    {([
                      ['top', '上'],
                      ['right', '右'],
                      ['bottom', '下'],
                      ['left', '左'],
                    ] as Array<[keyof CropAdjustments, string]>).map(([key, label]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input
                          type="range"
                          min={-35}
                          max={35}
                          step={1}
                          value={cropAdjustments[key]}
                          onChange={(event) => setCropAdjustments((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                        />
                        <code>{cropAdjustments[key]}%</code>
                      </label>
                    ))}
                  </div>
                  <button className="primary-button crop-apply" type="button" disabled={busy === 'crop'} onClick={applyCrop}>
                    {busy === 'crop' ? <Loader2 className="spin" size={18} /> : <Scissors size={18} />}
                    应用裁剪
                  </button>
                </aside>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
