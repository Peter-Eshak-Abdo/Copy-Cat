import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  ImageRun,
  convertMillimetersToTwip,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";

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

/**
 * Generates an A5 Word document for Egyptian National ID cards.
 * Official Standard Dimensions: 85.6mm x 54mm (~324px x 204px).
 *
 * Layout modes:
 * - "single_sheet": Front and Back arranged vertically on the SAME A5 sheet (Standard Egyptian Bank/Gov Copy).
 * - "separate_pages": Each face on its own separate page.
 */
export async function generateIdCardsDocx(
  input: (string | IdCardDocxPair)[],
  filename = "CopyCat_ID_Cards_A5.docx",
  layout: "single_sheet" | "separate_pages" = "single_sheet"
) {
  if (!input || input.length === 0) return;

  // Exact Egyptian National ID card dimensions: 8.56 cm x 5.40 cm
  // In Word pixels (96 DPI): 85.6 / 25.4 * 96 = ~324px, 54 / 25.4 * 96 = ~204px
  const cardWidthPx = 324;
  const cardHeightPx = 204;

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

  const sections = pairs.map((pair, pIdx) => {
    const children: (Paragraph | Table)[] = [];

    const hasFront = Boolean(pair.front);
    const hasBack = Boolean(pair.back);

    if (hasFront && hasBack && layout === "single_sheet") {
      // Front and Back on the SAME A5 page (Standard Egyptian photocopy)
      const frontBytes = base64ToUint8Array(pair.front!);
      const backBytes = base64ToUint8Array(pair.back!);

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
                  top: convertMillimetersToTwip(8),
                  bottom: convertMillimetersToTwip(12),
                  left: 0,
                  right: 0,
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: frontBytes,
                        transformation: {
                          width: cardWidthPx,
                          height: cardHeightPx,
                        },
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
                  top: convertMillimetersToTwip(12),
                  bottom: convertMillimetersToTwip(8),
                  left: 0,
                  right: 0,
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: backBytes,
                        transformation: {
                          width: cardWidthPx,
                          height: cardHeightPx,
                        },
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
      // Single card or individual faces
      const targetSrc = pair.front || pair.back;
      if (targetSrc) {
        const imgBytes = base64ToUint8Array(targetSrc);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {
              before: convertMillimetersToTwip(65), // Vertically centered on A5 height
            },
            children: [
              new ImageRun({
                data: imgBytes,
                transformation: {
                  width: cardWidthPx,
                  height: cardHeightPx,
                },
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
            width: convertMillimetersToTwip(148), // A5 Width (148 mm)
            height: convertMillimetersToTwip(210), // A5 Height (210 mm)
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
