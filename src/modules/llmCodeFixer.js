import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../config.js";

export class LLMCodeFixer {
  constructor(config) {
    const cfg = config || getConfig();
    this.client = new Anthropic({ apiKey: cfg.anthropic.apiKey });
    this.model = cfg.anthropic.model;
  }

  async generateFix(taskContext, fileTree, relevantFiles) {
    const systemPrompt = this._buildSystemPrompt();
    const userPrompt = this._buildUserPrompt(taskContext, fileTree, relevantFiles);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    if (!content) throw new Error("Claude returned empty response");

    const patches = this._parsePatches(content);
    const explanation = this._parseExplanation(content);

    return { patches, explanation, rawResponse: content };
  }

  _buildSystemPrompt() {
    return `You are an expert software engineer tasked with fixing bugs in code repositories.

RULES:
1. Analyze the task description and the provided source files carefully.
2. Produce MINIMAL, TARGETED changes — only modify what is necessary to fix the bug.
3. Do NOT refactor unrelated code or add features beyond the bug fix.
4. Return your fix as one or more FILE PATCHES in the exact format below.
5. Each patch must specify the FULL file path (relative to repo root) and the COMPLETE new file content.
6. After the patches, provide a short EXPLANATION section.

OUTPUT FORMAT (strict):

===PATCH filename.ext===
<full new file content>
===END_PATCH===

===PATCH another/file.ext===
<full new file content>
===END_PATCH===

===EXPLANATION===
<one paragraph explaining what was wrong and how you fixed it>
===END_EXPLANATION===`;
  }

  _buildUserPrompt(taskContext, fileTree, relevantFiles) {
    let prompt = `## Task: ${taskContext.title}\n\n`;
    prompt += `### Description\n${taskContext.body}\n\n`;

    prompt += `### Repository Structure\n\`\`\`\n${fileTree}\n\`\`\`\n\n`;

    prompt += `### Relevant Source Files\n\n`;
    for (const file of relevantFiles) {
      const truncated =
        file.content.length > 8000
          ? file.content.slice(0, 8000) + "\n… (truncated)"
          : file.content;
      prompt += `#### ${file.path}\n\`\`\`\n${truncated}\n\`\`\`\n\n`;
    }

    prompt += `\nPlease fix the bug or implement the task described above. Return your changes using the PATCH format from your instructions.`;
    return prompt;
  }

  _parsePatches(content) {
    const patches = [];
    const regex = /===PATCH\s+(.+?)===\n([\s\S]*?)===END_PATCH===/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      patches.push({ filePath: match[1].trim(), content: match[2] });
    }

    if (patches.length === 0) {
      const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
      let blockMatch;
      while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
        const block = blockMatch[1];
        const firstLine = block.split("\n")[0];
        if (firstLine.includes("/") || firstLine.includes(".")) {
          patches.push({
            filePath: firstLine.trim(),
            content: block.split("\n").slice(1).join("\n"),
          });
        }
      }
    }

    return patches;
  }

  _parseExplanation(content) {
    const match = content.match(
      /===EXPLANATION===\n([\s\S]*?)===END_EXPLANATION===/
    );
    if (match) return match[1].trim();
    return content.split("\n").slice(-10).join("\n");
  }
}
