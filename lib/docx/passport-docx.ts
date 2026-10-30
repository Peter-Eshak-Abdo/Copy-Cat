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
  HeightRule,
  LineRuleType,
  TableLayoutType,
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

export interface PhotoPerson {
  id: string;
  name: string;
  imageDataUrl: string; // Base64 with white bg & 1.5pt black border
  originalDataUrl?: string; // Original uploaded/cutout image for biometric reframing
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

  // A6: 105mm x 148mm (4 photos: 2 x 2) | A5: 148mm x 210mm (9 photos: 3 x 3)
  const isA5 = layoutCount === 9;
  const pageWidthMm = isA5 ? 148 : 105;
  const pageHeightMm = isA5 ? 210 : 148;
  const cols = isA5 ? 3 : 2;
  const rows = isA5 ? 3 : 2;

  // Exact 40mm x 52mm prints. Gaps match the shop's reference sheet: a narrow column gap and a wider
  // row gap for scissor cutting, sized so every photo of the grid stays on ONE page.
  const photoWmm = 40;
  const photoHmm = 52;
  const gapXmm = isA5 ? 6 : 5;
  const gapYmm = isA5 ? 10 : 15;
  const topMarginMm = 6;
  const gridWmm = cols * photoWmm + (cols - 1) * gapXmm;
  const sideMarginMm = (pageWidthMm - gridWmm) / 2;

  // docx ImageRun sizes are in 96-dpi pixels
  const mmToPx = (mm: number) => Math.round((mm / 25.4) * 96);

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };
  const zeroMargins = { top: 0, bottom: 0, left: 0, right: 0 };
  const emptyCell = (widthMm: number) =>
    new TableCell({
      borders: noBorders,
      margins: zeroMargins,
      width: { size: convertMillimetersToTwip(widthMm), type: WidthType.DXA },
      children: [new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [] })],
    });

  // Column layout: photo | gap | photo [| gap | photo]
  const columnWidthsMm: number[] = [];
  for (let c = 0; c < cols; c++) {
    columnWidthsMm.push(photoWmm);
    if (c < cols - 1) columnWidthsMm.push(gapXmm);
  }

  const sections = persons.map((person) => {
    const imgBytes = base64ToUint8Array(person.imageDataUrl);
    const showName = !!(person.includeName && person.name && person.name.trim());

    const photoCell = () => {
      const children: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              data: imgBytes,
              transformation: { width: mmToPx(photoWmm), height: mmToPx(photoHmm) },
              type: person.imageDataUrl.includes("image/png") ? "png" : "jpg",
            }),
          ],
        }),
      ];
      if (showName) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 0 },
            children: [
              new TextRun({ text: person.name.trim(), font: "Arial", size: 18, bold: true, rightToLeft: true }),
            ],
          })
        );
      }
      return new TableCell({
        borders: noBorders,
        margins: zeroMargins,
        width: { size: convertMillimetersToTwip(photoWmm), type: WidthType.DXA },
        children,
      });
    };

    const tableRows: TableRow[] = [];
    for (let r = 0; r < rows; r++) {
      const cells: TableCell[] = [];
      for (let c = 0; c < cols; c++) {
        cells.push(photoCell());
        if (c < cols - 1) cells.push(emptyCell(gapXmm));
      }
      tableRows.push(
        new TableRow({
          cantSplit: true,
          height: { value: convertMillimetersToTwip(photoHmm), rule: HeightRule.ATLEAST },
          children: cells,
        })
      );
      if (r < rows - 1) {
        tableRows.push(
          new TableRow({
            cantSplit: true,
            // A printed name already takes part of the cutting gap
            height: { value: convertMillimetersToTwip(showName ? gapYmm - 5 : gapYmm), rule: HeightRule.EXACT },
            children: columnWidthsMm.map((w) => emptyCell(w)),
          })
        );
      }
    }

    const table = new Table({
      alignment: AlignmentType.CENTER,
      layout: TableLayoutType.FIXED,
      width: { size: convertMillimetersToTwip(gridWmm), type: WidthType.DXA },
      columnWidths: columnWidthsMm.map((w) => convertMillimetersToTwip(w)),
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
            top: convertMillimetersToTwip(topMarginMm),
            bottom: convertMillimetersToTwip(4),
            left: convertMillimetersToTwip(sideMarginMm),
            right: convertMillimetersToTwip(sideMarginMm),
            header: 0,
            footer: 0,
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
  if (typeof window !== "undefined") {
    saveAs(blob, defaultFilename);
  }
  return blob;
}
