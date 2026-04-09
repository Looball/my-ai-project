import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const MAX_ATTACHMENT_CONTEXT_LENGTH = 12000;

type RequestMessage = {
  role: "user" | "assistant";
  content: string;
};

function isRequestMessage(value: unknown): value is RequestMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RequestMessage>;

  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length > 0
  );
}

function sanitizeMessages(value: unknown): ChatCompletionMessageParam[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRequestMessage)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = sanitizeMessages(body.messages);
    const attachmentContext =
      typeof body.attachmentContext === "string"
        ? body.attachmentContext.trim()
        : "";

    if (messages.length === 0) {
      return NextResponse.json(
        { answer: "消息格式不正确，请重新输入问题后再试。" },
        { status: 400 }
      );
    }

    if (attachmentContext.length > MAX_ATTACHMENT_CONTEXT_LENGTH) {
      return NextResponse.json(
        {
          answer: `附件内容太长了，请控制在 ${MAX_ATTACHMENT_CONTEXT_LENGTH} 个字符以内后再试。`,
        },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一个简洁、清楚、乐于解释概念的 AI 学习助手。若用户上传了附件内容，请优先基于附件回答；如果附件不足以支持结论，要明确说明并补充一般性解释，避免假装附件里已经提到。",
        },
        ...(attachmentContext
          ? [
              {
                role: "system" as const,
                content: `以下是用户上传的附件内容，请在回答时优先参考：\n\n${attachmentContext}`,
              },
            ]
          : []),
        ...messages,
      ],
    });

    const answer =
      completion.choices[0]?.message?.content || "模型暂时没有返回内容。";

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("DeepSeek API error:", error);

    return NextResponse.json(
      { answer: "请求失败了，请检查 API key、网络或账户额度。" },
      { status: 500 }
    );
  }
}
