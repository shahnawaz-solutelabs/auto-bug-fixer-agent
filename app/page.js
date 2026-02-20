"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const PHASE = {
  REPO: "repo",
  SOURCE: "source",
  JIRA: "jira",
  DESCRIBE: "describe",
  RUNNING: "running",
};

function parseRepoUrl(input) {
  const trimmed = input.trim().replace(/\/+$/, "").replace(/\.git$/, "");
  const match = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) return { owner: match[1], repo: match[2] };
  const short = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (short) return { owner: short[1], repo: short[2] };
  return null;
}

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
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53ZM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.78v1.72a4.36 4.36 0 0 0 4.35 4.34V7.63a.84.84 0 0 0-.84-.84H6.77ZM2 11.6a4.35 4.35 0 0 0 4.35 4.35h1.78v1.71c0 2.4 1.94 4.35 4.34 4.35V12.44a.84.84 0 0 0-.83-.84H2Z"/>
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
          <span>{jiraEnabled ? "Paste a Jira ticket URL to auto-import the details" : "Not configured — add Jira keys to .env"}</span>
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

function MessageBubble({ msg, onSourceSelect, jiraEnabled }) {
  const isUser = msg.role === "user";
  return (
    <div className="message">
      <div className={`message-avatar ${isUser ? "user" : "agent"}`}>
        {isUser ? "U" : <BotIcon />}
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

export default function Home() {
  const [sessions, setSessions] = useState([{ id: 1, title: "New Chat", messages: [] }]);
  const [activeId, setActiveId] = useState(1);
  const [phase, setPhase] = useState(PHASE.REPO);
  const [repoInfo, setRepoInfo] = useState(null);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const nextIdRef = useRef(2);

  const session = sessions.find((s) => s.id === activeId);
  const messages = session?.messages || [];

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setJiraEnabled(d.jiraEnabled))
      .catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  function pushMessage(msg) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages: [...s.messages, msg] } : s
      )
    );
  }

  function updateLastAgentMessage(updater) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeId) return s;
        const msgs = [...s.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "agent" && msgs[i].steps) {
            msgs[i] = updater(msgs[i]);
            break;
          }
        }
        return { ...s, messages: msgs };
      })
    );
  }

  function handleNewChat() {
    const id = nextIdRef.current++;
    setSessions((prev) => [...prev, { id, title: "New Chat", messages: [] }]);
    setActiveId(id);
    setPhase(PHASE.REPO);
    setRepoInfo(null);
    setInput("");
  }

  function handleSourceSelect(choice) {
    if (choice === "jira" && !jiraEnabled) return;

    pushMessage({ role: "user", text: choice === "jira" ? "Use a Jira ticket" : "Describe manually" });

    if (choice === "jira") {
      pushMessage({ role: "agent", text: "Paste your Jira ticket URL (e.g. https://company.atlassian.net/browse/PROJ-123)." });
      setPhase(PHASE.JIRA);
    } else {
      pushMessage({ role: "agent", text: "Describe the bug or task you'd like me to fix." });
      setPhase(PHASE.DESCRIBE);
    }
  }

  async function runPipeline(description) {
    setPhase(PHASE.RUNNING);

    const pipelineMsg = {
      role: "agent",
      text: null,
      steps: [{ label: "Starting pipeline…", status: "running" }],
      result: null,
    };
    pushMessage(pipelineMsg);

    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          description,
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
              pushMessage({ role: "agent", text: `Error: ${event.message}` });
            }
          } catch {
            // ignore partial chunk parse errors
          }
        }
      }
    } catch (err) {
      pushMessage({ role: "agent", text: `Something went wrong: ${err.message}` });
    }

    setPhase(PHASE.SOURCE);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (phase === PHASE.REPO) {
      const parsed = parseRepoUrl(text);
      pushMessage({ role: "user", text });

      if (!parsed) {
        pushMessage({ role: "agent", text: "That doesn't look like a valid GitHub repo URL. Please paste a link like https://github.com/owner/repo or use owner/repo shorthand." });
        return;
      }

      setRepoInfo(parsed);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, title: `${parsed.owner}/${parsed.repo}` } : s
        )
      );
      pushMessage({
        role: "agent",
        text: `Got it — I'll work on **${parsed.owner}/${parsed.repo}**. How would you like to provide the task?`,
        sourcePicker: true,
      });
      setPhase(PHASE.SOURCE);
      return;
    }

    if (phase === PHASE.JIRA) {
      pushMessage({ role: "user", text });
      pushMessage({ role: "agent", text: "Fetching Jira ticket…", steps: [{ label: "Fetching Jira ticket…", status: "running" }] });

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

        pushMessage({
          role: "agent",
          text: `Imported **${data.ticket.key}** — "${data.ticket.summary}". Starting the fix pipeline now…`,
        });

        await runPipeline(data.description);
      } catch (err) {
        updateLastAgentMessage((msg) => ({
          ...msg,
          steps: [{ label: "Jira fetch failed", status: "error" }],
        }));
        pushMessage({ role: "agent", text: `Could not fetch Jira ticket: ${err.message}` });
        setPhase(PHASE.JIRA);
      }
      return;
    }

    if (phase === PHASE.DESCRIBE && repoInfo) {
      pushMessage({ role: "user", text });
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

  const inputDisabled = phase === PHASE.RUNNING || phase === PHASE.SOURCE;

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
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item${s.id === activeId ? " active" : ""}`}
              onClick={() => {
                setActiveId(s.id);
                setPhase(s.messages.length === 0 ? PHASE.REPO : PHASE.SOURCE);
              }}
            >
              {s.title}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <main className="chat-area">
        {messages.length === 0 ? (
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
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

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
      </main>
    </div>
  );
}
