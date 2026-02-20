import { getGuardedOctokit } from "./githubGuard.js";
import { getConfig } from "../config.js";

export class PRCreator {
  constructor(owner, repo, config) {
    const cfg = config || getConfig();
    this.octokit = getGuardedOctokit(cfg);
    this.owner = owner;
    this.repo = repo;
  }

  async create({ branchName, baseBranch, description, explanation, patchedFiles, testResult }) {
    const title = `fix: ${description.slice(0, 100)}`;
    const body = this._buildBody(description, explanation, patchedFiles, testResult);

    const { data: pr } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      head: branchName,
      base: baseBranch,
      body,
    });

    try {
      await this.octokit.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: pr.number,
        labels: ["ai-generated", "bug-fix"],
      });
    } catch {
      // labels may not exist in the repo
    }

    return { number: pr.number, url: pr.html_url };
  }

  _buildBody(description, explanation, patchedFiles, testResult) {
    let body = `## AI-Generated Bug Fix\n\n`;
    body += `### Task\n${description}\n\n`;
    body += `### What was changed\n\n${explanation}\n\n`;
    body += `### Modified files\n\n`;

    for (const f of patchedFiles) {
      body += `- \`${f}\`\n`;
    }

    body += `\n### Test results\n\n`;
    if (testResult.skipped) {
      body += `⚠️ Tests were skipped (no test framework detected).\n`;
    } else if (testResult.passed) {
      body += `✅ All tests passed.\n`;
    } else {
      body += `❌ Some tests failed. Please review the changes carefully.\n`;
      body += `\n<details><summary>Test output</summary>\n\n\`\`\`\n${testResult.output.slice(-3000)}\n\`\`\`\n</details>\n`;
    }

    body += `\n---\n*This PR was created automatically by AI Bug Fixer Agent.*\n`;
    return body;
  }
}
