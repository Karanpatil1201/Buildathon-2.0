import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Bookmark, User as UserIcon, Loader2,
  ShieldCheck, AlertCircle, HelpCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
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

const STAGES = [
  'Understanding your question',
  'Retrieving batch and inspection records',
  'Checking quality procedures',
  'Generating grounded response'
];

export const CopilotPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stageStep, setStageStep] = useState<number>(0);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Exact 6 core query classes from specification + Safety & Missing Evidence demonstrators
  const SUGGESTED_QUERIES = [
    { label: '1. Why is B-2026-101 batch on hold?', query: 'why B-2026-101 batch is on the hold' },
    { label: '2. Why is batch B-2026-104 on hold?', query: 'Why is batch B-2026-104 on hold?' },
    { label: '3. Summarize batch defects', query: 'Summarize the defects in batch B-2026-104.' },
    { label: '4. Overdue corrective actions', query: 'Which corrective actions are overdue?' },
    { label: '5. Quality SOP for Crazing', query: 'What do our quality procedures say about crazing defect?' },
    { label: '6. Draft corrective-action plan', query: 'Draft a corrective-action plan for batch B-2026-104.' },
    { label: '7. Quality inspection summary', query: 'Generate a quality inspection summary.' },
    { label: '🛡️ Test Safety Guard (Auto-Release Block)', query: 'Confirm batch B-104 is certified safe and release it immediately' },
    { label: '❓ Test Missing Evidence', query: 'Why is batch B-UNKNOWN-999 on hold?' }
  ];

  // Auto-resize textarea height up to 160px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160);
      textareaRef.current.style.height = `${Math.max(newHeight, 44)}px`;
    }
  }, [query]);

  // Scroll to bottom on new message or loading change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, currentStage]);

  const handleQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    setLoading(true);
    setError(null);
    setCurrentStage(STAGES[0]);
    setStageStep(1);
    setCompletedStages([]);

    try {
      let finalResult: CopilotResponse | null = null;

      // Stream via SSE for live stage progression
      await api.streamCopilot(
        trimmed,
        undefined,
        (stageName, step) => {
          setCurrentStage(stageName);
          setStageStep(step);
          setCompletedStages(prev => {
            const prior = STAGES.slice(0, step - 1);
            return Array.from(new Set([...prev, ...prior]));
          });
        },
        (result) => {
          finalResult = result;
        }
      );

      // If SSE did not yield a result, fallback to standard JSON query endpoint
      if (!finalResult) {
        finalResult = await api.queryCopilot(trimmed);
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: finalResult.answer,
        response: finalResult,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      // Graceful fallback to standard query if SSE fails
      try {
        const fallbackRes = await api.queryCopilot(trimmed);
        const assistantMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: fallbackRes.answer,
          response: fallbackRes,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch (innerErr: any) {
        setError(innerErr.message || err.message || 'Failed to process copilot query');
      }
    } finally {
      setLoading(false);
      setCurrentStage('');
      setStageStep(0);
      setCompletedStages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery(query);
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

  const isGeminiProvider = (provider?: string) => {
    return !!provider && provider.toLowerCase().includes('gemini') && !provider.toLowerCase().includes('fallback');
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] max-w-5xl mx-auto relative">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-sans text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wider uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#71845B]" />
            GenAI + Lightweight RAG Copilot
          </span>
          <span className="text-xs text-[#77766E] font-sans">Strict Grounding · Zero Hallucination · ISO 9001 Governance</span>
        </div>
        <h1 className="type-page-title flex items-center gap-2.5">
          ForgeSight Quality Copilot
        </h1>
        <p className="text-xs sm:text-sm text-[#77766E] mt-1 leading-relaxed">
          Retrieves verified application evidence (batches, human-confirmed defects, CNN model predictions, CAPAs, and standard operating procedures) to answer quality questions with verifiable citations.
        </p>
      </div>

      {/* Suggested Quick Queries Strip (Visible on Empty Conversation) */}
      {messages.length === 0 && (
        <div className="industrial-card p-4 shadow-sm space-y-2.5 shrink-0 mb-4">
          <span className="type-label-meta block text-[#77766E]">
            Verified Demonstration Queries:
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
      )}

      {/* Chat Thread Messages Area with extra bottom padding to avoid covering */}
      <div className="flex-1 space-y-4 pb-32">
        {messages.length === 0 && !loading && (
          <div className="industrial-card p-8 text-center text-[#77766E] space-y-2 shadow-sm my-4">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(113,132,91,0.12)] border border-[#71845B]/30 flex items-center justify-center mx-auto text-[#71845B]">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-[#292A26]">ForgeSight AI Quality Copilot</p>
            <p className="text-xs max-w-lg mx-auto text-[#77766E] leading-relaxed">
              Ask about why batch B-2026-101 is on hold, defect breakdowns, overdue corrective actions, or draft an 8D CAPA plan.
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
                  <div className="font-sans text-sm font-medium text-[#292A26] leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                  <div className="text-[11px] text-[#77766E] text-right font-mono tabular-nums">{msg.timestamp}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Assistant Header & Real Provider Badge */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8C9AE]/60 flex-wrap gap-2">
                    <span className="type-label-meta text-[#292A26] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#71845B]" />
                      Grounded Quality Decision Support
                    </span>
                    {msg.response && (
                      <span
                        className={`text-[11px] font-mono px-2.5 py-0.5 rounded-md border font-medium flex items-center gap-1.5 ${
                          isGeminiProvider(msg.response.provider)
                            ? 'text-[#2D5A27] bg-[#E8F3E8] border-[#A3D2A3]'
                            : 'text-[#6B5A3E] bg-[#F7F2EB] border-[#D8C9AE]'
                        }`}
                        title={msg.response.provider}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isGeminiProvider(msg.response.provider) ? 'bg-[#3BA73B]' : 'bg-[#9E8B6D]'}`} />
                        {msg.response.provider}
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
                      <span>Zero database records or procedures matched for this query.</span>
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

        {/* Real-time Multi-Stage Progress Card */}
        {loading && (
          <div className="flex items-start gap-3 justify-start animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-full bg-[rgba(113,132,91,0.12)] border border-[#71845B]/40 flex items-center justify-center text-[#71845B] shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-[#71845B]" />
            </div>
            <div className="bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl rounded-tl-xs p-4 text-xs max-w-lg w-full shadow-sm space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8C9AE]/50">
                <span className="font-mono text-xs font-semibold text-[#292A26] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#71845B]" />
                  AI Quality Processing Pipeline
                </span>
                <span className="text-[11px] font-mono text-[#71845B] font-semibold">
                  Stage {stageStep} of 4
                </span>
              </div>

              {/* Sequential Processing Stages Checklist */}
              <div className="space-y-1.5 font-sans">
                {STAGES.map((stg, i) => {
                  const isDone = completedStages.includes(stg) || (stageStep > i + 1);
                  const isCurrent = currentStage === stg || (stageStep === i + 1);

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 py-0.5 text-xs transition-colors ${
                        isDone
                          ? 'text-[#5E704B]'
                          : isCurrent
                          ? 'text-[#292A26] font-medium'
                          : 'text-[#A09D94]'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#71845B] shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#71845B] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#D8C9AE] shrink-0" />
                      )}
                      <span>{stg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-3 p-3 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/40 rounded-xl text-[#C97958] text-xs font-sans flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Persistent ChatGPT-Style Input Bar (Sticky at Bottom) */}
      <div className="sticky bottom-0 z-20 pt-2 pb-3 bg-gradient-to-t from-[#F5F1E8] via-[#F5F1E8]/95 to-transparent">
        <form
          onSubmit={handleFormSubmit}
          className="industrial-card p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl focus-within:border-[#71845B] focus-within:ring-1 focus-within:ring-[#71845B] transition-all shadow-md flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask why B-2026-101 is on hold, summarize defects, check overdue actions, or draft a CAPA... (Press Enter to send, Shift+Enter for new line)"
            className="flex-1 px-3 py-2 bg-transparent text-xs sm:text-sm text-[#292A26] placeholder-[#77766E] focus:outline-hidden resize-none overflow-y-auto leading-relaxed max-h-40 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="p-2.5 rounded-xl bg-[#71845B] hover:bg-[#5E704B] text-[#FFFFFF] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs shrink-0 mb-1"
            title="Send Query (Enter)"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <div className="text-[10px] text-[#77766E] text-center pt-1.5 font-sans">
          ForgeSight AI Quality Copilot adheres to ISO 9001 strict human-in-the-loop authorization. Press <kbd className="px-1 py-0.5 rounded-sm bg-[#EBE4D8] border border-[#D8C9AE] font-mono text-[9px]">Enter</kbd> to submit.
        </div>
      </div>
    </div>
  );
};
