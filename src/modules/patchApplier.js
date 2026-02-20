import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

export class PatchApplier {
  apply(repoPath, patches) {
    if (!patches.length) {
      throw new Error("No patches to apply — LLM did not produce any file changes.");
    }

    const applied = [];

    for (const patch of patches) {
      const targetPath = join(repoPath, patch.filePath);
      const dir = dirname(targetPath);

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(targetPath, patch.content, "utf-8");
      applied.push(patch.filePath);
    }

    return applied;
  }
}
