import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

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

    const extractedText = isText ? buffer.toString("utf8").trim() : "";

    return NextResponse.json({
      attachment: {
        id,
        name: sanitizeFilename(file.name),
        mimeType,
        size: file.size,
        kind: isImage ? "image" : "document",
        uploadedAt: new Date().toISOString(),
        extractedText,
        storagePath: storedPath,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "上传失败了，请稍后再试。" },
      { status: 500 }
    );
  }
}
