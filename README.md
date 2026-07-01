# 表情包不求人

一个不需要配置 API Key 的表情包/贴纸工作台。它负责把你的创意整理成可复制的图片生成 Prompt，并提供生成后图片的上传、切分、裁剪、透明背景修复和打包下载能力。

## 来源与致谢

本项目参考并改造自 StickerCraft：

- 原项目地址：https://github.com/Leochens/StickerCraft

当前版本移除了内置 API Key 配置和直接生图流程，改为“复制 Prompt 到外部图片生成平台 + 本地处理生成结果”的 no-api 工作流。

## 功能

- 生成适合贴纸、表情包、三视图、贴纸组的 Prompt
- 支持多种贴纸风格、画幅、背景、白色贴纸边和面部表情开关
- 可选文字内容和文字风格
- 可上传参考图，作为外部图片生成平台的生图参考
- 上传生成后的图片后，可自动切分或按网格切分
- 支持单张贴纸裁剪微调
- 支持透明背景修复、单张下载和 ZIP 打包下载
- 全部处理在浏览器本地完成，不需要后端服务

## 使用方式

1. 在左侧填写贴纸主题，选择风格、布局和数量。
2. 复制右侧生成的 Prompt。
3. 把 Prompt 粘贴到任意图片生成平台生成图片。
4. 将生成好的图片上传回本工具。
5. 使用自动切分或网格切分得到单张贴纸。
6. 需要时调整裁剪，然后下载 PNG 或 ZIP。

## 本地开发

```bash
npm install
npm run dev
```

默认会启动 Vite 开发服务，按终端输出的本地地址访问即可。

## 构建

```bash
npm run build
```

构建产物会输出到 `dist/`。

## Vercel 部署

这个项目可以作为独立仓库直接部署到 Vercel。

推荐配置：

```txt
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Root Directory: 留空
```

仓库里已经包含 `vercel.json`，正常情况下 Vercel 会自动使用：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

## 技术栈

- React
- TypeScript
- Vite
- JSZip
- Lucide React

## 目录结构

```txt
.
├── public/              # 静态资源和 favicon
├── src/
│   ├── assets/          # Logo 等资源
│   ├── app.tsx          # 主界面
│   ├── image-processing.ts
│   ├── main.tsx
│   ├── prompt.ts        # Prompt 配置和生成逻辑
│   ├── styles.css
│   └── types.ts
├── index.html
├── package.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

## 注意事项

- 本项目不直接调用任何图片生成 API。
- 上传和切分图片都在浏览器本地处理。
- 自动切分依赖图片内容和背景对比度，如果识别不理想，可以使用网格切分。
- 生成质量主要取决于你使用的外部图片生成平台和模型。
