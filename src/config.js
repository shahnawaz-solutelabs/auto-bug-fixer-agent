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

function getWorkspaceDir() {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  if (isServerless) return "/tmp/workspace";

  const custom = process.env.WORKSPACE_DIR;
  if (custom) return resolve(process.cwd(), custom);

  return resolve(process.cwd(), "./workspace");
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
    workspaceDir: getWorkspaceDir(),
  };

  return _config;
}
