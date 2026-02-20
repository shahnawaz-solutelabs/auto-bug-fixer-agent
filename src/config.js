import { resolve } from "path";

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

/**
 * Build a config object from user-provided tokens (stored in MongoDB).
 * Falls back to env vars for backward compatibility.
 */
export function buildConfig(userTokens = {}) {
  const githubToken = userTokens.githubToken || process.env.GITHUB_TOKEN || "";
  const anthropicKey = userTokens.anthropicKey || process.env.ANTHROPIC_API_KEY || "";
  const jiraEmail = userTokens.jiraEmail || process.env.JIRA_EMAIL || "";
  const jiraToken = userTokens.jiraToken || process.env.JIRA_API_TOKEN || "";

  if (!githubToken) {
    throw new Error("GitHub token is required. Add it in Settings.");
  }
  if (!anthropicKey) {
    throw new Error("Anthropic API key is required. Add it in Settings.");
  }

  return {
    github: { token: githubToken },
    anthropic: {
      apiKey: anthropicKey,
      model: optional("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
    },
    jira: {
      email: jiraEmail,
      apiToken: jiraToken,
      get enabled() {
        return !!(this.email && this.apiToken);
      },
    },
    workspaceDir: getWorkspaceDir(),
  };
}

let _config = null;

export function getConfig() {
  if (_config) return _config;
  _config = buildConfig();
  return _config;
}
