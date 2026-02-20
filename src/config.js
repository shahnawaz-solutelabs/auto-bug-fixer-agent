import { resolve } from "path";

function required(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}. Add it to your .env file.`);
  }
  return val;
}

function optional(name, fallback = "") {
  return process.env[name] || fallback;
}

let _config = null;

export function getConfig() {
  if (_config) return _config;

  _config = {
    github: {
      token: required("GITHUB_TOKEN"),
    },
    anthropic: {
      apiKey: required("ANTHROPIC_API_KEY"),
      model: optional("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
    },
    jira: {
      email: optional("JIRA_EMAIL"),
      apiToken: optional("JIRA_API_TOKEN"),
      get enabled() {
        return !!(this.email && this.apiToken);
      },
    },
    workspaceDir: resolve(
      optional("WORKSPACE_DIR", "")
        || (process.env.VERCEL ? "/tmp/workspace" : "./workspace")
    ),
  };

  return _config;
}
