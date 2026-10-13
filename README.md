# Milky Diary — GitHub Pages + Firebase

此版本保留原网站的设计和照片，新增：主人 Google 登录、云端自动保存、访客匿名上传照片后立即公开、实时同步。**尚需完成以下 Firebase 配置，才能正常工作。**

## 1. Firebase 项目

1. 打开 https://console.firebase.google.com/ 创建项目（例如 `milky-diary`）。
2. Project settings → Your apps → 添加 Web App，复制 `firebaseConfig` 中的值到 `firebase-config.js`。这是网页公开配置，**不要放服务账号私钥**。
3. Authentication → Sign-in method：开启 **Google** 和 **Anonymous** 两种登录方式。
4. Authentication → Settings → Authorized domains：加入 `keyu-wan.github.io`。注意不能含 `https://` 和路径。
5. Firestore Database：创建数据库；Storage：创建存储桶。Storage 可能要求 Blaze 计费方案。选择合适的区域。

## 2. 设置主人 UID 和安全规则（非常重要）

1. 暂时把三个网页文件 `index.html`、`cloud.js`、`firebase-config.js` 上传 GitHub 仓库根目录。
2. 打开网站，点击 **主人登录**，使用你的 Google 账号登录。
3. 页面会显示你的 UID；也可在 Firebase Authentication → Users 找到。**UID 不是密码。**
4. 将该 UID 填入 `firebase-config.js` 的 `MILKY_OWNER_UID`，并替换 `firestore.rules`、`storage.rules` 中所有 `REPLACE_WITH_OWNER_UID`。
5. Firebase Console → Firestore Database → Rules：粘贴 `firestore.rules` 全部内容，点击 Publish。
6. Firebase Console → Storage → Rules：粘贴 `storage.rules` 全部内容，点击 Publish。
7. 再上传修改后的 `firebase-config.js` 到 GitHub，等待 Pages 更新，重新登录。
8. 仅在主人登录后，点击 **首次发布现有记录** 一次。此后修改自动保存，其他访客实时同步。

**务必先发布安全规则再邀请其他人上传照片。** Firebase 的网页配置不是安全凭证，安全性取决于 Auth 和服务器端规则。

## 3. 访客上传

- 访客打开网站后自动匿名登录；无需注册。上传后照片立即公开。
- 每次最多 5 张，每张原图不超过 10MB，浏览器压缩成 JPEG 后不超过 10MB；Storage 规则强制校验 10MB 和 JPEG。
- 只有主人可以删除云端照片，只有主人可以修改健康记录、体重和待办。
- **匿名账号可以被反复创建，前端每次 5 张限制不是可靠的服务器端频率限制。** 如果网址被滥用，可能产生存储和账单成本。公开推广前强烈建议启用 Firebase App Check（reCAPTCHA Enterprise）并考虑服务端限流或改为访客 Google 登录。
- **立即公开意味着无法保证照片内容安全**；不要上传私人信息、人物肖像或敏感位置照片。Firebase 安全规则不执行内容审核。
- Firebase Storage 需要关注 Blaze 计费、预算告警和用量。

## 4. 其他说明

- 原 HTML 自带的三张照片仍内嵌于网页，首次发布不会把这些旧照片重复上传到 Storage。
- 旧浏览器 localStorage 中用户自行上传的照片**不会自动迁移**；可手动重新上传。
- Firestore 的实时同步**不是独立备份**。建议定期导出 JSON，并另设定期备份。
- Cloud 版只读访客不能编辑记录。网站首页文字/故事仍属于静态 HTML，要改文字需更新 GitHub 文件；健康记录、体重、待办、照片不需要。
- 如果照片上传成功但 Firestore 写入失败，客户端会尝试删除对应 Storage 文件；断网等极端情况仍可能产生孤立文件。

## 主人 UID 已填写（2026-10-13）

主人 Firebase UID 已填入 firebase-config.js、firestore.rules、storage.rules。**先将两套规则分别粘贴到 Firebase 控制台对应 Rules 页面并 Publish，再把 index.html、cloud.js、firebase-config.js 上传 GitHub 仓库根目录。** 不要把 README 或 .rules 文件当作 GitHub Pages 会自动执行的权限规则；上传到 GitHub 并不会部署 Firebase 规则。

