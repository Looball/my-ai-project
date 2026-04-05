import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 学习助手",
  description: "一个基于 Next.js 和 DeepSeek 构建的 AI 问答网站",
};


/**
 * 根布局组件，定义了整个应用的基本HTML结构
 * @param children - 子组件，将被包裹在根布局中
 * @returns 返回一个包含子组件的完整HTML结构
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} 
    >
      <body className="min-h-full flex flex-col">{children}</body> 
    </html>
  );
}
