import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  ImageRun,
  convertMillimetersToTwip,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
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

  // ~1cm white margin under photo = 567 twips
  const bottomCuttingMarginTwips = 567; // 10mm = 1cm
  const horizontalCellMarginTwips = 220; // ~4mm between photos

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const sections = persons.map((person) => {
    const imgBytes = base64ToUint8Array(person.imageDataUrl);
    const tableRows: TableRow[] = [];
    let currentRowCells: TableCell[] = [];

    for (let c = 0; c < loopCount; c++) {
      const cellChildren: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [
            new ImageRun({
              data: imgBytes,
              transformation: {
                width: imgWidth,
                height: imgHeight,
              },
              type: "jpg",
            }),
          ],
        }),
      ];

      // Optional name under photo
      if (person.includeName && person.name && person.name.trim()) {
        cellChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 40 },
            children: [
              new TextRun({
                text: person.name.trim(),
                font: "Arial",
                size: 24, // 12pt
                bold: true,
                rightToLeft: true,
              }),
            ],
          })
        );
      }

      currentRowCells.push(
        new TableCell({
          borders: noBorders,
          margins: {
            top: 60,
            bottom: bottomCuttingMarginTwips, // 1cm white gap at the bottom for easy cutting
            left: horizontalCellMarginTwips,
            right: horizontalCellMarginTwips,
          },
          children: cellChildren,
        })
      );

      if ((c + 1) % itemsPerRow === 0 || c === loopCount - 1) {
        tableRows.push(
          new TableRow({
            children: currentRowCells,
          })
        );
        currentRowCells = [];
      }
    }

    const table = new Table({
      alignment: AlignmentType.CENTER,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: tableRows,
    });

    return {
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(pageWidthMm),
            height: convertMillimetersToTwip(pageHeightMm),
          },
          margin: {
            top: convertMillimetersToTwip(5),
            bottom: convertMillimetersToTwip(5),
            left: convertMillimetersToTwip(5),
            right: convertMillimetersToTwip(5),
          },
        },
      },
      children: [table],
    };
  });

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, defaultFilename);
}
