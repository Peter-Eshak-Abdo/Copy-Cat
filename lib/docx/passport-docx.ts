import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  ImageRun,
  convertMillimetersToTwip,
  TextRun,
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

export interface PhotoPerson {
  id: string;
  name: string;
  imageDataUrl: string; // Base64 or ObjectURL converted to base64
}

export async function generatePassportPhotosDocx(
  persons: PhotoPerson[],
  layoutCount: 4 | 9 = 4,
  filename?: string
) {
  if (!persons || persons.length === 0) return;

  const defaultFilename =
    filename || (layoutCount === 9 ? "Photos_Layout_A5.docx" : "Photos_Layout_A6.docx");

  // A6: 105mm x 148mm (4 photos: 2x2)
  // A5: 148mm x 210mm (9 photos: 3x3)
  const isA5 = layoutCount === 9;
  const pageWidthMm = isA5 ? 148 : 105;
  const pageHeightMm = isA5 ? 210 : 148;
  const loopCount = layoutCount;
  const itemsPerRow = isA5 ? 3 : 2;

  // 4x5.2 cm = ~151 x 196 px
  const imgWidth = 150;
  const imgHeight = 195;

  const sections = persons.map((person) => {
    const imgBytes = base64ToUint8Array(person.imageDataUrl);
    const paragraphs: Paragraph[] = [];

    // Optional Person Name header
    if (person.name && person.name.trim()) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: person.name.trim(),
              font: "Arial",
              size: 20,
              bold: true,
              rightToLeft: true,
            }),
          ],
        })
      );
    }

    let currentRowImages: ImageRun[] = [];

    for (let c = 0; c < loopCount; c++) {
      currentRowImages.push(
        new ImageRun({
          data: imgBytes,
          transformation: {
            width: imgWidth,
            height: imgHeight,
          },
          type: "jpg",
        })
      );

      if ((c + 1) % itemsPerRow === 0 || c === loopCount - 1) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 },
            children: currentRowImages,
          })
        );
        currentRowImages = [];
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
            top: convertMillimetersToTwip(5),
            bottom: convertMillimetersToTwip(4),
            left: convertMillimetersToTwip(4),
            right: convertMillimetersToTwip(4),
          },
        },
      },
      children: paragraphs,
    };
  });

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, defaultFilename);
}
