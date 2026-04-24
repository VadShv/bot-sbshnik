import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Bot, Send, User as UserIcon, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export function ChatTab({ checkId }: { checkId: string }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ messages: ChatMessageView[] }>({
    queryKey: ["/api/checks", checkId, "chat"],
    enabled: Boolean(checkId),
  });

  const sendMut = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/checks/${checkId}/chat/message`, { message });
      return (await res.json()) as { user: ChatMessageView; assistant: ChatMessageView };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/checks", checkId, "chat"] });
      setText("");
    },
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/checks/${checkId}/chat`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/checks", checkId, "chat"] });
    },
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [data?.messages?.length, sendMut.isPending]);

  const handleSend = () => {
    const t = text.trim();
    if (!t || sendMut.isPending) return;
    sendMut.mutate(t);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = data?.messages ?? [];

  return (
    <Card className="border-card-border bg-card p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <div className="font-semibold text-sm">ИИ-ассистент · в контексте базовой проверки и пайплайна</div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMut.mutate()}
            disabled={clearMut.isPending}
            data-testid="button-clear-chat"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Очистить
          </Button>
        )}
      </div>

      <div
        ref={listRef}
        className="max-h-[60vh] min-h-[300px] overflow-y-auto px-5 py-4 space-y-3"
        data-testid="chat-messages"
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Загружаю историю…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bot className="mb-3 h-8 w-8 text-muted-foreground" />
            <div className="mb-1 text-sm font-semibold">Задайте вопрос по отчёту</div>
            <p className="max-w-md text-xs text-muted-foreground">
              Ассистент отвечает строго на основании базовой проверки и, если создан, пайплайна.
              Примеры: «Какие ключевые красные флаги?», «Кратко оцени мотивацию», «Что делать на интервью?».
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
              data-testid={`chat-msg-${m.role}`}
            >
              <div
                className={cn(
                  "flex max-w-[85%] gap-2 rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary/15 border border-primary/30 text-foreground"
                    : "bg-muted/60 border border-border text-foreground",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {m.role === "user" ? (
                    <UserIcon className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            </div>
          ))
        )}
        {sendMut.isPending && (
          <div className="flex gap-2 justify-start">
            <div className="flex max-w-[85%] gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Ассистент думает…</span>
            </div>
          </div>
        )}
        {sendMut.isError && (
          <div className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            Ошибка: {(sendMut.error as Error)?.message || "не удалось получить ответ"}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background/40 p-3">
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напишите вопрос по отчёту…  (Ctrl+Enter — отправить)"
            rows={2}
            maxLength={4000}
            disabled={sendMut.isPending}
            data-testid="input-chat"
            className="min-h-[48px] resize-none text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sendMut.isPending}
            data-testid="button-chat-send"
            className="shrink-0"
          >
            {sendMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Макс. 4000 символов. Отвечает на основе JSON-среза отчётов.
        </div>
      </div>
    </Card>
  );
}
