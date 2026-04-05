"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const initialMessages: Message[] = [
    {
      role: "assistant",
      content: "你好，我是你的 AI 学习助手。你可以问我任何关于 AI 的问题。",
    },
  ];
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit() {
    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: input,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.answer || "请求失败了，请稍后再试。");
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      setError("请求失败了，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setMessages(initialMessages);
    setInput("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm md:p-10">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
          AI 学习助手
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
          输入一个关于 AI 的问题，我会基于 DeepSeek 为你生成清晰、易懂的回答。
        </p>

        <div className="mt-8 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-zinc-900 px-5 py-4 text-white"
                  : "mr-auto max-w-[85%] rounded-2xl bg-zinc-100 px-5 py-4 text-zinc-900"
              }
            >
              <p className="whitespace-pre-wrap leading-7">{message.content}</p>
            </div>
          ))}

          {isLoading && (
            <div className="mr-auto max-w-[85%] rounded-2xl bg-zinc-100 px-5 py-4 text-zinc-500 animate-pulse">
              AI 正在思考中...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="inline-flex items-center rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            新建对话
          </button>
        </div>

        <div className="mt-8">
          <label
            htmlFor="question"
            className="mb-2 block text-sm font-medium text-zinc-700"
          >
            输入你的问题
          </label>
          <textarea
            id="question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="比如：什么是大语言模型？"
            className="min-h-[140px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="mt-4 inline-flex items-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isLoading ? "思考中..." : "发送消息"}
        </button>
      </div>
    </main>
  );
}
