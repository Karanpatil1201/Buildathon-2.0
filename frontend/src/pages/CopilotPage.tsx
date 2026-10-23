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
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-sans text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wider uppercase">
            GROUNDED GENERATIVE AI
          </span>
          <span className="text-xs text-[#77766E] font-sans">Zero-Hallucination Quality Assistant</span>
        </div>
        <h1 className="type-page-title flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-[#71845B] shrink-0" />
          Quality Copilot — Batch Summary & Decision Support
        </h1>
        <p className="text-sm text-[#77766E] mt-1 leading-relaxed">
          Synthesizes natural language quality summaries strictly grounded in verified database inspections, confirmed defects, and CAPA logs with record citations.
        </p>
      </div>

      {/* Suggested Quick Queries Strip */}
      <div className="industrial-card p-4 shadow-sm">
        <span className="type-label-meta block mb-2 text-[#77766E]">
          Verified Demonstration Queries:
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleQuery(sq.query)}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-[#F0EAE1] hover:bg-[#EBE4D8] border border-[#D8C9AE] hover:border-[#B5A58B] text-[#292A26] font-sans text-xs font-medium transition-all cursor-pointer text-left min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sq.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread Messages */}
      <div className="space-y-4 min-h-[160px]">
        {messages.length === 0 && !loading && (
          <div className="industrial-card p-8 text-center text-[#77766E] space-y-2 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(113,132,91,0.12)] border border-[#71845B]/30 flex items-center justify-center mx-auto text-[#71845B]">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-[#292A26]">Ask Steel-IQ Quality Copilot</p>
            <p className="text-xs max-w-md mx-auto text-[#77766E] leading-relaxed">
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
              <div className="w-8 h-8 rounded-full bg-[#71845B] text-[#FFFFFF] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`rounded-2xl p-4 text-xs transition-all ${
                msg.sender === 'user'
                  ? 'bg-[#F0EAE1] text-[#292A26] border border-[#D8C9AE] rounded-tr-xs max-w-2xl shadow-xs'
                  : 'bg-[#FFFCF6] text-[#292A26] border border-[#D8C9AE] rounded-tl-xs max-w-3xl w-full shadow-sm space-y-3'
              }`}
            >
              {msg.sender === 'user' ? (
                <div className="space-y-1">
                  <div className="font-sans text-sm font-medium text-[#292A26] leading-relaxed">{msg.text}</div>
                  <div className="text-[11px] text-[#77766E] text-right font-mono tabular-nums">{msg.timestamp}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Assistant Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8C9AE]/60">
                    <span className="type-label-meta text-[#292A26] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#71845B]" />
                      Synthesized Grounded Response
                    </span>
                    {msg.response && (
                      <span className="text-[11px] font-mono text-[#5E704B] bg-[rgba(113,132,91,0.12)] px-2 py-0.5 rounded-md border border-[#71845B]/30 font-medium">
                        Provider: {msg.response.provider}
                      </span>
                    )}
                  </div>

                  {/* Rendered Markdown Body */}
                  <div className="text-[13.5px] leading-relaxed text-[#292A26]">
                    <MarkdownRenderer content={msg.text} />
                  </div>

                  {/* Citations Grid */}
                  {msg.response && msg.response.citations && msg.response.citations.length > 0 && (
                    <div className="pt-3 border-t border-[#D8C9AE]/60 space-y-2">
                      <div className="flex items-center gap-1.5 type-label-meta text-[#77766E]">
                        <Bookmark className="w-3.5 h-3.5 text-[#7895A5]" />
                        <span>Supporting Record Citations ({msg.response.citations.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.response.citations.map((cite, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0EAE1] border border-[#D8C9AE] text-xs font-mono text-[#292A26]"
                          >
                            <span className="text-[10px] font-semibold text-[#7895A5] uppercase">
                              [{cite.record_type}]
                            </span>
                            <span className="tabular-nums">{cite.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grounded Stats Strip */}
                  {msg.response && msg.response.grounded_stats && Object.keys(msg.response.grounded_stats).length > 0 && (
                    <div className="pt-2 border-t border-[#D8C9AE]/50 flex flex-wrap gap-4 text-xs font-sans text-[#77766E]">
                      {Object.entries(msg.response.grounded_stats).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-[#77766E]">{k.replace(/_/g, ' ')}:</span>{' '}
                          <strong className="font-mono tabular-nums font-semibold text-[#292A26]">{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-[#77766E] text-right font-mono tabular-nums pt-1">
                    {msg.timestamp}
                  </div>
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#F0EAE1] border border-[#D8C9AE] flex items-center justify-center text-[#292A26] shrink-0 mt-1">
                <UserIcon className="w-4 h-4 text-[#77766E]" />
              </div>
            )}
          </div>
        ))}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-[rgba(113,132,91,0.12)] border border-[#71845B]/40 flex items-center justify-center text-[#71845B] shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl rounded-tl-xs p-4 text-xs max-w-md flex items-center gap-3 text-[#71845B] shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#71845B]" />
              <span className="font-mono text-xs text-[#292A26]">Analyzing verifiable audit logs & database evidence...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/40 rounded-xl text-[#C97958] text-xs font-sans">
          {error}
        </div>
      )}

      {/* Query Input Box */}
      <form onSubmit={handleFormSubmit} className="industrial-card p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl focus-within:border-[#71845B] focus-within:ring-1 focus-within:ring-[#71845B] transition-all shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask a question about batches, defects, overdue actions, or draft an audit report..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-[#292A26] placeholder-[#96958B] focus:outline-none min-h-[40px] font-sans"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all min-h-[40px] cursor-pointer font-sans ${
              loading || !query.trim()
                ? 'bg-[#E2DACB] text-[#77766E] cursor-not-allowed opacity-60'
                : 'btn-primary-sage active:scale-95'
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
