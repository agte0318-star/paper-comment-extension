# 最后账号流程 QA 指南

这份文件只用于 Chrome Web Store 上传前最后 5 个账号相关 Pending 项。不要把真实密码、邮箱验证码、收件箱截图、Supabase 私钥或 Chrome Web Store 凭证写进任何项目文件。

## 还剩哪 5 项

- `Email/password account creation works`
- `Email confirmation flow is understandable`
- `Email/password sign-in works`
- `Password reset email can be requested`
- `Google sign-in works if configured`

## 准备测试账号

至少准备：

- 一个普通 reader 测试账号，用于登录和密码重置。
- 一个全新的邮箱地址，用于测试注册。
- 如果 Google OAuth 已配置，再准备一个可以用于 Google 登录的测试邮箱。

可选：

- 一个 active admin 账号，用于再次确认后台权限。

## 只在当前 PowerShell 窗口设置密码

推荐使用交互式辅助脚本。它会隐藏密码输入，运行完自动清理临时环境变量：

```powershell
cd E:\谷歌插件开发\paper-comment-extension
npm.cmd run qa:account
```

如果你不想用交互式脚本，也可以手动在当前 PowerShell 窗口设置：

```powershell
cd E:\谷歌插件开发\paper-comment-extension
$env:PCE_TEST_EMAIL="reader-test@example.com"
$env:PCE_TEST_PASSWORD="reader-test-password"
$env:PCE_TEST_NEW_EMAIL="fresh-reader-test@example.com"
$env:PCE_TEST_NEW_PASSWORD="fresh-reader-test-password"
```

如果要顺便验证 admin：

```powershell
$env:PCE_TEST_ADMIN_EMAIL="admin-test@example.com"
$env:PCE_TEST_ADMIN_PASSWORD="admin-test-password"
```

然后运行：

```powershell
npm.cmd run check:google-oauth-setup
npm.cmd run check:live-account-flow
```

脚本会验证：

- reader 邮箱密码登录。
- reader profile 存在、状态 active、不是 admin。
- 密码重置请求可以被 Supabase 接受。
- fresh email/password 注册可以被 Supabase 接受。
- 如果提供 admin 账号，admin profile 必须是 `role=admin` 且 `status=active`。
- 登录、邮箱确认、密码重置相关提示文案存在。
- Google 登录按钮和 OAuth URL 接线存在。

## 根据脚本结果更新 QA 文件

更新：

```text
E:\谷歌插件开发\paper-comment-extension\release\store-assets\0.5.5\manual-test-results.md
```

只把脚本明确显示 `Pass` 的行改成 `Pass`。如果脚本显示 `Manual`，说明代码接线或请求已验证，但仍需要你在浏览器或邮箱里真实确认后才能改成 `Pass`。不要为了清空 Pending 而手动猜测。

推荐用交互式 finalizer 更新这 5 行，避免手动改错：

```powershell
npm.cmd run finalize:account-qa
```

它只会更新你逐项回答 `yes` 的账号 QA 行；如果还有任何 `Pending`，不会把 `Ready to upload` 改成 `Yes`。

当所有账号项都已经确认且你同意设置 `Ready to upload: Yes` 时，它还会提示你填写最终 QA 日期、测试者标签、浏览器标签、测试账号标签和 Google OAuth 状态。这里不要填写真实邮箱或密码，只写类似 `Reader/fresh test accounts verified; no private email recorded` 这种无隐私标签。

Google 登录只能在浏览器里真实点一次验证。步骤：

先运行配置诊断：

```powershell
npm.cmd run check:google-oauth-setup
```

如果你已经知道 Chrome Web Store 里的扩展 ID，可以这样打印准确的 Supabase redirect URL：

```powershell
$env:PCE_EXTENSION_ID="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
npm.cmd run check:google-oauth-setup
```

然后到 Supabase Authentication 的 URL Configuration / Redirect URLs 里确认至少允许：

- `https://agte0318-star.github.io/paper-comment-extension/web/profile.html`
- `https://<你的 Chrome 扩展 ID>.chromiumapp.org/supabase`

真实浏览器验证步骤：

1. 加载打包后的扩展目录：`release/manual-test/paper-comment-extension-0.5.5`
2. 打开一篇支持的论文页面。
3. 点击 `Sign in`。
4. 点击 `Continue with Google`。
5. 完成 Google 登录。
6. 回到扩展后确认用户显示为 Google 账号，并且可以评分或评论。
7. 打开 `https://agte0318-star.github.io/paper-comment-extension/web/profile.html`，点击 `Continue with Google`，确认能回到已登录的 Profile 页面。

如果 Supabase 没有配置 Google OAuth，就不要标记 `Google sign-in works if configured` 为 Pass；在备注里写 `Google OAuth not configured for this release`。

## 完成后运行最终门禁

```powershell
npm.cmd run release:status
npm.cmd run check:release-ready
```

只有当 `check:release-ready` 通过时，才上传新的 zip 到 Chrome Web Store。

## 清理当前窗口的测试密码

测试结束后，在当前 PowerShell 窗口运行：

```powershell
Remove-Item Env:PCE_TEST_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:PCE_TEST_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:PCE_TEST_NEW_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:PCE_TEST_NEW_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:PCE_TEST_ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:PCE_TEST_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```