在主人登录后点击「首次发布现有记录」一次，后续数据变更才会自动保存。发布前请确认 Google 和 Anonymous 登录已启用，且授权域名包含 keyu-wan.github.io。


## 2026-10-13 网页更新
- 生日显示为 🎂，月龄按访问日期自动计算。
- 最近体重从云端同步的体重记录自动取最新日期。
- 主页「近期待办」展示最近加星标且未完成的事项；主人可在待办栏点击 ☆ / ★。
- 移除了页面中的手动数据备份区；云端保存依赖 Firestore 配置与已发布安全规则。
- 更新 GitHub 仓库根目录的 index.html 和 cloud.js 即可；Firebase 规则文件没有变化。


## 2026-10-13 更新
照片单张上传大小上限调整为 10 MiB（原图及处理后 JPEG），必须重新发布 `storage.rules` 才能生效。故事文案暂未修改，等待确认最终版本。


## 访客昵称（本次更新）
上传区新增“你的昵称”，浏览器会记住昵称。每张新上传照片的日期旁会显示 `from 昵称`。昵称保存在 Firestore 的 `uploaderName` 字段中。**必须重新发布本包的 firestore.rules**，否则新照片上传会被拒绝。旧照片无昵称时不会显示署名。昵称由上传者自行填写，不代表经过身份验证。请在上传 GitHub 前备份原文件。


## 本次布局更新
- 已完成事项卡片固定高度 540px，访客只显示全高度可滚动列表；主人模式底部保留编辑表单，上方列表独立滚动。
- 照片画廊改为较大的固定滚动区域，按拍摄年份、月份、上传者昵称筛选；旧照片归入“Milky 的手账”。筛选完全在浏览器端进行，不改变 Firebase 数据与安全规则。
- 更新 GitHub 仓库中的 index.html 即可，cloud.js 与 Firebase 规则无需改动。


## 本版修改
顶部云端状态整合到 logo 右侧，登录和退出改为图标；日历加入月/年翻页、emoji 标记与特殊事项自定义图标。已有事项会按标题关键词自动推断类别；新增事项可选类型与图标。数据仍存于现有 `site/content`，无需更改 Firebase 规则。仅更新 `index.html`。

本版：猫猫头像与身体分离；体重曲线支持 Month/Year/All 切换，记录独立滚动。


## PWA 照片去重版（2026-10-13）
- PWA 图标已换为 Milky 的真实照片（原始照片经过正方形裁剪），无需生成虚构猫脸。
- 上传前计算原文件 SHA-256 和压缩后 JPEG SHA-256；与已保存哈希一致的照片自动跳过，不会删除旧照片。
- 标题做全角/大小写/空格规范化比较；重复标题仅提示确认，因为不同照片可能有相同标题。
- 批量上传也会检查同一批次重复。选择照片时会先检查原始文件哈希。
- **必须在 Firebase Console → Firestore → Rules 发布本包的 firestore.rules**，新上传包含 fileHash 和 imageHash 两个字段，否则会被旧规则拒绝。Storage 规则与主人 UID 未更改。
- 旧照片未存哈希，因此只能对旧照片提示标题重复，无法凭哈希确认。不会自动删除历史照片。
- 去重在浏览器端进行，无法防止同时上传产生竞态，也不能阻止恶意访客绕过客户端；若需全局强制唯一，需要 Cloud Functions + 服务端原子哈希登记。
- JPEG 哈希仅在输出字节完全一致时命中；重新裁剪、不同压缩、滤镜或尺寸变化可能无法识别为同一照片。
- 若 iPhone 上图标未刷新，可先删除旧主屏幕快捷方式，再从 Safari 添加。


## 2026-10-13 图标更新
PWA 和 iPhone 主屏幕图标已替换为 Milky 奶油杏色（偏冷）照片版本；其余功能保留。若 iPhone 仍显示旧图标，请移除主屏幕旧快捷方式后重新添加。
