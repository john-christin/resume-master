import { Bot, Check, Copy, Loader2, SendHorizontal, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getActiveModels, getApplicationChat, sendApplicationChat } from "../api/applications";
import type { ActiveModel, AppChatMessage } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Props {
  appId: string;
  jobTitle: string;
  company?: string;
  onClose: () => void;
}

function AssistantMessage({ msg }: { msg: AppChatMessage }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
      <div className="mt-0.5 shrink-0">
        {msg.role === "user" ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="group relative max-w-[82%]">
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            msg.role === "user"
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          <span className="whitespace-pre-wrap">{msg.content}</span>
        </div>
        {msg.role === "assistant" && (
          <button
            onClick={handleCopy}
            title="Copy"
            className="absolute -bottom-5 right-0 flex items-center justify-center h-5 w-5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          >
            {copied
              ? <Check className="h-3 w-3 text-emerald-500" />
              : <Copy className="h-3 w-3" />
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default function ApplicationChatSidebar({ appId, jobTitle, company, onClose }: Props) {
  const [messages, setMessages] = useState<AppChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ActiveModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("default");
  const [visible, setVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    Promise.all([
      getApplicationChat(appId),
      getActiveModels(),
    ]).then(([chatRes, modelsRes]) => {
      setMessages(chatRes.data.messages);
      setModels(modelsRes.data);
    }).catch(() => {
      setError("Failed to load chat.");
    }).finally(() => setLoading(false));
  }, [appId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const optimistic: AppChatMessage = {
      id: `temp-${Date.now()}`,
      application_id: appId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const modelConfigId = selectedModelId === "default" ? undefined : selectedModelId;
      const res = await sendApplicationChat(appId, trimmed, modelConfigId);
      setMessages((prev) => [...prev, res.data.message]);
    } catch {
      setError("Failed to send message. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Sliding panel */}
      <div
        className="relative flex w-full max-w-md flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
      >
      {/* Header */}
      <div className="flex items-start justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interview Prep
          </p>
          <h2 className="truncate text-sm font-semibold">{jobTitle}</h2>
          {company && (
            <p className="truncate text-xs text-muted-foreground">{company}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-2 mt-0.5 shrink-0"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Model selector */}
      {models.length > 0 && (
        <div className="border-b px-4 py-2">
          <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default" className="text-xs">
                Default (chat model)
              </SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.display_name}
                  <span className="ml-1.5 text-muted-foreground">· {m.provider}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading history…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Bot className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              Ask me anything about this role — interview questions, cover letter
              talking points, or how to position your experience.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <AssistantMessage key={msg.id} msg={msg} />
          ))
        )}

        {sending && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-xs text-destructive">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            disabled={sending || loading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending || loading}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Answers are based on your resume and the job description.
        </p>
      </div>
      </div>
    </div>
  );
}
