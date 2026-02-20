import simpleGit from "simple-git";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { getConfig } from "../config.js";
import { validateGitPushArgs } from "./githubGuard.js";

export class RepoManager {
  constructor(owner, repo) {
    this.owner = owner;
    this.repo = repo;
    const config = getConfig();
    this.repoUrl = `https://x-access-token:${config.github.token}@github.com/${owner}/${repo}.git`;
    this.localPath = join(config.workspaceDir, `${owner}--${repo}`);
    this.git = null;
    this.defaultBranch = "main";
  }

  async clone() {
    const config = getConfig();
    if (!existsSync(config.workspaceDir)) {
      mkdirSync(config.workspaceDir, { recursive: true });
    }

    if (existsSync(this.localPath)) {
      rmSync(this.localPath, { recursive: true, force: true });
    }

    await simpleGit().clone(this.repoUrl, this.localPath, ["--depth", "50"]);
    this.git = simpleGit(this.localPath);

    const branches = await this.git.branch();
    this.defaultBranch = branches.current || "main";
  }

  async createBranch(description) {
    const slug = description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/-$/, "");
    const branchName = `ai-fix/${slug}-${Date.now().toString(36)}`;
    await this.git.checkoutLocalBranch(branchName);
    return branchName;
  }

  async commitAndPush(branchName, message) {
    await this.git.add(".");
    const status = await this.git.status();

    if (status.staged.length === 0 && status.modified.length === 0) {
      return false;
    }

    await this.git.commit(message);
    await this._safePush(branchName);
    return true;
  }

  async _safePush(branchName) {
    const pushFlags = ["--set-upstream"];
    validateGitPushArgs(pushFlags);

    if (branchName === "main" || branchName === "master") {
      throw new Error("GUARD: pushing directly to main/master is blocked.");
    }

    await this.git.push("origin", branchName, pushFlags);
  }

  getLocalPath() {
    return this.localPath;
  }

  getDefaultBranch() {
    return this.defaultBranch;
  }
}
