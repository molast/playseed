# PlaySeed

PlaySeed 是一个面向儿童的学习与游戏平台。项目将拼音、数学等知识内容融入练习和游戏机制，并通过学习进度、错题记录和积分体系组织持续学习。

目前包含以下主要内容：

- 拼音学习、练习、语音朗读与学习进度
- 数学口算、分步算法练习、批量出题与错题记录
- 拼音气球冒险、拼音赛车、MathPop 等学习游戏
- Super Mario、Bloxorz 等小游戏
- Azure Speech、科大讯飞 TTS 语音服务
- 基于 PixiJS 和 PlaySeed Mini Game Engine 的 2D 游戏能力

## 项目结构

```text
.
├── web/       Next.js 前端、学习页面、PixiJS 游戏及静态资源
├── wasm/      Rust/Wasm 算法与计算模块
├── worker/    Cloudflare Worker API 与语音服务代理
└── docs/      本地 Markdown 需求、设计和玩法文档
```

各模块相互独立：

- `web` 和 `worker` 分别维护自己的 `package.json` 与 pnpm 锁文件。
- `wasm` 是独立的 Cargo 项目，直接在 `wasm/` 中编译。
- 根目录没有 pnpm workspace、Cargo workspace 或 `package.json`。
- `docs/` 仅用于本地设计与开发参考，已被 Git 忽略，不会发布到仓库。

## 技术架构

| 模块 | 主要技术 | 职责 |
| --- | --- | --- |
| Web | Next.js、React、TypeScript、PixiJS | 学习界面、练习系统、游戏运行时、进度与错题数据 |
| Wasm | Rust、wasm-bindgen、wasm-pack | 数学出题及后续游戏算法、学习算法、OCR、音频和图像计算 |
| Worker | Cloudflare Workers、TypeScript、Wrangler | 服务端 API、TTS 凭据保护与语音请求代理 |
| Docs | Markdown | 本地需求、知识点、玩法及实现规范 |

Wasm 编译产物输出到 `web/public/wasm/`，该目录需要提交到 Git，供 Web 构建和部署直接使用。

## 环境要求

- Node.js 20+
- pnpm 11+
- Rust 与 Cargo
- `wasm-pack`

## 环境变量

运行时配置只保存在本地环境文件中，这些文件已被 Git 忽略：

```text
web/.env.local
web/.env.production
worker/.dev.vars
```

首次配置时从模板创建：

```bash
cp web/.env.example web/.env.local
cp worker/.dev.vars.example worker/.dev.vars
```

Web 配置：

```dotenv
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

Worker 配置：

```dotenv
APP_NAME=playseed-worker
SPEECH_ALLOWED_ORIGIN=http://localhost:3000

AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=eastasia

XFYUN_TTS_APP_ID=
XFYUN_TTS_API_KEY=
XFYUN_TTS_API_SECRET=
```

`SPEECH_ALLOWED_ORIGIN` 用于限制允许调用语音服务的站点。本地开发填写 `http://localhost:3000`；生产环境填写正式 Web 域名。

不要提交真实密钥。`worker/.dev.vars` 只对本地 Wrangler 生效，线上变量和密钥需要在 Cloudflare Dashboard 中单独配置。

## 安装依赖

仓库没有根目录 workspace，需要分别安装 Web 和 Worker 的依赖：

```bash
pnpm --dir web install --frozen-lockfile
pnpm --dir worker install --frozen-lockfile
```

## 本地开发

根目录脚本会同时启动 Web 和 Worker，并在按下 `Ctrl+C` 后结束两个进程：

```bash
./dev-local.sh
```

默认地址：

- Web：<http://localhost:3000>
- Worker：<http://localhost:8787>

脚本会检查 pnpm，并在 Worker 依赖缺失时自动安装。开发时请先确认本地环境变量已配置完成。

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

### Worker

```bash
pnpm --dir worker check
pnpm --dir worker build
pnpm --dir worker deploy
```

### 知识点与音频资源

```bash
pnpm --dir web knowledge:build
pnpm --dir web audio:manifest
pnpm --dir web audio:sync
```

## 部署

### Web

Web 部署到 Cloudflare Pages。生产环境需要设置：

```dotenv
NEXT_PUBLIC_WORKER_URL=https://worker.twicha.com
```

部署前确保 `web/public/wasm/` 中包含最新的 Wasm 构建产物。

### Worker

Worker 名称为 `playseed-worker`，通过 Wrangler 部署：

```bash
pnpm --dir worker deploy
```

`worker/wrangler.toml` 只保存 Worker 名称、入口、兼容日期等非敏感部署结构。生产环境的 TTS 密钥、允许访问的域名等配置应在 Cloudflare Dashboard 中维护。

## 文档约定

`docs/` 保存需求、知识点、游戏玩法和实现规范，属于本地工作文档，并通过 `.gitignore` 排除。README 只记录能够公开且长期有效的项目说明，不依赖 `docs/` 中的文件作为线上链接。
