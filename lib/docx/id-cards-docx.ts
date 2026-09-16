import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  ImageRun,
  convertMillimetersToTwip,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import fileSaver from "file-saver";
const saveAs = (fileSaver)?.saveAs || fileSaver;

function base64ToUint8Array(base64: string): Uint8Array {
  const pureBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(pureBase64, "base64"));
  }
  const binaryString = window.atob(pureBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface IdCardDocxPair {
  front?: string | null;
  back?: string | null;
  name?: string;
}

export type PaperSize = "A4" | "A5";
export type DuplexAlignment = "vertical" | "horizontal";
export type LayoutMode = "single_sheet" | "separate_pages";

export interface GenerateIdCardsDocxOptions {
  filename?: string;
  paperSize?: PaperSize;
  layout?: LayoutMode;
  duplexAlignment?: DuplexAlignment;
}

/**
 * Generates an A4 or A5 Word document for Egyptian National ID cards.
 * Official Standard Dimensions: ISO/IEC 7810 ID-1 = 85.6mm x 54.0mm (~324px x 204px at 96 DPI).
 *
 * Supports:
 * - A4 (210mm x 297mm) and A5 (148mm x 210mm) paper sizes.
 * - Duplex alignment: "vertical" (stacked on same vertical axis) or "horizontal" (side-by-side with symmetric margins).
 */
export async function generateIdCardsDocx(
  input: (string | IdCardDocxPair)[],
  options: GenerateIdCardsDocxOptions | string = "CopyCat_ID_Cards_A4.docx",
  legacyLayout: LayoutMode = "single_sheet"
) {
  if (!input || input.length === 0) return;

  const opts: GenerateIdCardsDocxOptions =
    typeof options === "string"
      ? { filename: options, layout: legacyLayout, paperSize: "A4", duplexAlignment: "vertical" }
      : {
          filename: options.paperSize === "A5" ? "CopyCat_ID_Cards_A5.docx" : "CopyCat_ID_Cards_A4.docx",
          paperSize: "A4",
          layout: "single_sheet",
          duplexAlignment: "vertical",
          ...options,
        };

  const {
    filename = "CopyCat_ID_Cards_A4.docx",
    paperSize = "A4",
    layout = "single_sheet",
    duplexAlignment = "vertical",
  } = opts;

  // Exact ID-1 card dimensions: 85.6mm x 54.0mm
  // In Word pixels (96 DPI): 85.6 / 25.4 * 96 = ~324px, 54 / 25.4 * 96 = ~204px
  const cardWidthPx = 324;
  const cardHeightPx = 204;

  const isA4 = paperSize === "A4";
  const pageWidthMm = isA4 ? 210 : 148;
  const pageHeightMm = isA4 ? 297 : 210;

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  // Normalize input into pairs
  const pairs: IdCardDocxPair[] = [];
  if (typeof input[0] === "string") {
    const stringArray = input as string[];
    if (layout === "single_sheet") {
      for (let i = 0; i < stringArray.length; i += 2) {
        pairs.push({
          front: stringArray[i] || null,
          back: stringArray[i + 1] || null,
        });
      }
    } else {
      stringArray.forEach((img) => pairs.push({ front: img }));
    }
  } else {
    pairs.push(...(input as IdCardDocxPair[]));
  }

  const sections = pairs.map((pair) => {
    const children: (Paragraph | Table)[] = [];

    const hasFront = Boolean(pair.front);
    const hasBack = Boolean(pair.back);

    if (hasFront && hasBack && layout === "single_sheet") {
      const frontBytes = base64ToUint8Array(pair.front!);
      const backBytes = base64ToUint8Array(pair.back!);

      if (duplexAlignment === "horizontal") {
        // Horizontal Duplex alignment: Front & Back side-by-side
        const table = new Table({
          alignment: AlignmentType.CENTER,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  margins: {
                    top: convertMillimetersToTwip(isA4 ? 20 : 12),
                    bottom: convertMillimetersToTwip(isA4 ? 20 : 12),
                    left: convertMillimetersToTwip(4),
                    right: convertMillimetersToTwip(4),
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: frontBytes,
                          transformation: { width: cardWidthPx, height: cardHeightPx },
                          type: pair.front?.includes("image/png") ? "png" : "jpg",
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  borders: noBorders,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  margins: {
                    top: convertMillimetersToTwip(isA4 ? 20 : 12),
                    bottom: convertMillimetersToTwip(isA4 ? 20 : 12),
                    left: convertMillimetersToTwip(4),
                    right: convertMillimetersToTwip(4),
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: backBytes,
                          transformation: { width: cardWidthPx, height: cardHeightPx },
                          type: pair.back?.includes("image/png") ? "png" : "jpg",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
        children.push(table);
      } else {
        // Vertical Duplex alignment: Front and Back stacked vertically with exact center alignment
        const table = new Table({
          alignment: AlignmentType.CENTER,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            // Front Card Row
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders,
                  margins: {
                    top: convertMillimetersToTwip(isA4 ? 25 : 8),
                    bottom: convertMillimetersToTwip(isA4 ? 18 : 12),
                    left: 0,
                    right: 0,
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: frontBytes,
                          transformation: { width: cardWidthPx, height: cardHeightPx },
                          type: pair.front?.includes("image/png") ? "png" : "jpg",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            // Back Card Row
            new TableRow({
              children: [
                new TableCell({
                  borders: noBorders,
                  margins: {
                    top: convertMillimetersToTwip(isA4 ? 18 : 12),
                    bottom: convertMillimetersToTwip(isA4 ? 25 : 8),
                    left: 0,
                    right: 0,
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: backBytes,
                          transformation: { width: cardWidthPx, height: cardHeightPx },
                          type: pair.back?.includes("image/png") ? "png" : "jpg",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
        children.push(table);
      }
    } else {
      // Single card or individual faces
      const targetSrc = pair.front || pair.back;
      if (targetSrc) {
        const imgBytes = base64ToUint8Array(targetSrc);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {
              before: convertMillimetersToTwip(isA4 ? 90 : 65),
            },
            children: [
              new ImageRun({
                data: imgBytes,
                transformation: { width: cardWidthPx, height: cardHeightPx },
                type: targetSrc.includes("image/png") ? "png" : "jpg",
              }),
            ],
          })
        );
      }
    }

    return {
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(pageWidthMm),
            height: convertMillimetersToTwip(pageHeightMm),
          },
          margin: {
            top: convertMillimetersToTwip(10),
            bottom: convertMillimetersToTwip(10),
            left: convertMillimetersToTwip(10),
            right: convertMillimetersToTwip(10),
          },
        },
      },
      children,
    };
  });

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  if (typeof window !== "undefined") {
    saveAs(blob, filename);
  }
  return blob;
}
