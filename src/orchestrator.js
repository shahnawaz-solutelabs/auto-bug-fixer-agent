import { RepoManager } from "./modules/repoManager.js";
import { ContextBuilder } from "./modules/contextBuilder.js";
import { LLMCodeFixer } from "./modules/llmCodeFixer.js";
import { PatchApplier } from "./modules/patchApplier.js";
import { TestRunner } from "./modules/testRunner.js";
import { PRCreator } from "./modules/prCreator.js";

export class Orchestrator {
  constructor(owner, repo, config) {
    this.owner = owner;
    this.repo = repo;
    this.config = config;
  }

  async run(description, { onProgress, onStepDone }) {
    const startTime = Date.now();

    onProgress("Cloning repository…");
    const repoManager = new RepoManager(this.owner, this.repo, this.config);
    await repoManager.clone();
    const repoPath = repoManager.getLocalPath();
    const baseBranch = repoManager.getDefaultBranch();
    onStepDone();

    onProgress("Creating fix branch…");
    const branchName = await repoManager.createBranch(description);
    onStepDone();

    onProgress("Analyzing codebase…");
    const contextBuilder = new ContextBuilder();
    const taskContext = { title: description.slice(0, 120), body: description };
    const fileTree = contextBuilder.formatTreeForPrompt(
      contextBuilder.buildFileTree(repoPath)
    );
    const relevantFiles = contextBuilder.findRelevantFiles(repoPath, taskContext);
    onStepDone();

    onProgress("Generating fix with Claude…");
    const llm = new LLMCodeFixer(this.config);
    const { patches, explanation } = await llm.generateFix(
      taskContext,
      fileTree,
      relevantFiles
    );
    if (!patches.length) {
      throw new Error("Claude could not generate any patches for this task.");
    }
    onStepDone();

    onProgress("Applying patches…");
    const patchApplier = new PatchApplier();
    const patchedFiles = patchApplier.apply(repoPath, patches);
    onStepDone();

    onProgress("Running tests…");
    const testRunner = new TestRunner();
    const testResult = testRunner.run(repoPath);
    onStepDone();

    onProgress("Committing and pushing…");
    const commitMsg = `fix: ${taskContext.title}\n\n${explanation}`;
    const committed = await repoManager.commitAndPush(branchName, commitMsg, patchedFiles);
    if (!committed) {
      throw new Error("Nothing was committed — the fix may not have produced changes.");
    }
    onStepDone();

    onProgress("Creating pull request…");
    const prCreator = new PRCreator(this.owner, this.repo, this.config);
    const pr = await prCreator.create({
      branchName,
      baseBranch,
      description,
      explanation,
      patchedFiles,
      testResult,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      branch: branchName,
      patchedFiles,
      testResult: { passed: testResult.passed, skipped: testResult.skipped },
      pr,
      elapsed,
    };
  }
}
