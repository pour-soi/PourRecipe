# PourRecipe

iPhone-first、本地优先的个人食谱 PWA。正式架构只有 React/TypeScript/Vite PWA、Dexie/IndexedDB、本地 Tesseract.js OCR、确定性单位换算、Supabase Auth/Postgres/私有 Storage，以及独立 ZIP 备份。

应用不使用生成式 AI、不支持语音或麦克风输入。OCR 只在用户点击后于浏览器本机执行，不翻译、不改写文字。

## 本地运行

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm test:e2e
```

没有 `.env.local` 时应用以纯本地模式运行，食谱、图片、OCR、分类、标签和制作记录仍完整可用。Supabase 配置只复制 `.env.example` 的占位字段；不得提交真实 `.env.local`。

## 数据安全

- 所有操作先写 IndexedDB，再进入同步队列。
- Supabase 不可用不会阻止本地编辑。
- 私有图片对象按用户、食谱和图片 UUID 隔离。
- ZIP 是不依赖账号或网络的最终独立备份，包含原图、缩略图、OCR 和 SHA-256。
- 清除 Safari 网站数据会删除尚未同步且未导出 ZIP 的本地数据。

详细说明见 `docs/`。数据库/RLS/Storage migration 位于 `supabase/migrations/`。
