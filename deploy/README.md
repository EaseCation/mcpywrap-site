# OSS + CDN 部署

正式地址：<https://mcpy.easecation.net>。首页、Wiki 和搜索均为静态文件，只发布 `dist/`。

| 资源 | 配置 |
| --- | --- |
| GitHub | 公开仓库 `EaseCation/mcpywrap-site`，生产分支 `main` |
| OSS | `easecation-mcpywrap-site`，杭州 `cn-hangzhou`，Standard / LRS，private |
| CDN | `mcpy.easecation.net`，国内加速，HTTPS 443 回源 OSS，鉴权回源 |
| DNS | `mcpy` CNAME → `mcpy.easecation.net.w.kunlunaq.com`，TTL 600 |
| TLS | TLS 1.2 / 1.3，HTTP 跳 HTTPS；由 `EaseCation/ssl-center` 统一维护 |
| 部署角色 | `acs:ram::1083406401917880:role/gh-oidc-mcpywrap-site-deploy` |
| OIDC Provider | `acs:ram::1083406401917880:oidc-provider/github-actions` |

## 自动部署

`.github/workflows/deploy.yml` 在 main 推送或手动运行时：

1. 安装锁定的 pnpm 依赖，类型检查并构建站点及像素字体子集。
2. 验证产物入口，拒绝符号链接、隐藏文件、私钥及开发 source map。
3. 使用 GitHub OIDC 获取一小时 STS 凭据，不配置长期阿里云 AccessKey。
4. 先上传全部 JS / CSS / 图片 / 搜索依赖，再上传 HTML，最后清理已撤下的页面与稳定资源。
5. 刷新本站 CDN 目录缓存，验证页面直链、无尾斜线 URL、资源内容摘要/MIME、搜索入口、404 和 HTTP → HTTPS。

生产部署串行运行，不中断正在上传的版本。旧 `_astro/` 哈希资源和 Pagefind 片段保留，避免已打开页面引用失效。上传不是事务操作；失败时重新运行同一提交完成发布，失败上传不会执行清理。

PR 工作流只检查和构建，不使用生产角色。回滚时恢复既有 Git 提交并再次部署。

## RAM 和 OIDC

`oidc-trust.json` 使用 GitHub 返回的 immutable subject，仅信任：

```text
repo:EaseCation@20168691/mcpywrap-site@1427791731:ref:refs/heads/main
```

同时限定 issuer 为 GitHub Actions、audience 为 `sts.aliyuncs.com`。其他仓库、PR、标签及其他分支不能扮演生产角色。`ram-policy.json` 仅授予本站桶的对象读写/清理及本站 CDN 刷新，不授予 RAM、DNS 或证书管理权。

首次通过管理员 CLI profile 创建角色、策略和绑定，并在 SSL Center 的原策略中追加本站域名：

```sh
python3 deploy/bootstrap-ram.py --profile <管理员profile> --ssl-center ../ssl-center
```

也可以为本机部署用的 RAM 用户临时授予 `bootstrap-permission.json` 中的自定义权限，然后执行上述脚本。引导完成后可解除这项权限；日常 CI 只使用生产角色。

脚本遇到同名角色或策略时会核对内容，不覆盖不同配置。SSL Center 的权限修改基于线上原策略，只增加 `mcpy.easecation.net` 的证书查询和配置资源，保留其他目标。

## 伪静态与 404

这是预渲染多页面站点，不使用 SPA 首页 fallback。`cdn-functions.json` 保存首次配置：

| 请求 | OSS 回源 |
| --- | --- |
| `/` | `/index.html` |
| `/wiki/` | `/wiki/index.html` |
| `/wiki/start/install/` | `/wiki/start/install/index.html` |
| `/wiki/start/install` | `/wiki/start/install/index.html` |
| `/_astro/example.js`、`/favicon.svg` 等文件 | 原路径 |

已有 CDN 规则再次调整前先查询线上配置与 ConfigId，不重复添加多份回源重写规则。

OSS 使用 `oss-website.json`：目录首页为 `index.html`，错误页为 `404.html`，错误状态保持 **404**。不存在的页面和 JS 返回真正的 404 页面及 404 状态，不能返回 200 首页，也不使用跳转后变成 200 的错误页。

HTML、稳定字体和搜索入口使用五分钟缓存；`_astro/` 内容哈希资源使用一年 immutable 缓存。保留查询参数，不对全部 URL 添加固定长缓存。

## 证书

`../ssl-center/domains.yml` 的 `cdn_domains` 应包含本站，并在 `infra/aliyun/ssl-center-renew-policy.json` 的既有 CDN 证书资源列表加入本站域名。提交后由原有 Actions 签发/复用并部署证书，网站发布流程不获取证书私钥。

首次启用复用了账号内有效的 `*.easecation.net` CAS 证书。后续沿用 SSL Center 的 DNS-01、周一检查、临期续签和 CDN 证书同步，不单独为本站重复申请证书。

## 本地发布与验证

```sh
python3 -m venv .local/deploy-venv
.local/deploy-venv/bin/pip install -r deploy/requirements.txt
pnpm check
pnpm build
.local/deploy-venv/bin/python deploy/upload.py --dry-run
.local/deploy-venv/bin/python deploy/upload.py --profile default
aliyun cdn RefreshObjectCaches --ObjectPath https://mcpy.easecation.net/ --ObjectType Directory
python3 deploy/verify.py
```

本地 `--profile` 从现有阿里云 CLI 配置读取 AK，不写入仓库或日志；CI 必须提供 OIDC STS 环境变量。`.local/` 不进入 Git。
