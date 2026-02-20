"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const PHASE = {
  REPO: "repo",
  SOURCE: "source",
  JIRA: "jira",
  DESCRIBE: "describe",
  RUNNING: "running",
};

const VIEW = {
  CHAT: "chat",
  SETTINGS: "settings",
};

function parseRepoUrl(input) {
  const trimmed = input.trim().replace(/\/+$/, "").replace(/\.git$/, "");
  const match = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) return { owner: match[1], repo: match[2] };
  const short = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (short) return { owner: short[1], repo: short[2] };
  return null;
}

// ── Icons ────────────────────────────────────────────────────

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="step-icon running" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="step-icon done" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="step-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function JiraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53ZM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.78v1.72a4.36 4.36 0 0 0 4.35 4.34V7.63a.84.84 0 0 0-.84-.84H6.77ZM2 11.6a4.35 4.35 0 0 0 4.35 4.35h1.78v1.71c0 2.4 1.94 4.35 4.34 4.35V12.44a.84.84 0 0 0-.83-.84H2Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ── Sub-components ───────────────────────────────────────────

function PipelineMessage({ steps }) {
  return (
    <div className="pipeline-steps">
      {steps.map((s, i) => (
        <div className="pipeline-step" key={i}>
          {s.status === "running" && <SpinnerIcon />}
          {s.status === "done" && <CheckIcon />}
          {s.status === "error" && <ErrorIcon />}
          <span className={`step-label${s.status === "running" ? " active" : ""}`}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ data }) {
  return (
    <div className="result-card">
      <div className="result-card-header">
        <CheckIcon /> Pipeline Complete
      </div>
      <div className="result-card-body">
        <div className="result-row">
          <span className="result-label">Branch</span>
          <span className="result-value"><code>{data.branch}</code></span>
        </div>
        <div className="result-row">
          <span className="result-label">Files</span>
          <span className="result-value">{data.patchedFiles?.join(", ")}</span>
        </div>
        <div className="result-row">
          <span className="result-label">Tests</span>
          <span className="result-value">
            {data.testResult?.skipped ? (
              <span className="badge skipped">Skipped</span>
            ) : data.testResult?.passed ? (
              <span className="badge passed">Passed</span>
            ) : (
              <span className="badge failed">Failed</span>
            )}
          </span>
        </div>
        {data.pr?.url && (
          <div className="result-row">
            <span className="result-label">PR</span>
            <span className="result-value">
              <a href={data.pr.url} target="_blank" rel="noopener noreferrer">{data.pr.url}</a>
            </span>
          </div>
        )}
        {data.elapsed && (
          <div className="result-row">
            <span className="result-label">Time</span>
            <span className="result-value">{data.elapsed}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SourcePicker({ onSelect, jiraEnabled }) {
  return (
    <div className="source-picker">
      <div className="source-card" onClick={() => onSelect("jira")} data-disabled={!jiraEnabled}>
        <div className="source-card-icon jira"><JiraIcon /></div>
        <div className="source-card-text">
          <strong>Jira Ticket</strong>
          <span>{jiraEnabled ? "Paste a Jira ticket URL to auto-import the details" : "Not configured — add Jira tokens in Settings"}</span>
        </div>
      </div>
      <div className="source-card" onClick={() => onSelect("manual")}>
        <div className="source-card-icon manual"><PencilIcon /></div>
        <div className="source-card-text">
          <strong>Manual Description</strong>
          <span>Describe the bug or task in your own words</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onSourceSelect, jiraEnabled, userImage }) {
  const isUser = msg.role === "user";
  return (
    <div className="message">
      <div className={`message-avatar ${isUser ? "user" : "agent"}`}>
        {isUser ? (
          userImage ? <img src={userImage} alt="" referrerPolicy="no-referrer" /> : "U"
        ) : (
          <BotIcon />
        )}
      </div>
      <div className="message-body">
        <div className="message-sender">{isUser ? "You" : "AI Bug Fixer"}</div>
        <div className="message-content">
          {msg.text && <p>{msg.text}</p>}
          {msg.sourcePicker && <SourcePicker onSelect={onSourceSelect} jiraEnabled={jiraEnabled} />}
          {msg.steps && <PipelineMessage steps={msg.steps} />}
          {msg.result && <ResultCard data={msg.result} />}
        </div>
      </div>
    </div>
  );
}

// ── Token Gating Banner ──────────────────────────────────────

function TokenGatingBanner({ onGoToSettings }) {
  return (
    <div className="token-gate">
      <div className="token-gate-icon">
        <SettingsIcon />
      </div>
      <h3>Setup Required</h3>
      <p>
        Before you can start fixing bugs, you need to add your API tokens.
        At minimum, a <strong>GitHub Token</strong> and an <strong>Anthropic API Key</strong> are required.
      </p>
      <button className="token-gate-btn" onClick={onGoToSettings}>
        <SettingsIcon /> Go to Settings
      </button>
    </div>
  );
}

// ── Settings Panel ───────────────────────────────────────────

function SettingsPanel({ onBack }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    githubToken: "",
    anthropicKey: "",
    jiraEmail: "",
    jiraToken: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setForm({
          githubToken: data.githubToken || "",
          anthropicKey: data.anthropicKey || "",
          jiraEmail: data.jiraEmail || "",
          jiraToken: data.jiraToken || "",
        });
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error handling
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <div className="settings-panel"><div className="settings-loading">Loading settings…</div></div>;
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <button className="settings-back" onClick={onBack}>&larr; Back to Chat</button>
        <h2>Settings</h2>
        <p>Manage your API tokens for GitHub, Anthropic, and Jira integrations.</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3>GitHub</h3>
          <span className={`token-status ${settings.hasGithub ? "configured" : "missing"}`}>
            {settings.hasGithub ? "Configured" : "Required"}
          </span>
        </div>
        <label className="settings-label">
          Personal Access Token
          <input
            type="password"
            className="settings-input"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={form.githubToken}
            onChange={(e) => setForm({ ...form, githubToken: e.target.value })}
          />
          <span className="settings-hint">Requires <code>repo</code> scope</span>
        </label>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Anthropic (Claude)</h3>
          <span className={`token-status ${settings.hasAnthropic ? "configured" : "missing"}`}>
            {settings.hasAnthropic ? "Configured" : "Required"}
          </span>
        </div>
        <label className="settings-label">
          API Key
          <input
            type="password"
            className="settings-input"
            placeholder="sk-ant-xxxxxxxxxxxxxxxx"
            value={form.anthropicKey}
            onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })}
          />
        </label>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Jira</h3>
          <span className={`token-status ${settings.hasJira ? "configured" : "optional"}`}>
            {settings.hasJira ? "Configured" : "Optional"}
          </span>
        </div>
        <label className="settings-label">
          Email
          <input
            type="email"
            className="settings-input"
            placeholder="you@company.com"
            value={form.jiraEmail}
            onChange={(e) => setForm({ ...form, jiraEmail: e.target.value })}
          />
        </label>
        <label className="settings-label">
          API Token
          <input
            type="password"
            className="settings-input"
            placeholder="your-jira-api-token"
            value={form.jiraToken}
            onChange={(e) => setForm({ ...form, jiraToken: e.target.value })}
          />
        </label>
      </div>

      <div className="settings-actions">
        <button className="settings-save" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────

function LoginScreen() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">
          <BotIcon />
        </div>
        <h1>AI Bug Fixer Agent</h1>
        <p>
          Automatically fix bugs in your GitHub repos using AI.
          Sign in to get started.
        </p>
        <button className="google-login-btn" onClick={() => signIn("google")}>
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────

export default function Home() {
  const { data: session, status } = useSession();

  const [view, setView] = useState(VIEW.CHAT);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState(PHASE.REPO);
  const [repoInfo, setRepoInfo] = useState(null);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [hasTokens, setHasTokens] = useState(false);
  const [input, setInput] = useState("");
  const [loadingConv, setLoadingConv] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load config on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setJiraEnabled(d.jiraEnabled);
        setHasTokens(d.hasTokens);
      })
      .catch(() => {});
  }, [status]);

  // Load conversations list
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((convs) => {
        if (Array.isArray(convs)) setConversations(convs);
      })
      .catch(() => {});
  }, [status]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // Load a conversation's messages
  async function loadConversation(convId) {
    setLoadingConv(true);
    try {
      const res = await fetch(`/api/conversations?id=${convId}`);
      const conv = await res.json();
      setActiveConvId(convId);
      setMessages(conv.messages || []);
      setPhase(conv.phase || PHASE.REPO);
      setRepoInfo(conv.repoInfo || null);
    } catch {
      // ignore
    } finally {
      setLoadingConv(false);
    }
  }

  async function handleNewChat() {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: "New Chat" }),
      });
      const conv = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv._id);
      setMessages([]);
      setPhase(PHASE.REPO);
      setRepoInfo(null);
      setInput("");
      setView(VIEW.CHAT);
    } catch {
      // ignore
    }
  }

  async function handleDeleteConversation(convId, e) {
    e.stopPropagation();
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", conversationId: convId }),
      });
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
        setPhase(PHASE.REPO);
        setRepoInfo(null);
      }
    } catch {
      // ignore
    }
  }

  function pushMsg(msg) {
    setMessages((prev) => [...prev, msg]);
    if (activeConvId) {
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pushMessage",
          conversationId: activeConvId,
          message: msg,
        }),
      }).catch(() => {});
    }
  }

  function updateLastAgentMessage(updater) {
    setMessages((prev) => {
      const msgs = [...prev];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "agent" && msgs[i].steps) {
          msgs[i] = updater(msgs[i]);
          break;
        }
      }
      return msgs;
    });
  }

  function persistConvUpdate(updates) {
    if (!activeConvId) return;
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        conversationId: activeConvId,
        updates,
      }),
    }).catch(() => {});
  }

  function handleSourceSelect(choice) {
    if (choice === "jira" && !jiraEnabled) return;

    pushMsg({ role: "user", text: choice === "jira" ? "Use a Jira ticket" : "Describe manually" });

    if (choice === "jira") {
      pushMsg({ role: "agent", text: "Paste your Jira ticket URL (e.g. https://company.atlassian.net/browse/PROJ-123)." });
      setPhase(PHASE.JIRA);
      persistConvUpdate({ phase: PHASE.JIRA });
    } else {
      pushMsg({ role: "agent", text: "Describe the bug or task you'd like me to fix." });
      setPhase(PHASE.DESCRIBE);
      persistConvUpdate({ phase: PHASE.DESCRIBE });
    }
  }

  async function runPipeline(description) {
    setPhase(PHASE.RUNNING);
    persistConvUpdate({ phase: PHASE.RUNNING });

    const pipelineMsg = {
      role: "agent",
      text: null,
      steps: [{ label: "Starting pipeline…", status: "running" }],
      result: null,
    };
    pushMsg(pipelineMsg);

    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          description,
          conversationId: activeConvId,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const chunk of lines) {
          if (!chunk.startsWith("data: ")) continue;
          const jsonStr = chunk.slice(6);
          if (jsonStr === "[DONE]") continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "step") {
              updateLastAgentMessage((msg) => {
                const steps = [...msg.steps];
                const running = steps.findIndex((s) => s.status === "running");
                if (running >= 0) steps[running] = { ...steps[running], status: "done" };
                steps.push({ label: event.label, status: "running" });
                return { ...msg, steps };
              });
            }

            if (event.type === "step_done") {
              updateLastAgentMessage((msg) => {
                const steps = msg.steps.map((s) =>
                  s.status === "running" ? { ...s, status: "done" } : s
                );
                return { ...msg, steps };
              });
            }

            if (event.type === "result") {
              updateLastAgentMessage((msg) => {
                const steps = msg.steps.map((s) =>
                  s.status === "running" ? { ...s, status: "done" } : s
                );
                return { ...msg, steps, result: event.data };
              });
            }

            if (event.type === "error") {
              updateLastAgentMessage((msg) => {
                const steps = msg.steps.map((s) =>
                  s.status === "running" ? { ...s, status: "error", label: s.label + " — failed" } : s
                );
                return { ...msg, steps };
              });
              pushMsg({ role: "agent", text: `Error: ${event.message}` });
            }
          } catch {
            // ignore partial chunk parse errors
          }
        }
      }
    } catch (err) {
      pushMsg({ role: "agent", text: `Something went wrong: ${err.message}` });
    }

    setPhase(PHASE.SOURCE);
    persistConvUpdate({ phase: PHASE.SOURCE });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (!activeConvId) {
      await handleNewChat();
    }

    if (phase === PHASE.REPO) {
      const parsed = parseRepoUrl(text);
      pushMsg({ role: "user", text });

      if (!parsed) {
        pushMsg({ role: "agent", text: "That doesn't look like a valid GitHub repo URL. Please paste a link like https://github.com/owner/repo or use owner/repo shorthand." });
        return;
      }

      setRepoInfo(parsed);
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConvId ? { ...c, title: `${parsed.owner}/${parsed.repo}` } : c
        )
      );
      persistConvUpdate({
        title: `${parsed.owner}/${parsed.repo}`,
        repoInfo: parsed,
        phase: PHASE.SOURCE,
      });
      pushMsg({
        role: "agent",
        text: `Got it — I'll work on **${parsed.owner}/${parsed.repo}**. How would you like to provide the task?`,
        sourcePicker: true,
      });
      setPhase(PHASE.SOURCE);
      return;
    }

    if (phase === PHASE.JIRA) {
      pushMsg({ role: "user", text });
      pushMsg({ role: "agent", text: "Fetching Jira ticket…", steps: [{ label: "Fetching Jira ticket…", status: "running" }] });

      try {
        const res = await fetch("/api/jira", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketUrl: text }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch ticket");
        }

        updateLastAgentMessage((msg) => ({
          ...msg,
          steps: [{ label: `Fetched ${data.ticket.key}: ${data.ticket.summary}`, status: "done" }],
        }));

        pushMsg({
          role: "agent",
          text: `Imported **${data.ticket.key}** — "${data.ticket.summary}". Starting the fix pipeline now…`,
        });

        await runPipeline(data.description);
      } catch (err) {
        updateLastAgentMessage((msg) => ({
          ...msg,
          steps: [{ label: "Jira fetch failed", status: "error" }],
        }));
        pushMsg({ role: "agent", text: `Could not fetch Jira ticket: ${err.message}` });
        setPhase(PHASE.JIRA);
      }
      return;
    }

    if (phase === PHASE.DESCRIBE && repoInfo) {
      pushMsg({ role: "user", text });
      await runPipeline(text);
      return;
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Loading / Auth states ──────────────────────────────────

  if (status === "loading") {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  // ── Authenticated UI ──────────────────────────────────────

  const placeholder =
    phase === PHASE.REPO
      ? "Paste a GitHub repo URL (e.g. https://github.com/owner/repo)…"
      : phase === PHASE.JIRA
        ? "Paste a Jira ticket URL (e.g. https://company.atlassian.net/browse/PROJ-123)…"
        : phase === PHASE.DESCRIBE
          ? "Describe the bug or task you want fixed…"
          : phase === PHASE.RUNNING
            ? "Pipeline running…"
            : "Choose an option above…";

  const inputDisabled = phase === PHASE.RUNNING || phase === PHASE.SOURCE || !hasTokens;

  const phaseHintText =
    phase === PHASE.REPO
      ? "Step 1 of 3 — Provide the GitHub repository"
      : phase === PHASE.SOURCE
        ? `Working on ${repoInfo?.owner}/${repoInfo?.repo} — Step 2 of 3 — Choose input method`
        : phase === PHASE.JIRA
          ? `Working on ${repoInfo?.owner}/${repoInfo?.repo} — Step 2 of 3 — Paste Jira ticket`
          : phase === PHASE.DESCRIBE
            ? `Working on ${repoInfo?.owner}/${repoInfo?.repo} — Step 3 of 3 — Describe the task`
            : null;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <BotIcon />
          <h1>Bug Fixer</h1>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>

        <div className="session-list">
          {conversations.map((c) => (
            <div
              key={c._id}
              className={`session-item${c._id === activeConvId ? " active" : ""}`}
              onClick={() => {
                loadConversation(c._id);
                setView(VIEW.CHAT);
              }}
            >
              <span className="session-title">{c.title}</span>
              <button
                className="session-delete"
                onClick={(e) => handleDeleteConversation(c._id, e)}
                title="Delete conversation"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className={`sidebar-settings-btn${view === VIEW.SETTINGS ? " active" : ""}`}
            onClick={() => setView(view === VIEW.SETTINGS ? VIEW.CHAT : VIEW.SETTINGS)}
          >
            <SettingsIcon /> Settings
          </button>
          <div className="sidebar-user">
            {session?.user?.image && (
              <img src={session.user.image} alt="" className="sidebar-user-avatar" referrerPolicy="no-referrer" />
            )}
            <span className="sidebar-user-name">{session?.user?.name}</span>
            <button className="sidebar-signout" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="chat-area">
        {view === VIEW.SETTINGS ? (
          <SettingsPanel onBack={() => {
            setView(VIEW.CHAT);
            fetch("/api/config")
              .then((r) => r.json())
              .then((d) => {
                setJiraEnabled(d.jiraEnabled);
                setHasTokens(d.hasTokens);
              })
              .catch(() => {});
          }} />
        ) : !hasTokens ? (
          <TokenGatingBanner onGoToSettings={() => setView(VIEW.SETTINGS)} />
        ) : !activeConvId ? (
          <div className="welcome">
            <div className="welcome-icon">
              <BotIcon />
            </div>
            <h2>AI Bug Fixer Agent</h2>
            <p>
              Paste a GitHub repository URL to get started. Then provide a Jira
              ticket or describe the bug manually — I will clone the repo,
              generate a fix, run tests, and open a pull request automatically.
            </p>
          </div>
        ) : loadingConv ? (
          <div className="welcome">
            <div className="loading-spinner" />
            <p>Loading conversation…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-icon">
              <BotIcon />
            </div>
            <h2>AI Bug Fixer Agent</h2>
            <p>
              Paste a GitHub repository URL to get started. Then provide a Jira
              ticket or describe the bug manually — I will clone the repo,
              generate a fix, run tests, and open a pull request automatically.
            </p>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                onSourceSelect={handleSourceSelect}
                jiraEnabled={jiraEnabled}
                userImage={session?.user?.image}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {view === VIEW.CHAT && hasTokens && (
          <div className="chat-input-bar">
            {phaseHintText && phase !== PHASE.RUNNING && (
              <div className="phase-hint">{phaseHintText}</div>
            )}
            <div className="chat-input-wrapper">
              <textarea
                ref={inputRef}
                className="chat-input"
                rows={1}
                placeholder={placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={inputDisabled || !input.trim()}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
