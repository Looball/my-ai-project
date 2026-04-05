import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { answer: "请先输入一个问题。" },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一个简洁、清楚、乐于解释概念的 AI 助手。",
        },
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
