"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type ChatResponse = {
  answer?: string;
  kind?: string;
  sessionId?: string;
};

type ChatHistoryResponse = {
  sessionId: string | null;
  introMessage?: string;
  messages?: Array<{
    id: string;
    role: "assistant" | "user";
    content: string;
    createdAt: string;
  }>;
};

const STARTER_PROMPTS = [
  "measles and polio vaccines",
  "why is MMR important?",
  "child vaccination schedule",
  "travel vaccines for Africa"
];

const CHAT_SESSION_STORAGE_KEY = "vaxinfo-chat-session-id";

const DEFAULT_ASSISTANT_MESSAGE =
  "I am your VaxInfo AI assistant. Ask about any disease, vaccine options, related diseases, or coverage analytics by region.";

function uniqueMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uniqueMessageId(),
      role: "assistant",
      content: DEFAULT_ASSISTANT_MESSAGE
    }
  ]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending && !isLoadingHistory,
    [input, isLoadingHistory, isSending]
  );

  useEffect(() => {
    const storedSessionId = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (!storedSessionId) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch(`/api/chat?sessionId=${encodeURIComponent(storedSessionId)}&limit=60`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Unable to load chat history");
        }

        const payload = (await response.json()) as ChatHistoryResponse;
        if (!isMounted) {
          return;
        }

        if (!payload.sessionId) {
          localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
          setSessionId(null);
          return;
        }

        setSessionId(payload.sessionId);
        const historyMessages = (payload.messages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content
        }));

        setMessages(
          historyMessages.length > 0
            ? historyMessages
            : [
                {
                  id: uniqueMessageId(),
                  role: "assistant",
                  content: payload.introMessage ?? DEFAULT_ASSISTANT_MESSAGE
                }
              ]
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages, isSending]);

  const sendMessage = async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isLoadingHistory) {
      return;
    }

    const userMessage: ChatMessage = {
      id: uniqueMessageId(),
      role: "user",
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: trimmed, sessionId })
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const payload = (await response.json()) as ChatResponse;
      if (payload.sessionId) {
        setSessionId(payload.sessionId);
        localStorage.setItem(CHAT_SESSION_STORAGE_KEY, payload.sessionId);
      }

      const assistantMessage: ChatMessage = {
        id: uniqueMessageId(),
        role: "assistant",
        content: payload.answer ?? "I could not generate a response right now."
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        {
          id: uniqueMessageId(),
          role: "assistant",
          content:
            "I ran into a temporary issue while reading the vaccine data. Please try again in a moment."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const startNewSession = () => {
    localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    setSessionId(null);
    setInput("");
    setMessages([
      {
        id: uniqueMessageId(),
        role: "assistant",
        content: DEFAULT_ASSISTANT_MESSAGE
      }
    ]);
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            type="button"
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur-lg transition hover:scale-[1.03] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
          >
            <MessageCircle className="h-4 w-4 text-sky-600 dark:text-sky-300" />
            Ask AI
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="pointer-events-auto w-[min(92vw,410px)]"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="overflow-hidden border-white/60 bg-white/92 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/92">
              <CardHeader className="border-b border-slate-200/70 bg-sky-50/70 pb-4 dark:border-slate-700/70 dark:bg-slate-800/70">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100">
                    <Bot className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                    VaxInfo AI Chatbot
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                      onClick={startNewSession}
                    >
                      New
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-slate-500 transition hover:bg-white/80 hover:text-slate-900 dark:hover:bg-slate-700"
                      onClick={() => setIsOpen(false)}
                      aria-label="Close chatbot"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {sessionId
                    ? "Session memory is enabled for this chat."
                    : "Ask disease, vaccine, related disease, or analytics questions."}
                </p>
              </CardHeader>

              <CardContent className="p-0">
                <div
                  ref={scrollContainerRef}
                  className="max-h-[360px] min-h-[280px] space-y-3 overflow-y-auto px-4 py-4"
                >
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {isLoadingHistory && (
                    <div className="text-sm text-slate-600 dark:text-slate-300">Loading saved chat history...</div>
                  )}

                  {isSending && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200/70 px-3 py-2 dark:border-slate-700/70">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendMessage(prompt)}
                        disabled={isSending || isLoadingHistory}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <Sparkles className="h-3 w-3" />
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendMessage(input);
                    }}
                  >
                    <Input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Ask anything about vaccines..."
                      className="h-10 rounded-xl px-3 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!canSend}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
