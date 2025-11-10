import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import "../styles/exportSchedule.css";
import { FaRegStopCircle } from "react-icons/fa";


interface ExportScheduleProps {
  onClose: () => void;
  collegeName: string;
}

const ExportSchedule: React.FC<ExportScheduleProps> = ({ onClose, collegeName }) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportMode, setExportMode] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const stopExport = useRef(false);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll(".scheduler-view-card"));
    const dates = cards
      .map((card) =>
        card.textContent?.match(/\b[A-Za-z]+\s\d{1,2},\s\d{4}/)?.[0]
      )
      .filter((d): d is string => !!d);
    setAvailableDates([...new Set(dates)]); // ✅ Unique dates
  }, []);

  const handleStop = () => {
    stopExport.current = true;
    cleanupExportMode();
    setExporting(false);
    toast.warn("Export stopped.");
  };

  const getCards = () => {
    const cards = document.querySelectorAll(".scheduler-view-card");
    if (exportMode === "SPECIFIC" && selectedDate !== "") {
      return Array.from(cards).filter((card) =>
        card.textContent?.includes(selectedDate)
      );
    }
    return Array.from(cards);
  };

  const cleanupExportMode = () => {
    document.querySelectorAll(".scheduler-view-card").forEach((card) => {
      card.classList.remove("export-mode");
    });
  };

  const exportToPDF = async () => {
    stopExport.current = false;
    const cards = getCards();

    if (cards.length === 0) return toast.error("No schedule found for the selected date.");

    setExporting(true);
    setProgress(0);
    toast.info("Generating PDF...");

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < cards.length; i++) {
        if (stopExport.current) return cleanupExportMode();

        const card = cards[i] as HTMLElement;
        card.classList.add("export-mode");
        await new Promise((r) => setTimeout(r, 60));
        const canvas = await html2canvas(card, { scale: 2 });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 5, 5, pageWidth - 10, pageHeight - 10);
        setProgress(Math.round(((i + 1) / cards.length) * 100));
      }

      pdf.save(`${collegeName}_Schedule.pdf`);
      toast.success("PDF exported successfully!");
      onClose();
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      cleanupExportMode();
      setExporting(false);
    }
  };

  const exportToWord = async () => {
    stopExport.current = false;
    const cards = getCards();
    if (cards.length === 0) return toast.error("No schedule found for the selected date.");

    setExporting(true);
    setProgress(0);
    toast.info("Generating Word document...");

    try {
      const sections: any[] = [];
      for (let i = 0; i < cards.length; i++) {
        if (stopExport.current) return;

        const tables = cards[i].querySelectorAll("table.exam-table");
        tables.forEach((table) => {
          const rows: TableRow[] = [];
          const tr = table.querySelectorAll("tr");

          tr.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("th, td")).map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      text: cell.textContent?.trim() || "",
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                  },
                  width: { size: 100, type: WidthType.PERCENTAGE },
                })
            );
            rows.push(new TableRow({ children: cells }));
          });

          sections.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        });

        setProgress(Math.round(((i + 1) / cards.length) * 100));
        await new Promise((r) => setTimeout(r, 60));
      }

      const doc = new Document({ sections: [{ children: sections }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${collegeName}_Schedule.docx`);
      toast.success("Word exported successfully!");
      onClose();
    } catch {
      toast.error("Failed to export Word");
    } finally {
      cleanupExportMode();
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    stopExport.current = false;
    const cards = getCards();
    if (cards.length === 0) return toast.error("No schedule found for the selected date.");

    setExporting(true);
    setProgress(0);
    toast.info("Generating Excel file...");

    try {
      const workbook = XLSX.utils.book_new();

      for (let i = 0; i < cards.length; i++) {
        if (stopExport.current) return;

        const tables = cards[i].querySelectorAll("table.exam-table");
        const allData: string[][] = [];

        tables.forEach((table) => {
          table.querySelectorAll("tr").forEach((row) => {
            const cells = row.querySelectorAll("td, th");
            allData.push(Array.from(cells).map((c) => c.textContent?.trim() || ""));
          });
        });

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(allData), `Page_${i + 1}`);
        setProgress(Math.round(((i + 1) / cards.length) * 100));
      }

      XLSX.writeFile(workbook, `${collegeName}_Schedule.xlsx`);
      toast.success("Excel exported successfully!");
      onClose();
    } catch {
      toast.error("Failed to export Excel");
    } finally {
      cleanupExportMode();
      setExporting(false);
    }
  };

  return (
    <div className="export-container">
      <h2 className="export-title">Export Schedule</h2>

      <div className="export-options">
        <label className="radio">
          <input
            type="radio"
            value="ALL"
            checked={exportMode === "ALL"}
            onChange={() => setExportMode("ALL")}
          />
          <span>All Dates</span>
        </label>

        <label className="radio">
          <input
            type="radio"
            value="SPECIFIC"
            checked={exportMode === "SPECIFIC"}
            onChange={() => setExportMode("SPECIFIC")}
          />
          <span>Specific Date</span>
        </label>
      </div>

      {exportMode === "SPECIFIC" && (
        <select
          className="date-select"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          <option value="">Select a Date</option>
          {availableDates.map((date, i) => (
            <option key={i} value={date}>
              {date}
            </option>
          ))}
        </select>
      )}

      {exporting && (
        <div className="progress-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            <div className="progress-content">
              <span>{progress}%</span>
              <button className="btn stop-inside" onClick={handleStop}>
                <FaRegStopCircle />
                <span className="stop-text"></span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="export-buttons">
        <button className="btn pdf" disabled={exporting} onClick={exportToPDF}>
          Export to PDF
        </button>
        <button className="btn word" disabled={exporting} onClick={exportToWord}>
          Export to Word
        </button>
        <button className="btn excel" disabled={exporting} onClick={exportToExcel}>
          Export to Excel
        </button>
      </div>
    </div>
  );
};

export default ExportSchedule;