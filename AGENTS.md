# Caelum 工程约定

Caelum（凿星图）是个人科研、阅读、写作与生活网站。保留现有内容、星图、星域和浏览器个人标记；先复现故障，再小范围修改。架构与调研依据见 `docs/工程审计与房间方案.md`，内容维护见 `docs/更新指南.md`。

## 真实架构与入口

- 页面使用原生 HTML/CSS/JavaScript，Vite 5 负责构建。虽保留 Svelte 5 及其插件依赖，现有页面没有 Svelte 组件，不要据此迁移技术栈。
- `web/index.html` 是主页唯一维护入口，内含 Canvas 星图、沉浸式视图、星域、设置与内容编辑。`caelum.html` 是历史副本，禁止复制覆盖主页。
- `web/room.html`、`web/room/{room.js,room.css,house-plan.js,spatial-model.js,spatial-drawings.js,design-dossier.js,living-studies.js,daily-life.js}` 是二维住宅设计册、原创可交互 SVG 平面与日常内容。JPEG 位于 `web/room/assets/`；PNG 保留视觉原稿。`world.js` 和 `scene.svg` 为历史方案，不从当前页面加载。
- `web/public/data/{graph,articles,text,inbox,room,house}.json`、`web/public/tree.json` 是公开内容。住宅中英文字段与面积表改 `house.json`，日常书茶内容改 `room.json`。空间几何只改 `spatial-model.js`，随后用 `scripts/render-house-studies.py` 重导出几何视图、公开SVG/JSON，再重建 `scripts/build-house-dossier.py` 的PDF；同步面积数据与设计简报。`spatial-drawings.js` 负责同模型图版，`house-plan.js` 负责可访问交互。
- `scripts/` 是本地语料处理脚本；`corpus/`、`data/` 含私人原料。构建不需要重新抓取、嵌入或上传这些目录。
- `web/scripts/package-pages.mjs` 将 Vite 产物包装为 `web/dist/web/`，在产物根保留跳转页及兼容手册。只发布 `web/dist/`。

## 常用命令

从仓库根执行，Node.js 22 与 CI 一致：

```sh
npm --prefix web ci
npm --prefix web run dev -- --host 127.0.0.1
# 开发访问 http://127.0.0.1:5173/web/
npm --prefix web run build
npm --prefix web test
npm --prefix web run preview -- --host 127.0.0.1
# 产物预览访问 http://127.0.0.1:4173/web/ 和 /web/room.html
git diff --check
```

测试依赖已生成的完整产物，先 build 再 test。`npm test` 使用 Node 内置测试器，检查真实静态路径、JSON 和关键回归；它不能替代浏览器交互检查。仓库没有独立 lint/typecheck 命令，不要声称已运行。

## 修改边界与视觉约定

- 保留 `/web/`、`/web/index.html` 与原有手册链接。Vite `base` 为 `/web/`，页面内数据使用相对路径；不要引入根路径 `/assets/`、`/data/` 假设。
- 不重写用户简介、论文、文章、书单或私有笔记。修改数据结构时兼容旧版本，保留已有条目。
- 主页沿用衬线字体、低饱和主题与留白；住宅采用用户确认的日式现代自然木质，二维静帧与纸面建筑图册。2026-10-20 用户要求从三维改为二维，不要重新默认启用 Three.js。复用 CSS 变量与中英文字段。
- 当前住宅工作模型为约200㎡概念建面（166㎡净功能＋34㎡构造设备预留）、30㎡庭院另列、四间独立空间（含15.54㎡画室）。园居扩展以1190㎡假想地块研究，生活翼另增72㎡概念建面，泳池36㎡及池畔54㎡为室外另列，不混入主宅200㎡；树种按实际气候核定。茶室点位在模型`tea`，窗墙檐口在`courtyardBoundary`，外园在`estate`。住宅名「迟庭」。门窗、家具、视点、动线、立面与剖面以同一模型协调；材质影像有对应固定视点和几何对照，不能宣称毫米级精确或可直接施工。历史REV.01独立氛围图不进入当前房间画面。建筑师参考须链接官方来源，原创转译与原作区分。
- 房间保留原生控件、日常抽屉、可放大的键盘平面、矢量/札记导出。点击、触摸、键盘均可操作，保留焦点提示、状态反馈、减少动态效果偏好及数据/图像加载失败后的可用内容。
- 页面隐藏时暂停持续动画与声音；音频只能由用户主动触发。不要为二维过渡新增 React、Three.js、GSAP 或模型依赖。历史 Three.js 依赖仅支持保留的源码与回归，不进入当前页面产物。
- 不为格式统一重构整页。新增模块可以独立文件，现有功能修复尽量局部；更新这里与受影响的维护文档，不复制通用模板。

## 安全与数据

- token、管理密钥不得进入代码、JSON、日志、截图、URL、localStorage 或 sessionStorage。在线写入凭证仅用于本次请求，关闭面板后清空。
- 静态网页中的口令或公开哈希不是访问控制。GitHub 使用仅限目标仓库的最小 Contents 权限；不扩大账户权限。
- 编辑 API 路径限于明确允许的公开 JSON；使用最新 SHA 防止覆盖冲突。验证输入与 URL 协议，外部文本转义后再进入 HTML，不能通过转义后再拼接事件代码。
- 保留浏览器已有 `caelum_*` 阅读标记、学习记录和笔记。住宅札记使用 `caelum_house_notes_v1`，植物仍用 `caelum_room_plant_note`；只迁移或清除明确的旧凭证键，不批量清空存储。
- 不运行会重新生成私人语料、提交所有文件或推送的旧脚本来代替本地验证。提交前逐项审查暂存文件，不能依赖 `.gitignore` 保护已经跟踪的文件。
- 改域名、清理数据、扩大权限或不可逆操作需要用户确认；正常本地修复与验证可自主完成。不要在未执行部署、检查线上之前声称已上线。

## 交付前验证

运行 build、test、diff 检查；在浏览器检查主页初始化、星图搜索/筛选/推荐、星域下钻、语言/主题、编辑输入与错误反馈。住宅检查九区、平面点选与键盘、放大/缩放、影像/几何切换、十章设计册（含茶室/园居）和联动、图纸/PDF/CSV下载、设计来源、札记保存/导出和全部日常功能。检查桌面和窄屏、控制台错误、资源 404、减少动态效果与存储不可用情形。真实 token 提交测试会公开写仓库，需避免把测试内容写入生产。

CI 由 `.github/workflows/deploy.yml` 唯一负责，PR 构建检查，`main` 推送或手动触发时部署。Pages 设置的 Source 应为 GitHub Actions；仓库内删除旧 YAML 不会停止分支来源隐式发布。部署步骤使用现有 Pages 权限核验 Source 为 workflow，避免已验证产物再被原始源码覆盖。交付报告区分实际执行的检查、静态审查结论和未验证风险；记录访问路径与剩余限制。
