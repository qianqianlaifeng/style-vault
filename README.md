# BAIRIMENG-FG · AI 视频风格库

> 一图一画风 · 抽卡找灵感 · 上传剧本自动匹配 3 种画风

面向 AI 视频 / 漫剧 / 短剧创作者的**风格库**。收录 **185 套画风**，每套画风包含一张参考图、源站原始风格提示词、分类标签、作者与使用量；没灵感可以**抽卡**，剧本没头绪可以**上传剧本 / 小说 / 分镜自动匹配最合适的 3 种画风**。

- 纯静态站点：HTML + CSS + 原生 JS，**无后端、无追踪、无构建依赖**
- 匹配引擎全部在浏览器本地运行，文本不会离开你的设备
- 数据来源：[oiioii.tv 风格库](https://www.oiioii.tv/zh/)（`/knowledge/style_assets` 接口），图片已本地化压缩（2223MB → 27MB）

## 功能

| 模块 | 说明 |
| --- | --- |
| 风格库 | 185 套画风网格，11 个分类（真人剧 / 日漫 / 漫剧 / 国风 / 3D / 2D / 欧美 / 游戏 / Q版 / 韩流），支持搜索、排序、收藏 |
| 详情弹窗 | 参考图 + 5 张场景参考（女性 / 男性 / 宠物 / 室内 / 室外）、画面语言分项（光线色彩 / 材质 / 镜头构图 / 角色 / 场景）、源站风格提示词、负向提示、套用模板 |
| 抽取动画 | 单抽 / 十连，3D 翻牌 + 稀有度光束（SSR 旋转光柱）+ 粒子爆裂，抽取记录本地留存 |
| 智能匹配 | 拖入 .txt/.md 或粘贴文本 → 本地解析题材 / 时代 / 情绪 / 媒介 / 场景 / 角色 → 对 185 条画风加权打分 → 输出 Top3 画风、命中关键词与理由、可复制的提示词 |
| 我的风格 | 我的收藏（localStorage），一键清空 |

## 本地运行

```bash
node tools/serve.mjs 4173     # → http://127.0.0.1:4173
```

## 数据管线（可复现）

```bash
node tools/fetch-styles.mjs   # 拉取 oiioii.tv 风格库全量数据 + 参考图
node tools/compress.mjs       # ffmpeg 批量压缩图片（主图 420px / 参考图 300px）
node tools/build-styles.mjs   # 生成 assets/data/styles.js（分类、关键词、画面语言分段）
node tools/deploy-pages.mjs   # 通过 GitHub REST API 推送到 GitHub Pages
```

## 目录

```
index.html                 页面结构
assets/css/style.css       设计系统（暗色玻璃 / 紫蓝渐变 / 微动效）
assets/js/app.js           风格库、抽卡、收藏、详情弹窗
assets/js/matcher.js       本地剧本语义匹配引擎
assets/data/styles.js      风格库数据（自动生成）
assets/thumbs/*.jpg        185 张主参考图
assets/refs/*.jpg          925 张场景参考图
tools/                     抓取 / 压缩 / 构建 / 部署脚本
```

## 说明

风格名称、分类、作者、使用量与提示词文案均来自 oiioii.tv 风格库，本项目仅做展示与本地检索；图片版权归原作者所有。
