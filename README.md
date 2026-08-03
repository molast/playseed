# PlaySeed

PlaySeed 是一个面向儿童的学习与游戏平台。项目将拼音、数学等知识内容融入练习和游戏机制，并通过学习进度、错题记录和积分体系组织持续学习。

目前包含以下主要内容：

- 拼音学习、练习、本地真人录音与学习进度
- 数学口算、分步算法练习、批量出题与错题记录
- 拼音气球冒险、拼音赛车、MathPop 等学习游戏
- Super Mario、Bloxorz 等小游戏
- 基于 PixiJS 和 PlaySeed Mini Game Engine 的 2D 游戏能力

## 项目结构

```text
.
├── web/       Next.js 静态前端、学习页面、PixiJS 游戏及静态资源
├── wasm/      Rust/Wasm 算法与计算模块
└── docs/      本地 Markdown 需求、设计和玩法文档
```

各模块相互独立：

- `web` 维护自己的 `package.json` 与 pnpm 锁文件。
- `wasm` 是独立的 Cargo 项目，直接在 `wasm/` 中编译。
- 根目录没有 pnpm workspace、Cargo workspace 或 `package.json`。
- `docs/` 仅用于本地设计与开发参考，已被 Git 忽略，不会发布到仓库。

## 技术架构

| 模块 | 主要技术 | 职责 |
| --- | --- | --- |
| Web | Next.js、React、TypeScript、PixiJS | 学习界面、练习系统、游戏运行时、进度与错题数据 |
| Wasm | Rust、wasm-bindgen、wasm-pack | 数学出题及后续游戏算法、学习算法、OCR、音频和图像计算 |
| Docs | Markdown | 本地需求、知识点、玩法及实现规范 |

Web 使用 Next.js 静态导出，不依赖服务端 API。学习进度、设置和错题数据保存在浏览器本地；拼音优先使用 `web/public/audio/` 中的本地真人录音，缺少对应录音时降级为浏览器系统语音。

Wasm 编译产物输出到 `web/public/wasm/`，该目录需要提交到 Git，供 Web 构建和部署直接使用。

## 环境要求

- Node.js 20+
- pnpm 11+
- Rust 与 Cargo
- `wasm-pack`

## 安装依赖

```bash
pnpm --dir web install --frozen-lockfile
```

## 本地开发

根目录脚本只启动 Web 开发服务：

```bash
./dev-local.sh
```

默认地址：<http://localhost:3000>

## 常用命令

### Web

```bash
pnpm --dir web check
pnpm --dir web build
```

### Wasm

```bash
pnpm --dir web wasm:build
cd wasm && cargo test
```

### 知识点与音频资源

```bash
pnpm --dir web knowledge:build
pnpm --dir web audio:manifest
pnpm --dir web audio:sync
```

## 部署

Web 通过 `next build` 生成完全静态的 `web/out/` 目录，可部署到 Cloudflare Pages 或其他静态网站托管平台：

```bash
pnpm --dir web build
```

Cloudflare 只负责托管静态网站，不使用 Cloudflare Worker，也不保存应用密钥或承担业务接口。

部署前需要确认：

- `web/public/wasm/` 中包含最新的 Wasm 构建产物。
- `web/public/audio/` 中包含学习内容需要的本地音频资源。
- 构建输出目录配置为 `web/out/`。

## 数据与语音策略

- 题库和知识点均随静态资源发布，不从远程业务接口获取。
- 学习进度、练习设置和错题数据保存在浏览器本地。
- 拼音朗读优先使用本地真人录音。
- 没有本地录音的文字使用浏览器 `SpeechSynthesis` 免费朗读。
- 项目不在前端保存 Azure Speech、科大讯飞等第三方 TTS 密钥。

## 文档约定

`docs/` 保存需求、知识点、游戏玩法和实现规范，属于本地工作文档，并通过 `.gitignore` 排除。README 只记录能够公开且长期有效的项目说明，不依赖 `docs/` 中的文件作为线上链接。
