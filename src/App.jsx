import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const GEMINI_API_KEY = 'AIzaSyCOzU3P1mIeF81-7T3oN_jaRLhQiUguu3M';
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const systemPrompt = 'You are a helpful assistant.';
const LS_KEY = 'gemini-chat-history';
const HISTORY_KEY = 'search-history';
const THEME_KEY = 'app-theme';

const getInitialState = (key, defaultValue) => {
    try {
        const savedData = localStorage.getItem(key);
        return savedData ? JSON.parse(savedData) : defaultValue;
    } catch (error) {
        console.error("Failed to load from local storage:", error);
        return defaultValue;
    }
};

function App() {
    const [userInput, setUserInput] = useState('');
    const [messages, setMessages] = useState(() => getInitialState(LS_KEY, []));
    const [files, setFiles] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('chat');
    const [searchHistory, setSearchHistory] = useState(() => getInitialState(HISTORY_KEY, []));
    // Initialize theme from local storage or default to 'dark'
    const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
    const messagesEndRef = useRef(null);

    // Apply the theme class and save to local storage
    useEffect(() => {
        document.body.className = theme === 'dark' ? '' : 'light-theme';
        localStorage.setItem(THEME_KEY, theme); // Save the theme to local storage
    }, [theme]);

    useEffect(() => {
        try {
            const serializableMessages = messages.map(msg => {
                if (msg.sender === 'user' && msg.files) {
                    return { text: msg.text, sender: msg.sender, files: msg.files };
                }
                return { text: msg.text, sender: msg.sender };
            });
            localStorage.setItem(LS_KEY, JSON.stringify(serializableMessages));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
        } catch (error) {
            console.error("Failed to save to local storage:", error);
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, searchHistory]);

    const sendMessage = async (query, attachedFiles) => {
        setIsLoading(true);

        const fileMessage = attachedFiles.length > 0
            ? "\n[User attached files: " + attachedFiles.map(f => f.name).join(", ") + "]"
            : "";

        setMessages(prev => [...prev, { text: query, sender: 'user', files: attachedFiles.map(f => f.name) }]);

        const payload = {
            contents: [{ parts: [{ text: query + fileMessage }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";
            setMessages(prev => [...prev, { text, sender: 'bot' }]);
        } catch (error) {
            console.error("API error:", error);
            setMessages(prev => [...prev, { text: "Oops! Something went wrong. Check your API key or network connection.", sender: 'bot' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const query = userInput.trim();
        if (!query && files.length === 0) return;

        if (editingIndex !== null) {
            const updated = [...messages];
            updated[editingIndex].text = query;
            setMessages(updated);
            setEditingIndex(null);
        } else {
            sendMessage(query, files);
            setSearchHistory(prev => {
                const updatedHistory = [query, ...prev.filter(item => item !== query)];
                return updatedHistory.slice(0, 5);
            });
        }

        setUserInput('');
        setFiles([]);
        setActiveTab('chat');
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(selectedFiles);
    };

    const handleEdit = (index) => {
        const msgToEdit = messages[index];
        if (msgToEdit.sender === 'user') {
            setUserInput(msgToEdit.text);
            setEditingIndex(index);
        }
    };

    const handleDelete = (index) => {
        const updated = messages.filter((_, i) => i !== index);
        setMessages(updated);
    };

    const handleHistoryDelete = (index) => {
        const updatedHistory = searchHistory.filter((_, i) => i !== index);
        setSearchHistory(updatedHistory);
    };

    const handleHistoryItemClick = (query) => {
        setUserInput(query);
        setActiveTab('chat');
    };

    const handleSuggestionClick = (suggestion) => {
        setUserInput('');
        sendMessage(suggestion, []);
        setSearchHistory(prev => {
            const updatedHistory = [suggestion, ...prev.filter(item => item !== suggestion)];
            return updatedHistory.slice(0, 5);
        });
    };

    // New function to toggle the theme
    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>AI Chatbot</h1>
                <nav className="header-nav">
                    <div className="menu-item" onClick={() => setActiveTab('chat')} aria-selected={activeTab === 'chat'}>
                        Chat
                    </div>
                    <div className="menu-item" onClick={() => setActiveTab('history')} aria-selected={activeTab === 'history'}>
                        Search History
                    </div>
                    {/* Updated theme toggle button */}
                    <button onClick={toggleTheme} className="theme-toggle">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </nav>
            </header>
            <div className="main-container">
                <div className="content">
                    {activeTab === 'chat' && (
                        <div className="chat-container">
                            <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions">
                                {messages.length === 0 && (
                                    <div className="assistant-greeting">
                                        <h2>Hello, I'm <span className="highlight">Gemini</span></h2>
                                        <p>I can help with a variety of tasks.</p>
                                        <div className="suggestions">
                                            <button onClick={() => handleSuggestionClick("Give me a quote about success.")}>A quote about success</button>
                                            <button onClick={() => handleSuggestionClick("What's a good study plan?")}>A study plan</button>
                                            <button onClick={() => handleSuggestionClick("How do I make an omelette?")}>How to make an omelette</button>
                                        </div>
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    <div key={i} className={`message ${msg.sender}`}>
                                        <p>{msg.text}</p>
                                        {msg.files && msg.files.length > 0 && (
                                            <div className="attached-files">
                                                <strong>Attached:</strong> {msg.files.join(", ")}
                                            </div>
                                        )}
                                        {msg.sender === 'user' && (
                                            <div className="message-actions">
                                                <button aria-label="Edit message" onClick={() => handleEdit(i)}>✏️</button>
                                                <button aria-label="Delete message" onClick={() => handleDelete(i)}>🗑️</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="message bot loading" aria-live="assertive" aria-label="Loading response">
                                        <span className="dot"></span>
                                        <span className="dot"></span>
                                        <span className="dot"></span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <form className="input-form" onSubmit={handleSubmit}>
                                {files.length > 0 && (
                                    <div className="file-preview">
                                        <p>Attached files: {files.map(f => f.name).join(', ')}</p>
                                        <button type="button" onClick={() => setFiles([])}>Remove</button>
                                    </div>
                                )}
                                <textarea
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Ask me everything..."
                                    rows="1"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                />
                                <div className="input-actions">
                                    <input
                                        type="file"
                                        id="file-upload"
                                        multiple
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="file-upload" className="file-upload-btn" aria-label="Attach files">
                                        📎
                                    </label>
                                    <button type="submit" className="send-btn" aria-label="Send message">
                                        ➤
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {activeTab === 'history' && (
                        <div className="history-container">
                            <h2>Recent Searches</h2>
                            {searchHistory.length > 0 ? (
                                <ul>
                                    {searchHistory.map((query, index) => (
                                        <li key={index} className="history-item" onClick={() => handleHistoryItemClick(query)}>
                                            <span>{query}</span>
                                            <span className="history-delete" onClick={(e) => { e.stopPropagation(); handleHistoryDelete(index); }}>🗑️</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No search history yet. Start a conversation!</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;