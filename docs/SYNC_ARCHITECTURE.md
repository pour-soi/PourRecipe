# 同步架构

正式运行代码只有 `SupabaseSyncProvider`。旧 Worker、D1、R2、Access、Wrangler 和 Drizzle 实现已删除。

每次修改先写 IndexedDB，并以 `{objectType, objectId}` 合并 `syncQueue`。后台同步从 Supabase session 获取身份，不接受调用者提交的 `userId`。RPC 使用 `auth.uid()`，比较 `baseRevision` 与服务端 revision；一致才递增写入，不一致返回服务端内容并建立本地冲突记录。

对象顺序为分类、标签、食谱、制作记录、图片元数据、OCR。图片二进制上传私有 Storage；同一路径 `upsert` 使重试幂等。新设备先恢复元数据，缩略图和原图按需认证下载。

同步状态为 `local_only`、`pending`、`syncing`、`synced`、`error`、`conflict`。失败不删除 IndexedDB 或队列。首次登录必须选择上传、下载、合并或暂不同步；下载前强制导出本地 ZIP。
