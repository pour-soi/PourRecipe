# Supabase 免费项目配置

只可使用 PourRecipe 专用免费项目。任何付款方式、升级或收费确认都应停止。

1. 创建免费项目，不复用其他项目。
2. 在 Auth 中预先创建唯一用户，然后关闭公开注册。
3. 登录方式固定为 Supabase Email Magic Link。用户输入邮箱、收取登录邮件并点击链接返回 PourRecipe；不使用数字验证码，也不配置自定义 SMTP。
4. 前端 `signInWithOtp` 请求固定使用 `shouldCreateUser: false`，并只把当前页面 origin 作为 `emailRedirectTo`。Supabase Redirect URLs 只登记明确的本地开发地址和 Staging 地址，不使用开放通配域名。
5. 使用 Supabase CLI 应用 `supabase/migrations/202607280001_initial.sql`，不要在 Dashboard 手工替代 migration。
6. 确认 `pourrecipe-images` bucket 为 private，大小限制 12 MB，MIME 仅 JPEG/PNG/WebP。
7. 复制 `.env.example` 为未提交的 `.env.local`，只填写 Project URL 与前端 publishable/anon key。Service Role Key 永远不得进入前端。

验证至少包括：未创建邮箱不能注册；Magic Link 返回正确 origin；session 恢复/过期/退出；所有表 RLS；两个受控身份互相不可读写；Storage 只能访问自身 UUID 前缀；revision 冲突；软删除/恢复/永久删除；缩略图和原图。

本仓库当前未包含真实项目 URL、邮箱、Token 或 Secret。
