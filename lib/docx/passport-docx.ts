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
  imageDataUrl: string; // Base64 with white bg & 1.5pt black border
  includeName?: boolean;
}

export async function generatePassportPhotosDocx(
  persons: PhotoPerson[],
  layoutCount: 4 | 9 = 4,
  filename?: string
) {
  if (!persons || persons.length === 0) return;

  const defaultFilename =
    filename || (layoutCount === 9 ? "CopyCat_Photos_9x_A5.docx" : "CopyCat_Photos_4x_A6.docx");

  // A6: 105mm x 148mm (4 photos: 2 columns x 2 rows)
  // A5: 148mm x 210mm (9 photos: 3 columns x 3 rows)
  const isA5 = layoutCount === 9;
  const pageWidthMm = isA5 ? 148 : 105;
  const pageHeightMm = isA5 ? 210 : 148;
  const loopCount = layoutCount;
  const itemsPerRow = isA5 ? 3 : 2;

  // 4.0 cm width x 5.2 cm height in points (40mm / 25.4 * 96 = ~151px, 52mm / 25.4 * 96 = ~196px)
  const imgWidth = 151;
  const imgHeight = 196;

  const sections = persons.map((person) => {
    const imgBytes = base64ToUint8Array(person.imageDataUrl);
    const paragraphs: Paragraph[] = [];

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
            spacing: { before: 80, after: 40 },
            children: currentRowImages,
          })
        );
        currentRowImages = [];

        // Optional Name under row if requested (Font size 12 bold, rightToLeft)
        if (person.includeName && person.name && person.name.trim()) {
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 80 },
              children: [
                new TextRun({
                  text: person.name.trim(),
                  font: "Arial",
                  size: 24, // 12pt (docx uses half-points)
                  bold: true,
                  rightToLeft: true,
                }),
              ],
            })
          );
        }
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
            top: convertMillimetersToTwip(6),
            bottom: convertMillimetersToTwip(6),
            left: convertMillimetersToTwip(5),
            right: convertMillimetersToTwip(5),
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
