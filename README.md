# play-seed

A multi-package repository for a web application backed by Rust WebAssembly and a Cloudflare Worker. Web and Worker are independent pnpm projects, while WASM is an independent Cargo project.

## Project structure

```text
.
├── web/       Next.js frontend
├── wasm/      Rust compute engine and algorithm modules compiled with wasm-pack
├── worker/    Cloudflare Worker API
└── docs/      Markdown documentation
```

## Requirements

- Node.js 20+
- pnpm 11+
- Rust and Cargo
- `wasm-pack`

Install the JavaScript dependencies:

```bash
pnpm --dir web install --frozen-lockfile
pnpm --dir worker install --frozen-lockfile
```

Start the web app and Worker together. The script installs missing Worker
dependencies and stops both services together when you press `Ctrl+C`:

```bash
./dev-local.sh
```

The default local addresses are:

- Web: http://localhost:3000
- Worker: http://localhost:8787

Build or check a project from its own directory, for example:

```bash
pnpm --dir web wasm:build
pnpm --dir web check
pnpm --dir web build
pnpm --dir worker check
pnpm --dir worker build
```

See [`docs/`](./docs/) for architecture and development notes.
