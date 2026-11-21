import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Cell = string | number | null | undefined;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function exportCSV(filename: string, headers: string[], rows: Cell[][]) {
  download(new Blob(["﻿" + toCSV(headers, rows)], { type: "text/csv;charset=utf-8" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export interface PdfSection {
  title: string;
  note?: string;
  headers: string[];
  rows: Cell[][];
}

export function exportPDF(filename: string, title: string, subtitle: string, sections: PdfSection[], disclaimer?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(22, 54, 38);
  doc.rect(0, 0, w, 64, "F");
  doc.setFillColor(191, 230, 70);
  doc.circle(40, 32, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("HarvestQuoin", 58, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Plan dispatch around produce quality", 58, 44);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, w - 40, 30, { align: "right" });

  doc.setTextColor(22, 54, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 98);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 95);
  doc.text(subtitle, 40, 114);
  let y = 132;
  if (disclaimer) {
    doc.setFontSize(8.5);
    doc.setTextColor(110, 80, 160);
    const lines = doc.splitTextToSize(disclaimer, w - 80);
    doc.text(lines, 40, y);
    y += lines.length * 11 + 6;
  }

  for (const s of sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(22, 54, 38);
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 50;
    }
    doc.text(s.title, 40, y + 8);
    y += 14;
    if (s.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(s.note, 40, y + 6);
      y += 10;
    }
    autoTable(doc, {
      startY: y + 4,
      head: [s.headers],
      body: s.rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [33, 82, 54], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 245, 238] },
      margin: { left: 40, right: 40 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 22;
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${p} of ${pages}`, w - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
