import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY;

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const STORAGE_KEY = 'gemini_chat_sessions';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getStoredSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

const TypingDots = () => (
  <div className="typing-dots">
    <span /><span /><span />
  </div>
);

const MarkdownText = ({ text }) => {
  const formatted = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre><code>${code}</code></pre>`;
    })
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('gemini_theme') || 'dark');
  const [sessions, setSessions] = useState(getStoredSessions);
  const [activeId, setActiveId] = useState(() => {
    const stored = getStoredSessions();
    return stored.length > 0 ? stored[0].id : null;
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeId);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gemini_theme', theme);
  }, [theme]);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  const createSession = useCallback(() => {
    const newSession = {
      id: generateId(),
      title: 'New Chat',
      createdAt: Date.now(),
      messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveId(newSession.id);
    setInput('');
  }, []);

  useEffect(() => {
    if (!activeId && sessions.length === 0) {
      createSession();
    }
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null);
        if (next.length === 0) {
          setTimeout(() => createSession(), 0);
        }
      }
      return next;
    });
    setDeleteConfirm(null);
  }, [activeId, createSession]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg = { id: generateId(), role: 'user', text: trimmed, ts: Date.now() };

    let sessionId = activeId;
    if (!sessionId) {
      const newSession = {
        id: generateId(),
        title: trimmed.slice(0, 32) + (trimmed.length > 32 ? '…' : ''),
        createdAt: Date.now(),
        messages: [],
      };
      setSessions(prev => [newSession, ...prev]);
      sessionId = newSession.id;
      setActiveId(sessionId);
    }

    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            title: s.messages.length === 0 ? (trimmed.slice(0, 32) + (trimmed.length > 32 ? '…' : '')) : s.title,
            messages: [...s.messages, userMsg],
          }
        : s
    ));
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const currentSession = sessions.find(s => s.id === sessionId);
      const history = (currentSession?.messages || []).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));
      history.push({ role: 'user', parts: [{ text: trimmed }] });

      const res = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: history }),
      });

      const data = await res.json();
      const botText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not get a response.';
      const botMsg = { id: generateId(), role: 'model', text: botText, ts: Date.now() };

      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, botMsg] }
          : s
      ));
    } catch (err) {
      const errMsg = { id: generateId(), role: 'model', text: '⚠️ Error connecting to Gemini. Check your API key or network.', ts: Date.now() };
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, errMsg] } : s
      ));
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [input, isLoading, activeId, sessions]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    setInput(el.value);
  };

  const clearAll = () => {
    setSessions([]);
    localStorage.removeItem(STORAGE_KEY);
    createSession();
  };

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-mark">
            <div className="logo-icon">G</div>
            <span className="logo-text">GeminiChat</span>
          </div>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)} title="Close sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={createSession}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Chat
        </button>

        <div className="sessions-label">Recent</div>

        <div className="sessions-list">
          {sessions.length === 0 && (
            <div className="no-sessions">No chats yet</div>
          )}
          {sessions.map((s, i) => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeId ? 'active' : ''}`}
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => setActiveId(s.id)}
            >
              <div className="session-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <span className="session-title">{s.title}</span>
              {deleteConfirm === s.id ? (
                <div className="delete-confirm">
                  <button className="confirm-yes" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}>✓</button>
                  <button className="confirm-no" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}>✗</button>
                </div>
              ) : (
                <button
                  className="delete-btn"
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id); }}
                  title="Delete"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="clear-btn" onClick={clearAll}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6"/>
            </svg>
            Clear all history
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button className="icon-btn" onClick={() => setSidebarOpen(true)} title="Open sidebar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
            {!sidebarOpen && (
              <span className="topbar-title">
                {activeSession?.title || 'GeminiChat'}
              </span>
            )}
          </div>

          <div className="topbar-right">
            <div className="model-badge">gemini-2.0-flash</div>
            <button
              className="theme-toggle"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        <div className="messages-area">
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="welcome-screen">
              <div className="welcome-gem">
                <div className="gem-inner">✦</div>
              </div>
              <h1 className="welcome-title">Hello, Explorer</h1>
              <p className="welcome-sub">Ask me anything. I'm powered by Gemini.</p>
              <div className="suggestion-chips">
                {['Explain quantum computing', 'Write a haiku about AI', 'Debug my Python code', 'Plan a trip to Tokyo'].map(s => (
                  <button key={s} className="chip" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`message-row ${msg.role}`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            >
              <div className={`avatar ${msg.role}`}>
                {msg.role === 'user' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                ) : (
                  <span>G</span>
                )}
              </div>
              <div className={`bubble ${msg.role}`}>
                <MarkdownText text={msg.text} />
                <div className="msg-time">
                  {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row model">
              <div className="avatar model"><span>G</span></div>
              <div className="bubble model loading-bubble">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Ask Gemini anything…"
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <div className="input-actions">
              <span className="input-hint">Enter to send · Shift+Enter for newline</span>
              <button
                className={`send-btn ${input.trim() && !isLoading ? 'active' : ''}`}
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <div className="spinner" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="disclaimer">GeminiChat may produce inaccurate info. Verify important details.</p>
        </div>
      </main>
    </div>
  );
}