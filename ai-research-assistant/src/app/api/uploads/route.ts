import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(tmpdir(), "ai-research-assistant-uploads");
const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const APPLICATION_MIME_TYPES = new Set([
  "application/pdf",
]);

function sanitizeFilename(filename: string) {
  const normalized = path.basename(filename).replace(/[^\w.-]/g, "_");
  return normalized || "upload";
}

function toResponseAttachment(attachment: {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: string;
  uploadedAt: Date;
  extractedText: string;
  storagePath: string;
}) {
  return {
    ...attachment,
    kind: attachment.kind as "image" | "document",
    uploadedAt: attachment.uploadedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json(
      { error: "缺少 sessionId。" },
      { status: 400 }
    );
  }

  try {
    const attachments = await prisma.attachment.findMany({
      where: { sessionId },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({
      attachments: attachments.map(toResponseAttachment),
    });
  } catch (error) {
    console.error("Load uploads error:", error);

    return NextResponse.json(
      { error: "读取附件失败了，请稍后再试。" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId =
      typeof formData.get("sessionId") === "string"
        ? String(formData.get("sessionId")).trim()
        : "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "缺少会话标识，无法上传文件。" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "请选择一个要上传的文件。" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "空文件无法上传，请重新选择。" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件太大了，请控制在 10MB 以内。" },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    const isText = TEXT_MIME_TYPES.has(mimeType);
    const isImage = IMAGE_MIME_TYPES.has(mimeType);
    const isSupportedApplication = APPLICATION_MIME_TYPES.has(mimeType);

    if (!isText && !isImage && !isSupportedApplication) {
      return NextResponse.json(
        {
          error:
            "暂时只支持 txt、md、csv、json、pdf 和常见图片格式（png、jpg、webp、gif）。",
        },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const extension = path.extname(file.name);
    const storedFilename = `${id}${extension}`;
    const storedPath = path.join(UPLOAD_DIR, storedFilename);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(storedPath, buffer);

    const attachment = await prisma.attachment.create({
      data: {
        id,
        sessionId,
        name: sanitizeFilename(file.name),
        mimeType,
        size: file.size,
        kind: isImage ? "image" : "document",
        uploadedAt: new Date(),
        extractedText: isText ? buffer.toString("utf8").trim() : "",
        storagePath: storedPath,
      },
    });

    return NextResponse.json({
      attachment: toResponseAttachment(attachment),
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "上传失败了，请稍后再试。" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get("attachmentId")?.trim();

  if (!attachmentId) {
    return NextResponse.json(
      { error: "缺少 attachmentId。" },
      { status: 400 }
    );
  }

  try {
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete upload error:", error);

    return NextResponse.json(
      { error: "删除附件失败了，请稍后再试。" },
      { status: 500 }
    );
  }
}
