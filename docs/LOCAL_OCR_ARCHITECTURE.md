# 本地 OCR 架构

Tesseract.js 固定为 7.0.0，并通过动态 import 在用户点击“识别文字”后才加载。全局队列一次处理一张图，避免 iPhone 同时创建多个 Worker。取消会终止当前 Worker；失败只更新 OCR 状态，截图 Blob 保留。

`rawOcrText` 是不可变识别原始结果，`editedOcrText` 是用户副本。加入原文、食材或步骤均需用户操作；行拆分是确定性规则并在写入前预览。OCR 记录与食谱和截图 UUID 关联，可软删除、同步和进入 ZIP。
