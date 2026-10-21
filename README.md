# mcpywrap 官网

mcpywrap 的官网与 Wiki。纯静态站点：Astro 7 + Starlight（Wiki）+ React Three Fiber（首页 3D 星球）。

## 本地开发

需要 Node 22.22+ 与 pnpm。

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # 先按站点用字裁剪像素字体，再构建到 dist/
pnpm preview    # 预览 dist/
pnpm check      # 类型检查
```

## 目录

| 路径 | 内容 |
|---|---|
| `src/pages/index.astro` | 首页各区块与文案 |
| `src/components/hero/` | Hero：安装命令框、静态星球、3D 星球（`Planet.tsx` + `planet/`） |
| `src/components/demo/` | 命令演示组件（终端 + 方块舞台）；脚本数据在 `src/data/demos.ts` |
| `src/data/capabilities.ts` | 星球能力徽章 |
| `src/content/docs/wiki/` | Wiki 正文（Markdown） |
| `src/assets/captures/` | 首页 macOS 实机截图与来源记录 |
| `src/styles/tokens.css` | 设计令牌（颜色取自 mcpy 图标）与像素字体 |
| `fonts-src/` | Fusion Pixel 原始字体与授权；`scripts/subset-font.mjs` 生成 `public/fonts/` |

## 文案规则

官网所有能力描述必须能在 mcpywrap 源码或文档中查证。事实清单、红线与出处对照维护在 `plan/`（不进 Git）。修改首页文案后同步更新对照表；新增汉字后 `pnpm build` 会自动重新裁剪字体。

首页和 Wiki 不标注 mcpywrap、运行包或开发包的具体发布版本，也不承诺文档始终对应最新版本。命令与能力以实际安装的 CLI 帮助和能力查询为准，版本变化链接到上游更新记录。示例使用版本占位符；必要的最低环境要求、协议字段、许可证版本和内部实测记录保留。

## 3D 星球

- `?seam=line` / `?seam=s` 切换直线或太极 S 形交界线（默认 S 形）。
- 拖动旋转（带惯性），Ctrl/⌘ + 滚轮或触控板捏合缩放；普通滚轮保留给页面滚动。
- 鼠标划过星球时，光标附近的方块翻到另一种状态（透视镜）。
- 点击方块（不拖动）：从点击处扩散一圈翻面波纹，并在点击处浮起该区域的一条真实命令（`src/components/hero/planet/commands.ts`）。
- 点击徽章转到正面并展开能力卡片，Esc 关闭。
- WebGL 不可用或渲染出错时保留静态 SVG 星球与 DOM 徽章导航；离开视口自动停帧。

## 验收脚本

先 `pnpm build && pnpm preview`，然后：

```sh
node scripts/accept.mjs      # 复制按钮、键盘可达、无 WebGL / 减少动态降级、徽章卡片、横向溢出
node scripts/wiki-check.mjs  # 站内死链、Pagefind 中文搜索
pnpm shots [路径...]          # 桌面 / 移动截图到 shots/
```

## 字体授权

中文像素字体 [Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font)（SIL OFL 1.1），授权文件随字体发布在 `public/fonts/OFL.txt` 与 `public/fonts/LICENSES/`。

## 部署

正式地址：[mcpy.easecation.net](https://mcpy.easecation.net)。`pnpm build` 产物 `dist/` 通过私有阿里云 OSS + CDN 提供服务。

部署工作流、GitHub OIDC、证书续期、目录 URL 重写与 404 配置见 [部署说明](deploy/README.md)。
