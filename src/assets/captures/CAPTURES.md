# 实机素材采集记录

所有图片均为 `mcpy screenshot --background-only` 的原始输出，仅做尺寸压缩，未做任何修图。

| 文件 | 平台 | 引擎 / 运行包 | 日期 | 采集方式 |
|---|---|---|---|---|
| macos-flat-before.png | macOS 26.6.2 · Apple Silicon | mcpy 0.5.2 · 开发包 3.9.100.297020 · 运行包 0.4.5 | 2026-10-21 | 见下方步骤 1–3 |
| macos-flat-after.png | 同上 | 同上 | 2026-10-21 | 见下方步骤 4–6 |

步骤（临时项目 `/tmp/mcpy-site-demo`，采集完已 stop 会话）：

1. `mcpy init --name sitedemo --type addon` + `mcpy mod --name SiteDemo`
2. `mcpy --local run --new --no-gui --detach --world-type flat --game-type creative --difficulty peaceful --seed 12345 --json` → `world_ready: true`
3. `mcpy --local screenshot --session <sid> --background-only --output shot-world.png --json` → `capture: launcher-framebuffer`，1440×960
4. `mcpy --local runtime install` 后 `runtime input observe` → `position [0.5, -60.0, 0.5]`，`yaw ≈ 0, pitch 0`
5. `runtime input run --file plan.json`，计划为 `player.look yaw 35 pitch 12` + `player.move forward 1, 2500 ms` → `effect_verified: false`
6. 再次 observe → `position [-5.69, -60.0, 9.34]`，`yaw 35.0, pitch 12.0`；随后截图 shot-moved.png

另：`runtime py --side server --code "1 + 1"` 返回 `state: completed, value: 2`。

待补（需要 Windows）：录屏、MCEditor、本地主客机双客户端。
