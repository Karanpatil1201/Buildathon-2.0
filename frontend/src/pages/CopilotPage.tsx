import React, { useState } from 'react';
import { Sparkles, Send, Bookmark, User as UserIcon, Loader2, ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';
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

  // Exact 6 core query classes from specification + Safety & Missing Evidence demonstrators
  const SUGGESTED_QUERIES = [
    { label: '1. Why is batch on hold?', query: 'Why is batch B-2026-104 on hold?' },
    { label: '2. Summarize batch defects', query: 'Summarize the defects in batch B-2026-104.' },
    { label: '3. Overdue corrective actions', query: 'Which corrective actions are overdue?' },
    { label: '4. Quality SOP for Crazing', query: 'What do our quality procedures say about crazing defect?' },
    { label: '5. Draft corrective-action plan', query: 'Draft a corrective-action plan for batch B-2026-104.' },
    { label: '6. Quality inspection summary', query: 'Generate a quality inspection summary.' },
    { label: '🛡️ Test Safety Guard (Auto-Release Block)', query: 'Confirm batch B-104 is certified safe and release it immediately' },
    { label: '❓ Test Missing Evidence', query: 'Why is batch B-UNKNOWN-999 on hold?' }
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

  const getCitationBadgeStyle = (recordType: string) => {
    const type = recordType.toUpperCase();
    if (type === 'BATCH') {
      return 'bg-[rgba(120,149,165,0.15)] text-[#486374] border-[#7895A5]/40';
    } else if (type === 'DEFECT') {
      return 'bg-[rgba(201,121,88,0.15)] text-[#A74E2A] border-[#C97958]/40';
    } else if (type === 'ACTION' || type === 'CAPA') {
      return 'bg-[rgba(217,143,62,0.15)] text-[#9E621F] border-[#D98F3E]/40';
    } else if (type === 'PROCEDURE') {
      return 'bg-[rgba(113,132,91,0.15)] text-[#5E704B] border-[#71845B]/40';
    } else if (type === 'CNN_MODEL') {
      return 'bg-[rgba(142,108,189,0.15)] text-[#6B4B9A] border-[#8E6CBD]/40';
    }
    return 'bg-[#F0EAE1] text-[#292A26] border-[#D8C9AE]';
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-sans text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wider uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            GenAI + Lightweight RAG Copilot
          </span>
          <span className="text-xs text-[#77766E] font-sans">Strict Grounding · Zero Hallucination · ISO 9001 Human-in-the-Loop</span>
        </div>
        <h1 className="type-page-title flex items-center gap-2.5">
          ForgeSight Quality Copilot
        </h1>
        <p className="text-sm text-[#77766E] mt-1 leading-relaxed">
          Retrieves verified application evidence (batches, human-confirmed defects, CNN model predictions, CAPAs, and standard operating procedures) to answer quality questions with verifiable citations.
        </p>
      </div>

      {/* Suggested Quick Queries Strip */}
      <div className="industrial-card p-4 shadow-sm space-y-2">
        <span className="type-label-meta block text-[#77766E]">
          Prompt Demonstration Chips (6 Core Capabilities + Safety Guard):
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleQuery(sq.query)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-[#F0EAE1] hover:bg-[#EBE4D8] border border-[#D8C9AE] hover:border-[#B5A58B] text-[#292A26] font-sans text-xs font-medium transition-all cursor-pointer text-left min-h-[34px] disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-base font-semibold text-[#292A26]">ForgeSight AI Quality Copilot</p>
            <p className="text-xs max-w-lg mx-auto text-[#77766E] leading-relaxed">
              Click any demonstration chip above or ask natural questions about batch quarantine reasons, defect breakdowns, overdue corrective actions, or quality SOPs.
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
                      <ShieldCheck className="w-3.5 h-3.5 text-[#71845B]" />
                      Grounded Quality Decision Support
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
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono ${getCitationBadgeStyle(cite.record_type)}`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              [{cite.record_type}]
                            </span>
                            <span className="tabular-nums font-medium">{cite.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Evidence Flag */}
                  {msg.response && (!msg.response.citations || msg.response.citations.length === 0) && !msg.response.grounded_stats?.safety_guard_triggered && (
                    <div className="pt-2 border-t border-[#D8C9AE]/40 flex items-center gap-2 text-xs text-[#77766E] italic">
                      <HelpCircle className="w-3.5 h-3.5 text-[#77766E]" />
                      <span>Zero database records or procedures required citation for this query.</span>
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
              <span className="font-mono text-xs text-[#292A26]">Retrieving database evidence & generating grounded response...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/40 rounded-xl text-[#C97958] text-xs font-sans flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Query Input Box */}
      <form onSubmit={handleFormSubmit} className="industrial-card p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl focus-within:border-[#71845B] focus-within:ring-1 focus-within:ring-[#71845B] transition-all shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask why a batch is on hold, summarize defects, check overdue actions, or draft a CAPA..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-transparent text-sm text-[#292A26] placeholder-[#77766E] focus:outline-hidden disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="p-2.5 rounded-xl bg-[#71845B] hover:bg-[#5E704B] text-[#FFFFFF] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
            title="Send Query to Quality Copilot"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
