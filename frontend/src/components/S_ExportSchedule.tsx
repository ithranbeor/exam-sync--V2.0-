import React, { useState, useRef, useEffect } from "react";
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
        
        previews.push({
          date: dateText,
          preview,
          selected: true
        });
        
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

  const selectAllPages = () => {
    setPagePreviews(prev => prev.map(p => ({ ...p, selected: true })));
  };

  const deselectAllPages = () => {
    setPagePreviews(prev => prev.map(p => ({ ...p, selected: false })));
  };

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

    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2;

    pdf.text("APPROVED", centerX, centerY, {
      align: "center",
      angle: -45,
      baseline: "middle"
    });

    pdf.restoreGraphicsState();
  };

  const exportToPDF = async () => {
    const cardsToExport = getCards();
    
    if (cardsToExport.length === 0) {
      return toast.error("No pages selected for export.");
    }

    stopExport.current = false;
    setExporting(true);
    setProgress(0);

    if (approvalStatus === 'approved') {
      toast.info("Generating PDF with APPROVED watermark...");
    } else {
      toast.info("Generating PDF...");
    }

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

        if (approvalStatus === 'approved') {
          addWatermark(pdf, pageWidth, pageHeight);
        }

        setProgress(Math.round(((i + 1) / cardsToExport.length) * 100));
      }

      const filename = approvalStatus === 'approved'
        ? `${collegeName}_Schedule_APPROVED.pdf`
        : `${collegeName}_Schedule.pdf`;

      pdf.save(filename);

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

  return (
    <div className="export-container">
      <h2 className="export-title">Export Schedule</h2>

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
          ✓ This schedule is APPROVED
          <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
            Exports will include "APPROVED" watermark
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {loadingPreviews ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'black' }}>
            <p>Loading page previews...</p>
          </div>
        ) : pagePreviews.length > 0 ? (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '15px',
              padding: '10px',
              background: '#f5f5f5',
              borderRadius: '8px'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                Page Previews ({pagePreviews.filter(p => p.selected).length} of {pagePreviews.length} selected)
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={selectAllPages}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllPages}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '15px',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '10px',
              background: '#fafafa',
              borderRadius: '8px'
            }}>
              {pagePreviews.map((page, index) => (
                <div
                  key={index}
                  onClick={() => togglePageSelection(index)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    border: page.selected ? '3px solid #4CAF50' : '3px solid #ddd',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    boxShadow: page.selected ? '0 4px 8px rgba(76, 175, 80, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ position: 'relative', flexGrow: 1 }}>
                    <img
                      src={page.preview}
                      alt={`Page ${index + 1}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        opacity: page.selected ? 1 : 0.5
                      }}
                    />
                    {page.selected && (
                      <div style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: '#4CAF50',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        zIndex: 2
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: '8px',
                    background: page.selected ? '#4CAF50' : '#666',
                    color: 'white',
                    fontSize: '11px',
                    textAlign: 'center',
                    fontWeight: page.selected ? 'bold' : 'normal',
                    minHeight: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    Page {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

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
      </div>
    </div>
  );
};

export default ExportSchedule;