import { Octokit } from "@octokit/rest";
import { createWriteStream, existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join, relative } from "path";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { extract } from "tar";
import { getConfig } from "../config.js";

export class RepoManager {
  constructor(owner, repo) {
    this.owner = owner;
    this.repo = repo;
    const config = getConfig();
    this.octokit = new Octokit({ auth: config.github.token });
    this.localPath = join(config.workspaceDir, `${owner}--${repo}`);
    this.defaultBranch = "main";
    this.baseSha = null;
  }

  async clone() {
    const config = getConfig();
    if (!existsSync(config.workspaceDir)) {
      mkdirSync(config.workspaceDir, { recursive: true });
    }
    if (existsSync(this.localPath)) {
      rmSync(this.localPath, { recursive: true, force: true });
    }
    mkdirSync(this.localPath, { recursive: true });

    const { data: repoData } = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    this.defaultBranch = repoData.default_branch || "main";

    const { data: refData } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${this.defaultBranch}`,
    });
    this.baseSha = refData.object.sha;

    const tarballUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/tarball/${this.defaultBranch}`;
    const response = await fetch(tarballUrl, {
      headers: {
        Authorization: `token ${config.github.token}`,
        Accept: "application/vnd.github+json",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Failed to download repo tarball: ${response.status}`);
    }

    const nodeStream = readableStreamToNodeStream(response.body);
    await pipeline(
      nodeStream,
      createGunzip(),
      extract({ cwd: this.localPath, strip: 1 })
    );
  }

  async createBranch(description) {
    const slug = description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/-$/, "");
    const branchName = `ai-fix/${slug}-${Date.now().toString(36)}`;

    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: this.baseSha,
    });

    return branchName;
  }

  async commitAndPush(branchName, message, patchedFiles) {
    if (!patchedFiles.length) return false;

    const treeItems = [];

    for (const filePath of patchedFiles) {
      const fullPath = join(this.localPath, filePath);
      const content = readFileSync(fullPath, "utf-8");

      const { data: blob } = await this.octokit.git.createBlob({
        owner: this.owner,
        repo: this.repo,
        content,
        encoding: "utf-8",
      });

      treeItems.push({
        path: filePath.replace(/\\/g, "/"),
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    const { data: newTree } = await this.octokit.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: this.baseSha,
      tree: treeItems,
    });

    const { data: newCommit } = await this.octokit.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: newTree.sha,
      parents: [this.baseSha],
    });

    await this.octokit.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branchName}`,
      sha: newCommit.sha,
    });

    return true;
  }

  getLocalPath() {
    return this.localPath;
  }

  getDefaultBranch() {
    return this.defaultBranch;
  }
}

function readableStreamToNodeStream(webStream) {
  const reader = webStream.getReader();
  const { Readable } = require("stream");

  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    },
  });
}
