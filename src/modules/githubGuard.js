import { Octokit } from "@octokit/rest";
import { getConfig } from "../config.js";

const ALLOWED_OPERATIONS = [
  "pulls.create",
  "issues.addLabels",
];

const BLOCKED_GIT_FLAGS = [
  "--force",
  "-f",
  "--delete",
  "-d",
  "-D",
  "--force-with-lease",
];

class PermissionDeniedError extends Error {
  constructor(operation) {
    super(`GUARD: operation "${operation}" is blocked. The AI agent only has permission to create pull requests.`);
    this.name = "PermissionDeniedError";
    this.operation = operation;
  }
}

export class GitHubGuard {
  constructor() {
    const config = getConfig();
    this._raw = new Octokit({ auth: config.github.token });
    this._octokit = this._buildProxy();
  }

  get octokit() {
    return this._octokit;
  }

  _buildProxy() {
    const raw = this._raw;

    return new Proxy(raw, {
      get(target, namespace) {
        const ns = target[namespace];
        if (typeof ns !== "object" || ns === null) return ns;

        return new Proxy(ns, {
          get(nsTarget, method) {
            const fn = nsTarget[method];
            if (typeof fn !== "function") return fn;

            const key = `${namespace}.${method}`;

            if (!ALLOWED_OPERATIONS.includes(key)) {
              return async () => {
                throw new PermissionDeniedError(key);
              };
            }

            return fn.bind(nsTarget);
          },
        });
      },
    });
  }
}

export function validateGitPushArgs(args) {
  for (const arg of args) {
    if (BLOCKED_GIT_FLAGS.includes(arg)) {
      throw new PermissionDeniedError(`git push ${arg}`);
    }
  }
}

export function getGuardedOctokit() {
  const guard = new GitHubGuard();
  return guard.octokit;
}
