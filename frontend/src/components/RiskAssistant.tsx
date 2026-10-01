import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Action {
  label: string;
  route: string;
  action_type: string;
}

export function RiskAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{sender: 'user' | 'assistant', text: string, actions?: Action[]}[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setQuery('');
    
    try {
      const response = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: text,
          route: location.pathname
        }),
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: data.message,
        actions: data.actions
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: "Error connecting to Risk Assistant backend."
      }]);
    }
  };

  const handleActionClick = (action: Action) => {
    if (action.action_type === 'navigate') {
      navigate(action.route);
      setIsOpen(false);
    }
  };

  const quickCommands = [
    "Ask about this page",
    "Find a risk tool",
    "Run Full Risk Check",
    "Explain current result",
    "Find biggest risks",
    "Check limit breaches",
    "Run stress scenario",
    "Generate Risk Committee Report"
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg flex items-center gap-2 font-semibold"
      >
        <span>Risk Assistant</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col h-[500px]">
          <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-white font-semibold">Risk Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-gray-400 text-sm mb-2">Quick Commands:</p>
                {quickCommands.map(cmd => (
                  <button 
                    key={cmd}
                    onClick={() => handleSend(cmd)}
                    className="text-left text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 p-2 rounded border border-gray-700"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-3 rounded-lg max-w-[85%] text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                  {msg.text.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2 w-full">
                    {msg.actions.map((act, i) => (
                      <button 
                        key={i}
                        onClick={() => handleActionClick(act)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs p-2 rounded"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-700 bg-gray-800">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend(query)}
                placeholder="Ask..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
              />
              <button 
                onClick={() => handleSend(query)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
