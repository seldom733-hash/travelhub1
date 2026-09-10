// @ts-nocheck
/**
 * Jest mock for @react-pdf/renderer.
 * The actual package is ESM-only and cannot be transformed by Jest's CJS runtime.
 * This mock produces valid PDF binary so e2e tests verify the full render→store→serve pipeline.
 */

const PDF_HEADER = "%PDF-1.4\n";

function createMockBlob(content: string) {
  return {
    arrayBuffer: async () => Buffer.from(content, "latin1"),
    size: content.length,
    type: "application/pdf",
  };
}

function renderToPdf(element: any): string {
  const texts: string[] = [];
  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    if (typeof node === "string") { texts.push(node); return; }
    if (node.props) {
      if (typeof node.props.children === "string") texts.push(node.props.children);
      if (Array.isArray(node.props.children)) node.props.children.forEach(walk);
    }
  }
  walk(element);

  const pageContent = texts
    .filter((t: string) => t.length > 0)
    .map((t: string, i: number) => `BT /F1 10 Tf 50 ${750 - i * 20} Td (${t.replace(/[()\\]/g, "\\$&")}) Tj ET`)
    .join("\n");

  return [
    PDF_HEADER,
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${pageContent.length}>>\nstream\n${pageContent}\nendstream\nendobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000352 00000 n \n",
    "trailer<</Size 6/Root 1 0 R>>\nstartxref\n423\n%%EOF",
  ].join("\n");
}

function pdfFn(element: any) {
  return {
    toBlob: async () => createMockBlob(renderToPdf(element)),
    toBuffer: async () => Buffer.from(renderToPdf(element), "latin1"),
    toString: async () => renderToPdf(element),
  };
}

const MockDocument = "MockDocument";
const MockPage = "MockPage";
const MockText = "MockText";
const MockView = "MockView";
const MockStyleSheet = { create: (s: any) => s };

module.exports = { pdf: pdfFn, Document: MockDocument, Page: MockPage, Text: MockText, View: MockView, StyleSheet: MockStyleSheet };
