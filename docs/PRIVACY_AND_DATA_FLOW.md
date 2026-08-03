# 隐私与数据流

食谱、图片、OCR、分类、标签、制作记录、队列和冲突首先保存在浏览器 IndexedDB。OCR 的图片像素只传给同页面的 Tesseract Web Worker；没有第三方 OCR API，不使用生成式 AI，不请求麦克风。

登录时邮箱仅发送给 Supabase Auth，登录邮件中的一次性 Magic Link 由 Supabase 处理。普通日志不得记录邮箱、Magic Link、Access Token 或 Refresh Token。身份来自 session，数据库和 Storage 使用 `auth.uid()`，前端不能指定数据所有者。

结构化数据同步到启用 RLS 的 Postgres。完整图和缩略图进入私有 Storage，不生成永久公开 URL。ZIP 完全在本机生成和验证。

清除 Safari 网站数据会删除未同步本地数据和 OCR 语言缓存。ZIP 应保存到用户控制的位置。
