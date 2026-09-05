import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  ImageRun,
  convertMillimetersToTwip,
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";

function base64ToUint8Array(base64: string): Uint8Array {
  const pureBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = window.atob(pureBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an A5 Word document with exact 9.0cm card width,
 * perfectly centered horizontally and vertically for instant Ctrl + P printing.
 */
export async function generateIdCardsDocx(imagesBase64: string[], filename = "CopyCat_ID_Cards_A5.docx") {
  if (!imagesBase64 || imagesBase64.length === 0) return;

  const children: Paragraph[] = [];

  // 9.0 cm width in points (9.0 / 2.54 * 96 = ~340px)
  // Height proportional for standard Egyptian national ID (5.4 / 8.6 * 340 = ~214px)
  const cardWidthPx = 340;
  const cardHeightPx = 214;

  imagesBase64.forEach((imgBase64, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    const imgBytes = base64ToUint8Array(imgBase64);

    const paragraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 4.5 * 567, // ~4.5 cm in twips to center vertically on A5 height (21cm)
      },
      children: [
        new ImageRun({
          data: imgBytes,
          transformation: {
            width: cardWidthPx,
            height: cardHeightPx,
          },
          type: "jpg",
        }),
      ],
    });

    children.push(paragraph);
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(148), // A5 Width (148 mm)
              height: convertMillimetersToTwip(210), // A5 Height (210 mm)
            },
            margin: {
              top: convertMillimetersToTwip(12),
              bottom: convertMillimetersToTwip(12),
              left: convertMillimetersToTwip(10),
              right: convertMillimetersToTwip(10),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
