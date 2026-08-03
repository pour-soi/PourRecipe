# OCR 语言与缓存

可选 `chi_sim`、`eng`、`chi_sim+eng`。首次使用某种语言需要联网下载训练数据；成功缓存后才可能离线使用。PWA 为 Tesseract 语言数据配置 CacheFirst，但 Safari 仍可能因系统回收或用户清理网站数据而删除缓存。

设置页可清除 OCR/Tesseract 缓存。清除后必须重新联网下载。应用不把“曾经下载过”误报为永久离线可用。
