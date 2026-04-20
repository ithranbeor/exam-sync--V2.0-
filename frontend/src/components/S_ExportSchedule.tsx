import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "../styles/S_ExportSchedule.css";
import { FaRegStopCircle } from "react-icons/fa";

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
  const [pagePreviews, setPagePreviews] = useState<{ date: string; preview: string; selected: boolean }[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  const stopExport = useRef(false);

  useEffect(() => {
    generatePreviews();
  }, []);

  const generatePreviews = async () => {
    setLoadingPreviews(true);
    const cards = Array.from(document.querySelectorAll(".scheduler-view-card"));
    const previews: { date: string; preview: string; selected: boolean }[] = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLElement;
      const dateText = card.textContent?.match(/\b[A-Za-z]+\s\d{1,2},\s\d{4}/)?.[0] || `Page ${i + 1}`;

      try {
        card.classList.add("export-mode");
        await new Promise((r) => setTimeout(r, 100));
        const canvas = await html2canvas(card, { scale: 0.3 });
        const preview = canvas.toDataURL("image/jpeg", 0.7);
        previews.push({ date: dateText, preview, selected: true });
        card.classList.remove("export-mode");
      } catch (error) {
        console.error("Preview generation error:", error);
      }
    }

    setPagePreviews(previews);
    setLoadingPreviews(false);
  };

  const togglePageSelection = (index: number) => {
    setPagePreviews(prev =>
      prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p)
    );
  };

  const selectAllPages = () => setPagePreviews(prev => prev.map(p => ({ ...p, selected: true })));
  const deselectAllPages = () => setPagePreviews(prev => prev.map(p => ({ ...p, selected: false })));

  const handleStop = () => {
    stopExport.current = true;
    cleanupExportMode();
    setExporting(false);
    toast.warn("Export stopped.");
  };

  const getCards = () => {
    const cards = Array.from(document.querySelectorAll(".scheduler-view-card"));
    if (pagePreviews.length > 0) {
      return cards.filter((_, index) => pagePreviews[index]?.selected);
    }
    return cards;
  };

  const cleanupExportMode = () => {
    document.querySelectorAll(".scheduler-view-card").forEach((card) => {
      card.classList.remove("export-mode");
    });
  };

  const addWatermark = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
    pdf.saveGraphicsState();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(80);
    pdf.setTextColor(200, 200, 200);
    (pdf as any).setGState({ opacity: 0.2 });
    pdf.text("APPROVED", pageWidth / 2, pageHeight / 2, {
      align: "center",
      angle: -45,
      baseline: "middle"
    });
    pdf.restoreGraphicsState();
  };

  const exportToPDF = async () => {
    const cardsToExport = getCards();
    if (cardsToExport.length === 0) return toast.error("No pages selected for export.");

    stopExport.current = false;
    setExporting(true);
    setProgress(0);

    toast.info(approvalStatus === 'approved'
      ? "Generating PDF with APPROVED watermark..."
      : "Generating PDF...");

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < cardsToExport.length; i++) {
        if (stopExport.current) return cleanupExportMode();

        const card = cardsToExport[i] as HTMLElement;
        card.classList.add("export-mode");
        await new Promise((r) => setTimeout(r, 60));
        const canvas = await html2canvas(card, { scale: 2 });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 5, 5, pageWidth - 10, pageHeight - 10);
        if (approvalStatus === 'approved') addWatermark(pdf, pageWidth, pageHeight);

        setProgress(Math.round(((i + 1) / cardsToExport.length) * 100));
      }

      const filename = approvalStatus === 'approved'
        ? `${collegeName}_Schedule_APPROVED.pdf`
        : `${collegeName}_Schedule.pdf`;

      pdf.save(filename);
      toast.success(approvalStatus === 'approved'
        ? "PDF exported with APPROVED watermark!"
        : "PDF exported successfully!");
      onClose();
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      cleanupExportMode();
      setExporting(false);
    }
  };

  return (
    <div className="export-container">
      <h2 className="export-title">Export Schedule</h2>

      {/* Approved banner */}
      {approvalStatus === 'approved' && (
        <div className="export-approved-banner">
          <span>✓ Schedule is APPROVED</span>
          <span>Exports will include an "APPROVED" watermark</span>
        </div>
      )}

      {/* Page previews */}
      {loadingPreviews ? (
        <div className="export-loading">Loading page previews…</div>
      ) : pagePreviews.length > 0 && (
        <>
          <div className="export-preview-header">
            <h3>
              Page Previews&nbsp;
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                ({pagePreviews.filter(p => p.selected).length} / {pagePreviews.length} selected)
              </span>
            </h3>
            <div className="export-preview-actions">
              <button type="button" className="export-btn-sm success" onClick={selectAllPages}>
                Select All
              </button>
              <button type="button" className="export-btn-sm danger" onClick={deselectAllPages}>
                Deselect All
              </button>
            </div>
          </div>

          <div className="export-page-grid">
            {pagePreviews.map((page, index) => (
              <div
                key={index}
                className={`export-page-thumb ${page.selected ? 'selected' : ''}`}
                onClick={() => togglePageSelection(index)}
              >
                <img src={page.preview} alt={`Page ${index + 1}`} />
                {page.selected && (
                  <div className="export-check-badge">✓</div>
                )}
                <div className="export-page-label">Page {index + 1}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Progress */}
      {exporting && (
        <div className="progress-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-content">
              <span>{progress}%</span>
              <button className="btn stop-inside" onClick={handleStop}>
                <FaRegStopCircle />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <div className="export-buttons">
        <button className="btn pdf" disabled={exporting} onClick={exportToPDF}>
          Export to PDF
          {approvalStatus === 'approved' && (
            <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>
              &nbsp;(with watermark)
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default ExportSchedule;