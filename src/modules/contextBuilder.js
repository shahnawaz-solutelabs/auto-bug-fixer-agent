import { readFileSync, readdirSync } from "fs";
import { join, extname, relative } from "path";

const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".rb", ".rs",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".php", ".swift", ".kt",
  ".vue", ".svelte", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
  ".toml", ".md", ".sh", ".bash", ".sql",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".next", ".nuxt", "vendor", "target", "coverage", ".venv", "venv",
]);

export class ContextBuilder {
  buildFileTree(dir, maxDepth = 4, depth = 0) {
    if (depth >= maxDepth) return [];
    const entries = [];

    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;

        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          entries.push({
            type: "dir",
            name: entry.name,
            children: this.buildFileTree(fullPath, maxDepth, depth + 1),
          });
        } else if (CODE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          entries.push({ type: "file", name: entry.name });
        }
      }
    } catch {
      // permission errors etc.
    }

    return entries;
  }

  findRelevantFiles(repoPath, taskContext) {
    const searchTerms = this._extractSearchTerms(taskContext);
    const relevant = [];

    this._walkFiles(repoPath, (filePath) => {
      const ext = extname(filePath).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) return;

      const relPath = relative(repoPath, filePath);
      try {
        const content = readFileSync(filePath, "utf-8");
        const score = this._scoreFile(relPath, content, searchTerms);
        if (score > 0) {
          relevant.push({ path: relPath, content, score });
        }
      } catch {
        // skip unreadable files
      }
    });

    relevant.sort((a, b) => b.score - a.score);
    return relevant.slice(0, 15);
  }

  _extractSearchTerms(taskContext) {
    const text = `${taskContext.title} ${taskContext.body}`;
    const codeBlocks = text.match(/`([^`]+)`/g) || [];
    const symbols = codeBlocks.map((b) => b.replace(/`/g, ""));

    const words = text
      .replace(/[^a-zA-Z0-9_.\-/]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);

    return [...new Set([...symbols, ...words])];
  }

  _scoreFile(relPath, content, terms) {
    let score = 0;
    const lower = `${relPath}\n${content}`.toLowerCase();

    for (const term of terms) {
      const tLower = term.toLowerCase();
      if (lower.includes(tLower)) {
        score += relPath.toLowerCase().includes(tLower) ? 5 : 1;
      }
    }
    return score;
  }

  _walkFiles(dir, callback) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          this._walkFiles(full, callback);
        } else {
          callback(full);
        }
      }
    } catch {
      // skip
    }
  }

  formatTreeForPrompt(tree, indent = "") {
    let result = "";
    for (const entry of tree) {
      if (entry.type === "dir") {
        result += `${indent}${entry.name}/\n`;
        result += this.formatTreeForPrompt(entry.children, indent + "  ");
      } else {
        result += `${indent}${entry.name}\n`;
      }
    }
    return result;
  }
}
