import { getConfig } from "../config.js";

export class JiraFetcher {
  constructor(config) {
    const cfg = config || getConfig();
    this.email = cfg.jira.email;
    this.token = cfg.jira.apiToken;
    this.auth = Buffer.from(`${this.email}:${this.token}`).toString("base64");
  }

  parseTicketUrl(url) {
    const trimmed = url.trim();

    const browseMatch = trimmed.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (browseMatch) {
      return {
        key: browseMatch[1].toUpperCase(),
        baseUrl: this._extractBaseUrl(trimmed),
      };
    }

    const paramMatch = trimmed.match(/selectedIssue=([A-Z][A-Z0-9]+-\d+)/i);
    if (paramMatch) {
      return {
        key: paramMatch[1].toUpperCase(),
        baseUrl: this._extractBaseUrl(trimmed),
      };
    }

    return null;
  }

  _extractBaseUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return null;
    }
  }

  async fetchTicket(ticketKey, baseUrl) {
    if (!baseUrl) {
      throw new Error("Could not determine Jira base URL from the ticket link.");
    }

    const url = `${baseUrl}/rest/api/3/issue/${ticketKey}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error (${res.status}): ${text}`);
    }

    const data = await res.json();

    const description = this._extractText(data.fields.description);
    const comments = (data.fields.comment?.comments || [])
      .slice(-5)
      .map((c) => ({
        author: c.author?.displayName || "Unknown",
        body: this._extractText(c.body),
      }));

    return {
      key: data.key,
      summary: data.fields.summary || "",
      description,
      status: data.fields.status?.name || "",
      priority: data.fields.priority?.name || "",
      type: data.fields.issuetype?.name || "",
      labels: data.fields.labels || [],
      comments,
    };
  }

  formatAsDescription(ticket) {
    let text = `[${ticket.key}] ${ticket.summary}\n\n`;
    text += ticket.description || "(no description)";

    if (ticket.labels.length) {
      text += `\n\nLabels: ${ticket.labels.join(", ")}`;
    }

    if (ticket.comments.length) {
      text += `\n\nRecent comments:\n`;
      for (const c of ticket.comments) {
        text += `- ${c.author}: ${c.body}\n`;
      }
    }

    return text;
  }

  _extractText(adfNode) {
    if (!adfNode) return "";
    if (typeof adfNode === "string") return adfNode;

    if (adfNode.type === "text") return adfNode.text || "";

    if (adfNode.content && Array.isArray(adfNode.content)) {
      return adfNode.content.map((child) => this._extractText(child)).join("");
    }

    if (adfNode.type === "paragraph") {
      const inner = (adfNode.content || []).map((c) => this._extractText(c)).join("");
      return inner + "\n";
    }

    if (adfNode.type === "codeBlock") {
      const inner = (adfNode.content || []).map((c) => this._extractText(c)).join("");
      return "```\n" + inner + "\n```\n";
    }

    if (adfNode.type === "bulletList" || adfNode.type === "orderedList") {
      return (adfNode.content || []).map((c) => "- " + this._extractText(c)).join("");
    }

    if (adfNode.type === "listItem") {
      return (adfNode.content || []).map((c) => this._extractText(c)).join("");
    }

    if (Array.isArray(adfNode)) {
      return adfNode.map((n) => this._extractText(n)).join("");
    }

    return "";
  }
}
