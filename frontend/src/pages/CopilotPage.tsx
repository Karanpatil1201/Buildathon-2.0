import React, { useState } from 'react';
import { Sparkles, Send, Bookmark, User as UserIcon, Loader2 } from 'lucide-react';
import { CopilotResponse } from '../types';
import { api } from '../api/client';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  response?: CopilotResponse;
  timestamp: string;
}

export const CopilotPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const SUGGESTED_QUERIES = [
    { label: 'Summarize Batch B-2026-104', query: 'Summarize batch B-2026-104.' },
    { label: 'Overdue Corrective Actions', query: 'Which corrective actions are overdue?' },
    { label: 'Historical Defect Patterns', query: 'Have we previously recorded a similar defect?' },
    { label: "Today's Quality Attention Triage", query: 'What needs attention today?' },
    { label: 'Draft Plant Quality Report', query: 'Draft a quality report for the selected period.' },
    { label: 'Test Safety Guard (Block Auto-Release)', query: 'Confirm batch B-104 is certified safe and release it immediately' },
    { label: 'Test Unknown Batch (Honest Fallback)', query: 'Summarize batch B-UNKNOWN-999' }
  ];

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    setError(null);

    try {
      const res = await api.queryCopilot(queryText);
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        response: res,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'Failed to process copilot query');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(query);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40">
            GROUNDED GENERATIVE AI
          </span>
          <span className="text-xs text-[#9AA0A6] font-mono">Zero-Hallucination Quality Assistant</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#A8C7FA]" />
          Quality Copilot — Batch Summary & Decision Support
        </h1>
        <p className="text-xs text-[#9AA0A6] mt-1 leading-relaxed">
          Synthesizes natural language quality summaries strictly grounded in verified database inspections, confirmed defects, and CAPA logs with record citations.
        </p>
      </div>

      {/* Suggested Quick Queries Strip */}
      <div className="sky-card p-4">
        <span className="text-xs font-semibold text-[#9AA0A6] block mb-2 font-mono uppercase tracking-wider">
          Verified Demonstration Queries:
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleQuery(sq.query)}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-[#202124] hover:bg-[#303134] border border-[#3C4043] hover:border-[#A8C7FA]/50 text-[#E3E3E3] hover:text-white text-xs font-medium transition-all cursor-pointer text-left min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sq.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread Messages */}
      <div className="space-y-4 min-h-[160px]">
        {messages.length === 0 && !loading && (
          <div className="sky-card p-8 text-center text-[#9AA0A6] space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#202124] border border-[#3C4043] flex items-center justify-center mx-auto text-[#A8C7FA]">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">Ask ForgeSight Quality Copilot</p>
            <p className="text-xs max-w-md mx-auto text-[#9AA0A6]">
              Select a suggested demonstration query above or ask about active batches, SLA overdue items, or historical defects.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#004A77] border border-[#A8C7FA]/40 flex items-center justify-center text-[#A8C7FA] shrink-0 mt-1">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`rounded-2xl p-4 text-xs transition-all ${
                msg.sender === 'user'
                  ? 'bg-[#303134] text-[#E3E3E3] border border-[#3C4043] rounded-tr-sm max-w-2xl shadow-sm'
                  : 'bg-[#202124] text-[#E3E3E3] border border-[#3C4043] rounded-tl-sm max-w-3xl w-full shadow-md space-y-3'
              }`}
            >
              {msg.sender === 'user' ? (
                <div className="space-y-1">
                  <div className="font-medium text-white">{msg.text}</div>
                  <div className="text-[10px] text-[#9AA0A6] text-right font-mono">{msg.timestamp}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Assistant Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#3C4043]">
                    <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A8C7FA]" />
                      Synthesized Grounded Response
                    </span>
                    {msg.response && (
                      <span className="text-[10px] font-mono text-[#A8C7FA] bg-[#004A77]/40 px-2.5 py-0.5 rounded border border-[#A8C7FA]/30">
                        Provider: {msg.response.provider}
                      </span>
                    )}
                  </div>

                  {/* Rendered Markdown Body */}
                  <div className="text-xs text-[#E3E3E3] leading-relaxed">
                    <MarkdownRenderer content={msg.text} />
                  </div>

                  {/* Citations Grid */}
                  {msg.response && msg.response.citations && msg.response.citations.length > 0 && (
                    <div className="pt-3 border-t border-[#3C4043] space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#9AA0A6]">
                        <Bookmark className="w-3.5 h-3.5 text-[#A8C7FA]" />
                        <span>Supporting Record Citations ({msg.response.citations.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.response.citations.map((cite, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1E1F20] border border-[#3C4043] text-xs font-mono text-[#E3E3E3]"
                          >
                            <span className="text-[10px] font-bold text-[#A8C7FA] uppercase">
                              [{cite.record_type}]
                            </span>
                            <span>{cite.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounded Stats Strip */}
                  {msg.response && msg.response.grounded_stats && Object.keys(msg.response.grounded_stats).length > 0 && (
                    <div className="pt-2 border-t border-[#3C4043]/60 flex flex-wrap gap-4 text-[11px] font-mono text-[#9AA0A6]">
                      {Object.entries(msg.response.grounded_stats).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-[#9AA0A6]">{k.replace(/_/g, ' ')}:</span>{' '}
                          <strong className="text-white">{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-[#9AA0A6] text-right font-mono pt-1">
                    {msg.timestamp}
                  </div>
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#303134] border border-[#3C4043] flex items-center justify-center text-[#E3E3E3] shrink-0 mt-1">
                <UserIcon className="w-4 h-4 text-[#9AA0A6]" />
              </div>
            )}
          </div>
        ))}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-[#004A77] border border-[#A8C7FA]/40 flex items-center justify-center text-[#A8C7FA] shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-[#202124] border border-[#3C4043] rounded-2xl rounded-tl-sm p-4 text-xs max-w-md flex items-center gap-3 text-[#A8C7FA]">
              <Loader2 className="w-4 h-4 animate-spin text-[#A8C7FA]" />
              <span className="font-mono text-xs">Analyzing verifiable audit logs & database evidence...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[#F28B82]/10 border border-[#F28B82]/40 rounded-xl text-[#F28B82] text-xs">
          {error}
        </div>
      )}

      {/* Query Input Box */}
      <form onSubmit={handleFormSubmit} className="sky-card p-2 bg-[#1E1F20] border border-[#3C4043] rounded-2xl focus-within:border-[#A8C7FA] focus-within:ring-1 focus-within:ring-[#A8C7FA] transition-all">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask a question about batches, defects, overdue actions, or draft an audit report..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-[#9AA0A6] focus:outline-none min-h-[44px]"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all min-h-[44px] cursor-pointer ${
              loading || !query.trim()
                ? 'bg-[#303134] text-[#9AA0A6] cursor-not-allowed opacity-60'
                : 'bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] active:scale-95'
            }`}
          >
            <span>Run Query</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
