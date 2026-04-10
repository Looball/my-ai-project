"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "document";
  uploadedAt: string;
  extractedText: string;
  storagePath: string;
};

type ChatSession = {
  id: string;
  title: string;
  attachments: Attachment[];
  messages: Message[];
};

const STORAGE_KEY = "ai-learning-assistant-sessions";
const CURRENT_SESSION_KEY = "ai-learning-assistant-current-session";

const initialMessages: Message[] = [
  {
    role: "assistant",
    content: "你好，我是你的 AI 学习助手。你可以问我任何关于 AI 的问题。",
  },
];

const quickPrompts = [
  "什么是大语言模型？",
  "RAG 是什么，适合用在什么场景？",
  "Agent 和普通聊天机器人有什么区别？",
  "提示词工程的核心原则有哪些？",
];

function createSession(title = "新对话"): ChatSession {
  return {
    id: crypto.randomUUID(),
    title,
    attachments: [],
    messages: [...initialMessages],
  };
}

function buildSessionTitle(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "新对话";
  }

  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Message>;

  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Attachment>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.size === "number" &&
    (candidate.kind === "image" || candidate.kind === "document") &&
    typeof candidate.uploadedAt === "string" &&
    typeof candidate.extractedText === "string" &&
    typeof candidate.storagePath === "string"
  );
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function serializeSessionsForStorage(sessions: ChatSession[]) {
  return JSON.stringify(
    sessions.map((session) => ({
      ...session,
      attachments: session.attachments.map((attachment) => ({
        ...attachment,
        extractedText: attachment.extractedText.slice(0, 2000),
      })),
    }))
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [input, setInput] = useState("");
  const [editingSessionId, setEditingSessionId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedMessageKey, setCopiedMessageKey] = useState("");
  const [uploadingSessions, setUploadingSessions] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>(
    {}
  );
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const previousSessionIdRef = useRef("");
  const previousMessageCountRef = useRef(0);
  const previousLoadingRef = useRef(false);

  const currentSession =
    sessions.find((session) => session.id === currentSessionId) || sessions[0] || null;
  const isCurrentSessionLoading = currentSession
    ? Boolean(loadingSessions[currentSession.id])
    : false;
  const isCurrentSessionUploading = currentSession
    ? Boolean(uploadingSessions[currentSession.id])
    : false;
  const currentSessionError = currentSession
    ? sessionErrors[currentSession.id] || ""
    : "";

  useEffect(() => {
    async function loadAttachments(sessionId: string) {
      try {
        const response = await fetch(
          `/api/uploads?sessionId=${encodeURIComponent(sessionId)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "读取附件失败了，请稍后再试。");
        }

        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  attachments: data.attachments as Attachment[],
                }
              : session
          )
        );
      } catch (error) {
        console.error("Failed to load attachments:", error);
      }
    }

    if (currentSession?.id) {
      void loadAttachments(currentSession.id);
    }
  }, [currentSession?.id]);

  useEffect(() => {
    let nextSessions: ChatSession[] = [];
    let savedCurrentSessionId = "";

    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY);
      savedCurrentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) || "";

      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions) as unknown;

        if (Array.isArray(parsedSessions) && parsedSessions.length > 0) {
          nextSessions = parsedSessions.map((session) => {
            const messages = Array.isArray(session?.messages)
              ? session.messages.filter(isMessage)
              : [];
            const attachments = Array.isArray(session?.attachments)
              ? session.attachments.filter(isAttachment)
              : [];

            return {
              id:
                typeof session?.id === "string" && session.id
                  ? session.id
                  : crypto.randomUUID(),
              title:
                typeof session?.title === "string" && session.title.trim()
                  ? session.title.trim()
                  : "新对话",
              attachments,
              messages: messages.length > 0 ? messages : [...initialMessages],
            };
          });
        }
      }
    } catch (error) {
      console.error("Failed to restore saved sessions:", error);
    }

    if (nextSessions.length === 0) {
      nextSessions = [createSession()];
    }

    setSessions(nextSessions);
    setCurrentSessionId(
      savedCurrentSessionId &&
        nextSessions.some((session) => session.id === savedCurrentSessionId)
        ? savedCurrentSessionId
        : nextSessions[0].id
    );
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded || sessions.length === 0) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, serializeSessionsForStorage(sessions));

      if (currentSessionId) {
        localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
      }
    } catch (error) {
      console.error("Failed to persist sessions:", error);
    }
  }, [sessions, currentSessionId, hasLoaded]);

  useEffect(() => {
    const currentMessageCount = currentSession?.messages.length ?? 0;
    const sessionChanged = previousSessionIdRef.current !== currentSession?.id;
    const messageCountIncreased =
      currentMessageCount > previousMessageCountRef.current;
    const loadingStarted = isCurrentSessionLoading && !previousLoadingRef.current;

    if (sessionChanged || messageCountIncreased || loadingStarted) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    previousSessionIdRef.current = currentSession?.id ?? "";
    previousMessageCountRef.current = currentMessageCount;
    previousLoadingRef.current = isCurrentSessionLoading;
  }, [currentSession?.id, currentSession?.messages.length, isCurrentSessionLoading]);

  function handleCreateSession() {
    const newSession = createSession();

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setInput("");
  }

  function handleDeleteSession(sessionId: string) {
    if (sessions.length === 1) {
      const resetSession = createSession();

      setSessions([resetSession]);
      setCurrentSessionId(resetSession.id);
      setInput("");
      setUploadingSessions({});
      setLoadingSessions({});
      setSessionErrors({});
      return;
    }

    const remainingSessions = sessions.filter((session) => session.id !== sessionId);

    setSessions(remainingSessions);
    setLoadingSessions((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setUploadingSessions((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setSessionErrors((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });

    if (currentSessionId === sessionId) {
      setCurrentSessionId(remainingSessions[0].id);
      setInput("");
    }
  }

  function handleStartRename(session: ChatSession) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  function handleSaveRename() {
    const normalizedTitle = editingTitle.trim() || "新对话";

    setSessions((prev) =>
      prev.map((session) =>
        session.id === editingSessionId
          ? {
              ...session,
              title: normalizedTitle,
            }
          : session
      )
    );

    setEditingSessionId("");
    setEditingTitle("");
  }

  function handleCancelRename() {
    setEditingSessionId("");
    setEditingTitle("");
  }

  async function handleCopyMessage(messageKey: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageKey(messageKey);

      window.setTimeout(() => {
        setCopiedMessageKey((current) =>
          current === messageKey ? "" : current
        );
      }, 1500);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!currentSession || !files || files.length === 0) {
      return;
    }

    setSessionErrors((prev) => ({
      ...prev,
      [currentSession.id]: "",
    }));
    setUploadingSessions((prev) => ({
      ...prev,
      [currentSession.id]: true,
    }));

    try {
      const uploadedAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", currentSession.id);

        const response = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "上传失败了，请稍后再试。");
        }

        uploadedAttachments.push(data.attachment as Attachment);
      }

      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSession.id
            ? {
                ...session,
                attachments: [...uploadedAttachments, ...session.attachments],
              }
            : session
        )
      );
    } catch (error) {
      setSessionErrors((prev) => ({
        ...prev,
        [currentSession.id]:
          error instanceof Error ? error.message : "上传失败了，请稍后再试。",
      }));
    } finally {
      setUploadingSessions((prev) => ({
        ...prev,
        [currentSession.id]: false,
      }));
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    if (!currentSession) {
      return;
    }

    try {
      const response = await fetch(
        `/api/uploads?attachmentId=${encodeURIComponent(attachmentId)}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "删除附件失败了，请稍后再试。");
      }

      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSession.id
            ? {
                ...session,
                attachments: session.attachments.filter(
                  (attachment) => attachment.id !== attachmentId
                ),
              }
            : session
        )
      );
    } catch (error) {
      setSessionErrors((prev) => ({
        ...prev,
        [currentSession.id]:
          error instanceof Error ? error.message : "删除附件失败了，请稍后再试。",
      }));
    }
  }

  async function handleSubmit(overrideInput?: string) {
    if (!currentSession || isCurrentSessionLoading) {
      return;
    }

    const messageContent = (overrideInput ?? input).trim();

    if (!messageContent) {
      setSessionErrors((prev) => ({
        ...prev,
        [currentSession.id]: "请先在下方输入问题。",
      }));
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: messageContent,
    };

    const attachmentContext = currentSession.attachments
      .filter((attachment) => attachment.extractedText)
      .map(
        (attachment) =>
          `文件名：${attachment.name}\n文件内容：\n${attachment.extractedText}`
      )
      .join("\n\n");
    const updatedMessages = [...currentSession.messages, userMessage];

    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSession.id
          ? {
              ...session,
              title:
                session.messages.length === initialMessages.length
                  ? buildSessionTitle(messageContent)
                  : session.title,
              messages: updatedMessages,
            }
          : session
      )
    );

    setInput("");
    setSessionErrors((prev) => ({
      ...prev,
      [currentSession.id]: "",
    }));
    setLoadingSessions((prev) => ({
      ...prev,
      [currentSession.id]: true,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          attachmentContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSessionErrors((prev) => ({
          ...prev,
          [currentSession.id]: data.answer || "请求失败了，请稍后再试。",
        }));
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
      };

      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSession.id
            ? {
                ...session,
                messages: [...session.messages, assistantMessage],
              }
            : session
        )
      );
    } catch (error) {
      console.error(error);
      setSessionErrors((prev) => ({
        ...prev,
        [currentSession.id]: "请求失败了，请稍后再试。",
      }));
    } finally {
      setLoadingSessions((prev) => ({
        ...prev,
        [currentSession.id]: false,
      }));
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex h-[calc(100vh-4rem)] flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:h-[calc(100vh-5rem)] lg:sticky lg:top-6">
          <button
            onClick={handleCreateSession}
            className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            新建对话
          </button>

          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {sessions.map((session) => {
              const isActive = session.id === currentSession?.id;

              return (
                <div
                  key={session.id}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {editingSessionId === session.id ? (
                        <div className="space-y-2">
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveRename();
                              }

                              if (e.key === "Escape") {
                                handleCancelRename();
                              }
                            }}
                            autoFocus
                            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveRename}
                              className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white transition hover:bg-zinc-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={handleCancelRename}
                              className="rounded-lg px-2 py-1 text-xs transition hover:bg-zinc-200 hover:text-zinc-900"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentSessionId(session.id);
                          }}
                          className="min-w-0 w-full text-left"
                        >
                          <div className="truncate font-medium">{session.title}</div>
                          <div
                            className={`mt-1 truncate text-xs ${
                              isActive ? "text-zinc-300" : "text-zinc-500"
                            }`}
                          >
                            {session.messages[session.messages.length - 1]?.content ||
                              "暂无消息"}
                          </div>
                        </button>
                      )}
                    </div>

                    {editingSessionId !== session.id && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(session);
                          }}
                          className={`rounded-lg px-2 py-1 text-xs transition ${
                            isActive
                              ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                              : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                          }`}
                        >
                          重命名
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className={`rounded-lg px-2 py-1 text-xs transition ${
                            isActive
                              ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                              : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                          }`}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
              AI 学习助手
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
              输入一个关于 AI 的问题，我会基于 DeepSeek 为你生成清晰、易懂的回答。
            </p>
          </div>

          <div className="mt-8">
            <div className="mb-6">
              <p className="text-sm font-medium text-zinc-500">快捷问题</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {currentSession?.messages.map((message, index) => {
                const messageKey = `${currentSession.id}-${index}`;

                return (
                  <div
                    key={messageKey}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl bg-zinc-900 px-5 py-4 text-white"
                        : "mr-auto max-w-[85%] rounded-2xl bg-zinc-100 px-5 py-4 text-zinc-900"
                    }
                  >
                    <p className="whitespace-pre-wrap leading-7">{message.content}</p>

                    {message.role === "assistant" && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() =>
                            handleCopyMessage(messageKey, message.content)
                          }
                          className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
                        >
                          {copiedMessageKey === messageKey ? "已复制" : "复制回答"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isCurrentSessionLoading && (
                <div className="mr-auto max-w-[85%] animate-pulse rounded-2xl bg-zinc-100 px-5 py-4 text-zinc-500">
                  AI 正在思考中...
                </div>
              )}

              {currentSessionError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-600">
                  {currentSessionError}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-200 pt-6">
            <label
              htmlFor="question"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              输入你的问题
            </label>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100">
                {isCurrentSessionUploading ? "上传中..." : "上传附件或图片"}
                <input
                  type="file"
                  multiple
                  disabled={isCurrentSessionUploading}
                  accept=".txt,.md,.csv,.json,.pdf,image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    void handleUploadFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
              </label>
              <p className="text-sm leading-6 text-zinc-500">
                可上传图片、PDF 或文本附件。
              </p>
            </div>

            {currentSession && currentSession.attachments.length > 0 && (
              <div className="mb-4 space-y-2">
                {currentSession.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-800">
                        {attachment.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {attachment.kind === "image" ? "图片" : "附件"} · {formatFileSize(attachment.size)} · {attachment.mimeType}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        void handleRemoveAttachment(attachment.id);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              id="question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isCurrentSessionLoading) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="比如：请结合上传的附件，解释一下 RAG 的核心概念。"
              className="min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />

            <button
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isCurrentSessionLoading || isCurrentSessionUploading}
              className="mt-4 inline-flex items-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isCurrentSessionLoading
                ? "思考中..."
                : isCurrentSessionUploading
                  ? "上传中..."
                  : "发送消息"}
            </button>
          </div>
        </section>
      </div>

      <button
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="fixed bottom-6 right-6 rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-100"
      >
        回到顶部
      </button>
    </main>
  );
}
