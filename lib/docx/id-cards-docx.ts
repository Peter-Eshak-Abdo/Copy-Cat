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

export async function generateIdCardsDocx(imagesBase64: string[], filename = "Smart_CamScanner_A5.docx") {
  if (!imagesBase64 || imagesBase64.length === 0) return;

  const children: Paragraph[] = [];

  imagesBase64.forEach((imgBase64, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    const imgBytes = base64ToUint8Array(imgBase64);

    const paragraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 4.5 * 567, // ~4.5 cm in twips (1cm ~ 567 twips)
      },
      children: [
        new ImageRun({
          data: imgBytes,
          transformation: {
            width: 325, // 8.6 cm equivalent
            height: 205, // proportion standard card height (~5.4cm)
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
              width: convertMillimetersToTwip(148), // A5 Width
              height: convertMillimetersToTwip(210), // A5 Height
            },
            margin: {
              top: convertMillimetersToTwip(15),
              bottom: convertMillimetersToTwip(15),
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
