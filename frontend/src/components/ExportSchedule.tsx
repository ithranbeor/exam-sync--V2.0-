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

// ✅ NEW: Add approvalStatus prop
interface ExportScheduleProps {
  onClose: () => void;
  collegeName: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
}

const ExportSchedule: React.FC<ExportScheduleProps> = ({ 
  onClose, 
  collegeName, 
  approvalStatus
}) => {
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
    setAvailableDates([...new Set(dates)]);
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

  // ✅ FIXED: Function to add watermark to PDF with proper typing
  const addWatermark = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
    // Save current graphics state
    pdf.saveGraphicsState();
    
    // Set watermark properties
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(80);
    pdf.setTextColor(200, 200, 200); // Light gray color
    
    // ✅ FIX: Use proper setGState method - jsPDF accepts plain object
    (pdf as any).setGState({ opacity: 0.2 }); // 20% opacity
    
    // Calculate center position
    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2;
    
    // Add rotated text at center - angle parameter handles rotation
    pdf.text("APPROVED", centerX, centerY, {
      align: "center",
      angle: -45, // Diagonal angle
      baseline: "middle"
    });
    
    // Restore graphics state
    pdf.restoreGraphicsState();
  };

  const exportToPDF = async () => {
    stopExport.current = false;
    const cards = getCards();

    if (cards.length === 0) return toast.error("No schedule found for the selected date.");

    setExporting(true);
    setProgress(0);
    
    // ✅ Show watermark info if approved
    if (approvalStatus === 'approved') {
      toast.info("Generating PDF with APPROVED watermark...");
    } else {
      toast.info("Generating PDF...");
    }

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
        
        // ✅ Add watermark if approved
        if (approvalStatus === 'approved') {
          addWatermark(pdf, pageWidth, pageHeight);
        }
        
        setProgress(Math.round(((i + 1) / cards.length) * 100));
      }

      // ✅ Include approval status in filename
      const filename = approvalStatus === 'approved' 
        ? `${collegeName}_Schedule_APPROVED.pdf`
        : `${collegeName}_Schedule.pdf`;
      
      pdf.save(filename);
      
      // ✅ Success message mentions watermark if approved
      if (approvalStatus === 'approved') {
        toast.success("PDF exported successfully with APPROVED watermark!");
      } else {
        toast.success("PDF exported successfully!");
      }
      
      onClose();
    } catch (error) {
      console.error("PDF export error:", error);
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
      
      // ✅ Add watermark paragraph at the beginning if approved
      if (approvalStatus === 'approved') {
        sections.push(
          new Paragraph({
            text: "🔒 APPROVED SCHEDULE",
            alignment: AlignmentType.CENTER,
            heading: "Heading1",
            spacing: {
              after: 400,
            },
          })
        );
      }
      
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
      
      // ✅ Include approval status in filename
      const filename = approvalStatus === 'approved'
        ? `${collegeName}_Schedule_APPROVED.docx`
        : `${collegeName}_Schedule.docx`;
      
      saveAs(blob, filename);
      
      // ✅ Success message mentions approval if approved
      if (approvalStatus === 'approved') {
        toast.success("Word exported successfully with APPROVED status!");
      } else {
        toast.success("Word exported successfully!");
      }
      
      onClose();
    } catch (error) {
      console.error("Word export error:", error);
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
        
        // ✅ Add approval status header if approved
        if (approvalStatus === 'approved' && i === 0) {
          allData.push(["🔒 APPROVED SCHEDULE"]);
          allData.push([]); // Empty row for spacing
        }

        tables.forEach((table) => {
          table.querySelectorAll("tr").forEach((row) => {
            const cells = row.querySelectorAll("td, th");
            allData.push(Array.from(cells).map((c) => c.textContent?.trim() || ""));
          });
        });

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(allData), `Page_${i + 1}`);
        setProgress(Math.round(((i + 1) / cards.length) * 100));
      }

      // ✅ Include approval status in filename
      const filename = approvalStatus === 'approved'
        ? `${collegeName}_Schedule_APPROVED.xlsx`
        : `${collegeName}_Schedule.xlsx`;
      
      XLSX.writeFile(workbook, filename);
      
      // ✅ Success message mentions approval if approved
      if (approvalStatus === 'approved') {
        toast.success("Excel exported successfully with APPROVED status!");
      } else {
        toast.success("Excel exported successfully!");
      }
      
      onClose();
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel");
    } finally {
      cleanupExportMode();
      setExporting(false);
    }
  };

  return (
    <div className="export-container">
      <h2 className="export-title">Export Schedule</h2>
      
      {/* ✅ Show approval status indicator */}
      {approvalStatus === 'approved' && (
        <div style={{
          background: '#4CAF50',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          marginBottom: '15px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          ✅ This schedule is APPROVED
          <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
            Exports will include "APPROVED" watermark
          </div>
        </div>
      )}

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
          {approvalStatus === 'approved' && <span style={{ fontSize: '10px', display: 'block' }}>(with watermark)</span>}
        </button>
        <button className="btn word" disabled={exporting} onClick={exportToWord}>
          Export to Word
          {approvalStatus === 'approved' && <span style={{ fontSize: '10px', display: 'block' }}>(with status)</span>}
        </button>
        <button className="btn excel" disabled={exporting} onClick={exportToExcel}>
          Export to Excel
          {approvalStatus === 'approved' && <span style={{ fontSize: '10px', display: 'block' }}>(with status)</span>}
        </button>
      </div>
    </div>
  );
};

export default ExportSchedule;