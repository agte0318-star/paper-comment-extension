# 中文手动测试指南

这份指南用于 Chrome Web Store 上传前的最后检查。目标不是继续写功能，而是确认打包后的扩展真的能在浏览器里工作，并把结果记录下来。

所有临时文件、截图、测试记录都放在项目的 E 盘目录下；不要放到 C 盘。

## 1. 准备发布材料

在项目目录运行：

```powershell
npm.cmd run release:prepare
```

它会完成项目检查、重新打包、检查 zip、准备 Chrome 加载目录、准备截图目录，并输出当前还缺什么。

常用路径：

```text
Chrome 加载目录:
E:\谷歌插件开发\paper-comment-extension\release\manual-test\paper-comment-extension-0.5.6

截图目录:
E:\谷歌插件开发\paper-comment-extension\release\store-assets\0.5.6\screenshots

测试结果:
E:\谷歌插件开发\paper-comment-extension\release\store-assets\0.5.6\manual-test-results.md

上传 zip:
E:\谷歌插件开发\paper-comment-extension\release\paper-comment-extension-0.5.6.zip
```

查看剩余缺口：

```powershell
npm.cmd run release:status
```

## 2. 自动生成部分截图

网页端截图：

```powershell
npm.cmd run capture:web-screenshots
```

扩展未登录截图和 popup 截图：

```powershell
npm.cmd run capture:extension-screenshots
```

如果要让脚本尝试自动生成登录后的 04-07 截图，需要准备两个测试账号，并只在当前 PowerShell 窗口临时设置：

```powershell
$env:PCE_TEST_AUTHOR_EMAIL="author-test@example.com"
$env:PCE_TEST_AUTHOR_PASSWORD="your-author-test-password"
$env:PCE_TEST_EMAIL="reader-test@example.com"
$env:PCE_TEST_PASSWORD="your-reader-test-password"
npm.cmd run capture:extension-screenshots
```

不要把测试密码写进任何项目文件、截图、README 或测试结果文档。

## 3. 在 Chrome 加载打包版扩展

1. 打开 Chrome。
2. 打开 `chrome://extensions`。
3. 开启右上角 `Developer mode`。
4. 如果已经加载过旧版 Paper Comment Extension，先移除旧版。
5. 点击 `Load unpacked`。
6. 选择：

```text
E:\谷歌插件开发\paper-comment-extension\release\manual-test\paper-comment-extension-0.5.6
```

7. 确认 Chrome 显示版本 `0.5.6`。
8. 把扩展固定到浏览器工具栏。

## 4. 手动测试登录流程

打开示例论文：

```text
https://arxiv.org/abs/1706.03762
```

需要确认：

- 未登录点击评分、评论、点赞、回复、举报时，会弹出登录窗口。
- 邮箱密码注册可用。
- 如果 Supabase 要求邮箱确认，确认邮件后可以登录。
- 登录后能回到刚才想做的操作。
- popup 里能退出登录。
- 同一账号可以再次登录。
- `Forgot password?` 可以请求重置邮件。
- 如果 Google OAuth 已配置，Google 登录可用。

## 5. 手动测试论文页功能

至少测试：

```text
arXiv:
https://arxiv.org/abs/1706.03762

Wiley 或 Springer DOI 页面:
任选一篇能打开的文章

ACS 或 ScienceDirect 页面:
任选一篇能打开的文章
```

需要确认：

- 侧边栏能出现、关闭、重新打开。
- 标题和 DOI/arXiv ID 识别正确。
- 可以提交总评分。
- 平均评分会更新。
- 可以发布一条评论。
- 同一账号同一篇文章一天只能评论一次。
- 评论可以按 `Newest` 和 `Popular` 排序。
- 可以点赞、回复、举报评论。
- 可以生成评论分享图片。

## 6. 手动测试 PDF 和 fallback

至少测试：

```text
arXiv PDF:
https://arxiv.org/pdf/1706.03762.pdf
```

还需要各找一篇真实 PDF：

- Wiley PDF 或 PDFDirect
- Springer content PDF
- ACS PDF
- ScienceDirect PDF 或 PII PDF
- 一个 URL 中没有 DOI 的普通期刊 PDF

如果 Chrome PDF 阅读器里没有直接出现侧边栏：

1. 点击浏览器工具栏里的扩展图标。
2. 点击打开当前论文讨论页的按钮。
3. 确认能跳到对应 `paper.html` 讨论页。
4. 如果 URL 里有 DOI、arXiv ID 或 PII，应优先使用这些 ID。
5. 只有找不到 DOI、arXiv ID、PubMed ID、PMC ID 或 PII 时，才应使用 `pdf:` fallback key。

## 7. 手动测试网页端

打开：

```text
https://agte0318-star.github.io/paper-comment-extension/
https://agte0318-star.github.io/paper-comment-extension/web/trending.html
https://agte0318-star.github.io/paper-comment-extension/web/profile.html
https://agte0318-star.github.io/paper-comment-extension/web/admin.html
```

需要确认：

- 首页能打开。
- Trending 页面能显示公开数据或空状态。
- 搜索和排序可用。
- Paper discussion 页面能打开并复制分享链接。
- Profile 未登录时显示登录面板。
- Profile 登录后只显示当前账号活动。
- Admin 页面拒绝非管理员账号。
- 管理员账号可以看到管理功能。

## 8. 截图要求

截图保存到：

```text
E:\谷歌插件开发\paper-comment-extension\release\store-assets\0.5.6\screenshots
```

截图必须是 PNG，尺寸为 `1280x800` 或 `640x400`。

必须按这些文件名保存：

```text
01-sidebar-closed.png
02-sidebar-open-paper-id.png
03-sign-in-dialog.png
04-rating-panel.png
05-comment-rated.png
06-comment-replies-actions.png
07-report-form.png
08-popup-actions.png
09-trending-page.png
10-paper-discussion-page.png
11-profile-page.png
```

截图不要暴露：

- 真实私人邮箱
- 密码
- Supabase 后台密钥
- Chrome Web Store 凭据
- 付费论文正文、图、表

## 9. 最终上传前检查

当所有表格里都没有 `Pending`，并且没有 `Fail` 后，把 `manual-test-results.md` 最后改成：

```text
Ready to upload: Yes
Submitted version: 0.5.6 planned
Chrome Web Store status: Ready to submit
```

然后运行：

```powershell
npm.cmd run check:release-ready
```

只有这个命令通过后，才上传：

```text
E:\谷歌插件开发\paper-comment-extension\release\paper-comment-extension-0.5.6.zip
```
