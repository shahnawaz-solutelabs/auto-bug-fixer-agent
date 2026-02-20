import { Octokit } from "@octokit/rest";
import { getConfig } from "../config.js";

const ALLOWED_SCOPES = new Set([
  "pulls.create",
  "issues.addLabels",
  "repos.get",
  "git.getRef",
  "git.createRef",
  "git.createBlob",
  "git.createTree",
  "git.createCommit",
  "git.updateRef",
]);

function createGuard(octokit) {
  return new Proxy(octokit, {
    get(target, prop) {
      const val = target[prop];
      if (typeof val !== "object" || val === null) return val;

      return new Proxy(val, {
        get(innerTarget, innerProp) {
          const fn = innerTarget[innerProp];
          if (typeof fn !== "function") return fn;

          const scope = `${prop}.${innerProp}`;
          if (!ALLOWED_SCOPES.has(scope)) {
            return () => {
              throw new Error(`GitHub operation "${scope}" is not allowed by the security guard.`);
            };
          }
          return fn.bind(innerTarget);
        },
      });
    },
  });
}

export function getGuardedOctokit(config) {
  const cfg = config || getConfig();
  const octokit = new Octokit({ auth: cfg.github.token });
  return createGuard(octokit);
}
