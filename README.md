# AI Bug Fixer Agent

A full-stack chatbot that resolves GitHub bugs and creates pull requests automatically. Paste a repo URL, describe the bug, and the agent clones the repo, generates a fix with Claude, runs tests, and opens a PR — all streamed live to the chat UI.

## Architecture

```
Chat UI (Next.js)
  ↓ POST /api/fix (SSE stream)
Agent Orchestrator
  ↓
Repo Manager (git clone, branch)
  ↓
Context Builder (scan codebase)
  ↓
LLM Code Fixer (Anthropic Claude)
  ↓
Patch Applier (write changes)
  ↓
Test Runner (auto-detect & run)
  ↓
Git Commit & Push
  ↓
PR Creator (GitHub API)
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo` scope |
| `ANTHROPIC_API_KEY` | Yes | Anthropic (Claude) API key |
| `CLAUDE_MODEL` | No | Model name (default: `claude-sonnet-4-20250514`) |
| `WORKSPACE_DIR` | No | Directory for cloned repos (default: `./workspace`) |

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Use the chatbot

1. **Paste a GitHub repo URL** (e.g. `https://github.com/owner/repo`)
2. **Describe the bug or task** in plain text
3. Watch the pipeline run in real-time and get a PR link at the end

## Project Structure

```
app/
├── layout.js             # Root layout
├── page.js               # Chat UI (React client component)
├── globals.css           # Dark theme styles
└── api/fix/route.js      # SSE streaming API endpoint
src/
├── orchestrator.js       # Pipeline coordinator
├── config.js             # Environment config
└── modules/
    ├── repoManager.js    # Git clone, branch, commit, push
    ├── contextBuilder.js # Codebase scanning & file relevance
    ├── llmCodeFixer.js   # Claude-powered code fix generation
    ├── patchApplier.js   # Write patches to filesystem
    ├── testRunner.js     # Auto-detect & run test suites
    └── prCreator.js      # Create GitHub pull requests
```

## License

MIT
