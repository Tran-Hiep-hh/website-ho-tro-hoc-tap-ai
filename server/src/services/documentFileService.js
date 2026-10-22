import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractDocumentText(file, type) {
  if (type === "TXT") return new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
  if (type === "DOCX") {
    if (file.buffer.readUInt16LE(0) !== 0x4b50) throw new Error("Invalid DOCX");
    return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  }
  if (file.buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF");
  const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
  try {
    return (await parser.getText()).pages.map((page) => page.text).join("\n\n");
  } finally {
    await parser.destroy();
  }
}
