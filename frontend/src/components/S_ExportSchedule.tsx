import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FaRegStopCircle, FaFilePdf, FaCheckCircle, FaSync } from "react-icons/fa";

interface ExportScheduleProps {
  onClose: () => void;
  collegeName: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
}

/* ─── inline styles (no external CSS needed) ─────────────────────────────── */
const S = {
  container: {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: "0 4px",
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 16,
    userSelect: "none" as const,
  },

  approvedBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    background: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
    border: "1px solid #34d399",
    color: "#065f46",
    fontSize: 13,
    fontWeight: 600,
  },

  sectionHeader: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#092C4C",
    margin: 0,
  },

  badge: (selected: number, total: number) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 9px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    background: selected === total ? "#d1fae5" : "#e0f2fe",
    color:      selected === total ? "#065f46" : "#075985",
    marginLeft: 8,
  }),

  btnRow: {
    display: "flex" as const,
    gap: 6,
  },

  smallBtn: (variant: "green" | "red") => ({
    padding: "5px 13px",
    borderRadius: 6,
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    background: variant === "green" ? "#059669" : "#dc2626",
    color: "#fff",
    transition: "opacity .15s",
  }),

  /* grid: 5 columns fixed */
  grid: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 10,
  },

  thumb: (selected: boolean, active: boolean) => ({
    position:      "relative" as const,
    borderRadius:  10,
    overflow:      "hidden" as const,
    cursor:        "pointer",
    border:        selected ? "2.5px solid #092C4C" : "2px solid #e2e8f0",
    boxShadow:     selected
      ? "0 4px 14px rgba(9,44,76,.25)"
      : "0 1px 4px rgba(0,0,0,.08)",
    transform:     active ? "scale(.97)" : "scale(1)",
    transition:    "all .15s ease",
    background:    "#f8fafc",
    aspectRatio:   "3/4",             // portrait A4 proportion
    display:       "flex" as const,
    flexDirection: "column" as const,
  }),

  thumbImg: {
    width:      "100%",
    flex:       1,
    objectFit: "cover" as const,
    objectPosition: "top",
    display:    "block",
  },

  thumbNoPreview: {
    flex:            1,
    display:         "flex" as const,
    alignItems:      "center" as const,
    justifyContent:  "center" as const,
    fontSize:        11,
    color:           "#94a3b8",
    background:      "#f1f5f9",
  },

  thumbFooter: (selected: boolean) => ({
    padding:         "6px 8px",
    background:      selected ? "#092C4C" : "#f1f5f9",
    color:           selected ? "#fff"    : "#64748b",
    fontSize:        11,
    fontWeight:      600,
    textAlign:       "center" as const,
    whiteSpace:      "nowrap" as const,
    overflow:        "hidden" as const,
    textOverflow:    "ellipsis" as const,
    transition:      "background .15s, color .15s",
  }),

  checkBadge: {
    position:    "absolute" as const,
    top:         6,
    right:       6,
    width:       22,
    height:      22,
    borderRadius:"50%",
    background:  "#092C4C",
    color:       "#fff",
    display:     "flex" as const,
    alignItems:  "center" as const,
    justifyContent: "center" as const,
    fontSize:    13,
    fontWeight:  900,
    boxShadow:   "0 2px 6px rgba(0,0,0,.3)",
  },

  pageNum: (selected: boolean) => ({
    position:   "absolute" as const,
    top:        6,
    left:       7,
    fontSize:   10,
    fontWeight: 700,
    color:      selected ? "#fff" : "#475569",
    background: selected ? "rgba(9,44,76,.75)" : "rgba(255,255,255,.85)",
    borderRadius: 4,
    padding:    "1px 5px",
  }),

  loadingBox: {
    display:        "flex" as const,
    flexDirection:  "column" as const,
    alignItems:     "center" as const,
    gap:            12,
    padding:        "32px 0",
    color:          "#64748b",
    fontSize:       13,
  },

  spinner: {
    width:          28,
    height:         28,
    border:         "3px solid #e2e8f0",
    borderTopColor: "#092C4C",
    borderRadius:   "50%",
    animation:      "sv-spin .7s linear infinite",
  },

  progressWrap: {
    display:       "flex" as const,
    flexDirection: "column" as const,
    gap:           6,
  },

  progressLabel: {
    fontSize:   12,
    color:      "#475569",
    fontWeight: 500,
  },

  progressTrack: {
    position:     "relative" as const,
    height:       28,
    borderRadius: 8,
    background:   "#e2e8f0",
    overflow:     "hidden" as const,
  },

  progressFill: (pct: number) => ({
    position:   "absolute" as const,
    inset:      0,
    width:      `${pct}%`,
    background: "linear-gradient(90deg,#0f4c8a,#092C4C)",
    borderRadius: 8,
    transition: "width .3s ease",
  }),

  progressText: {
    position:   "absolute" as const,
    inset:      0,
    display:    "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding:    "0 10px",
    fontSize:   12,
    fontWeight: 700,
    color:      "#fff",
  },

  stopBtn: {
    background:   "rgba(255,255,255,.2)",
    border:       "1px solid rgba(255,255,255,.4)",
    borderRadius: 5,
    color:        "#fff",
    cursor:       "pointer",
    display:      "flex" as const,
    alignItems:   "center" as const,
    gap:          4,
    padding:      "2px 8px",
    fontSize:     11,
    fontWeight:   700,
  },

  exportBtn: (disabled: boolean) => ({
    display:        "flex" as const,
    alignItems:     "center" as const,
    justifyContent: "center" as const,
    gap:            8,
    padding:        "13px 0",
    borderRadius:   10,
    border:         "none",
    background:     disabled
      ? "#cbd5e1"
      : "linear-gradient(135deg,#092C4C,#0f4c8a)",
    color:          disabled ? "#94a3b8" : "#fff",
    fontSize:       14,
    fontWeight:     700,
    cursor:         disabled ? "not-allowed" : "pointer",
    transition:     "opacity .2s",
    boxShadow:      disabled ? "none" : "0 4px 14px rgba(9,44,76,.35)",
    width:          "100%",
  }),
};

/* ─── component ──────────────────────────────────────────────────────────── */
const ExportSchedule: React.FC<ExportScheduleProps> = ({
  onClose,
  collegeName,
  approvalStatus,
}) => {
  const [exporting,     setExporting]     = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [pagePreviews,  setPagePreviews]  = useState<{
    date: string; preview: string; selected: boolean;
  }[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [activeThumb,     setActiveThumb]     = useState<number | null>(null);

  const stopExport = useRef(false);

  /* delay so the slide-in animation finishes before DOM queries */
  useEffect(() => {
    const t = setTimeout(generatePreviews, 380);
    return () => clearTimeout(t);
  }, []);

  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  /* clone a card to document.body off-screen — escapes every clipping ctx */
  const cloneToBody = (card: HTMLElement) => {
    const clone = card.cloneNode(true) as HTMLElement;
    clone.style.cssText = `
      position: fixed !important;
      top: -99999px !important;
      left: 0 !important;
      width: ${card.scrollWidth}px !important;
      height: ${card.scrollHeight}px !important;
      transform: none !important;
      overflow: visible !important;
      z-index: -1 !important;
      opacity: 1 !important;
      pointer-events: none !important;
      background: #f9f9f9 !important;
    `;
    document.body.appendChild(clone);
    return {
      clone,
      cleanup: () => { try { document.body.removeChild(clone); } catch {} },
    };
  };

  const captureEl = (el: HTMLElement, scale: number) =>
    html2canvas(el, {
      scale,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: "#ffffff",
      logging:         false,
      width:           el.scrollWidth,
      height:          el.scrollHeight,
      windowWidth:     el.scrollWidth,
      windowHeight:    el.scrollHeight,
    });

  /* ── preview generation ── */
  const generatePreviews = async () => {
    setLoadingPreviews(true);
    setPagePreviews([]);
    await wait(150);

    const cards = Array.from(
      document.querySelectorAll(".scheduler-view-card")
    ) as HTMLElement[];

    const previews: typeof pagePreviews = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const dateText =
        card.textContent?.match(/\b[A-Za-z]+\s\d{1,2},\s\d{4}/)?.[0] ||
        `Page ${i + 1}`;

      const { clone, cleanup } = cloneToBody(card);
      await wait(50);

      try {
        const canvas = await captureEl(clone, 0.22);
        previews.push({
          date:     dateText,
          preview:  canvas.toDataURL("image/jpeg", 0.55),
          selected: true,
        });
      } catch {
        previews.push({ date: dateText, preview: "", selected: true });
      } finally {
        cleanup();
      }
    }

    setPagePreviews(previews);
    setLoadingPreviews(false);
  };

  /* ── selection ── */
  const toggle = (idx: number) =>
    setPagePreviews(p => p.map((x, i) => i === idx ? { ...x, selected: !x.selected } : x));
  const selectAll   = () => setPagePreviews(p => p.map(x => ({ ...x, selected: true  })));
  const deselectAll = () => setPagePreviews(p => p.map(x => ({ ...x, selected: false })));

  /* ── watermark ── */
  const addWatermark = (pdf: jsPDF, pw: number, ph: number) => {
    pdf.saveGraphicsState();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(90);
    pdf.setTextColor(180, 180, 180);
    (pdf as any).setGState?.({ opacity: 0.18 });
    pdf.text("APPROVED", pw / 2, ph / 2, { align: "center", angle: -45, baseline: "middle" });
    pdf.restoreGraphicsState();
  };

  /* ── export ── */
  const exportToPDF = async () => {
    const allCards = Array.from(
      document.querySelectorAll(".scheduler-view-card")
    ) as HTMLElement[];

    const indices = pagePreviews
      .map((p, i) => (p.selected ? i : -1))
      .filter(i => i !== -1);

    const cardsToExport =
      indices.length > 0 ? indices.map(i => allCards[i]).filter(Boolean) : allCards;

    if (!cardsToExport.length)
      return toast.error("No pages selected.");

    stopExport.current = false;
    setExporting(true);
    setProgress(0);
    setProgressLabel("Preparing…");
    toast.info(`Generating PDF — ${cardsToExport.length} page(s)…`);

    /* landscape A4 gives more horizontal room for the schedule table */
    const PAGE_W = 297, PAGE_H = 210, M = 5;
    const C_W = PAGE_W - M * 2, C_H = PAGE_H - M * 2;

    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

      for (let i = 0; i < cardsToExport.length; i++) {
        if (stopExport.current) break;
        setProgressLabel(`Rendering page ${i + 1} of ${cardsToExport.length}…`);

        const { clone, cleanup } = cloneToBody(cardsToExport[i]);
        await wait(80);

        let canvas!: HTMLCanvasElement;
        try   { canvas = await captureEl(clone, 3); }
        finally { cleanup(); }

        const ratio  = canvas.width / canvas.height;
        let drawW = C_W, drawH = C_W / ratio;
        if (drawH > C_H) { drawH = C_H; drawW = C_H * ratio; }

        const offX = M + (C_W - drawW) / 2;
        const offY = M + (C_H - drawH) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", offX, offY, drawW, drawH);
        if (approvalStatus === "approved") addWatermark(pdf, PAGE_W, PAGE_H);

        setProgress(Math.round(((i + 1) / cardsToExport.length) * 100));
      }

      if (!stopExport.current) {
        const safe = collegeName.replace(/[^a-zA-Z0-9_-]/g, "_");
        pdf.save(approvalStatus === "approved"
          ? `${safe}_Schedule_APPROVED.pdf`
          : `${safe}_Schedule.pdf`);
        toast.success(`Exported ${cardsToExport.length} page(s)!`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Export failed — see console.");
    } finally {
      setExporting(false);
      setProgressLabel("");
    }
  };

  const selectedCount = pagePreviews.filter(p => p.selected).length;
  const isDisabled    = exporting || (pagePreviews.length > 0 && selectedCount === 0);

  /* ── render ── */
  return (
    <div style={S.container}>

      {/* keyframes */}
      <style>{`
        @keyframes sv-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* approved banner */}
      {approvalStatus === "approved" && (
        <div style={S.approvedBanner}>
          <FaCheckCircle style={{ fontSize: 16, flexShrink: 0 }} />
          Schedule is APPROVED — PDF will include a watermark
        </div>
      )}

      {/* header row */}
      <div style={S.sectionHeader}>
        <p style={S.sectionTitle}>
          Page Previews
          {pagePreviews.length > 0 && (
            <span style={S.badge(selectedCount, pagePreviews.length)}>
              {selectedCount} / {pagePreviews.length} selected
            </span>
          )}
        </p>
        <div style={S.btnRow}>
          {!loadingPreviews && (
            <button
              type="button"
              title="Reload previews"
              style={{ ...S.smallBtn("green"), background: "#0f4c8a", display: "flex", alignItems: "center", gap: 4 }}
              onClick={generatePreviews}
            >
              <FaSync style={{ fontSize: 10 }} /> Reload
            </button>
          )}
          <button type="button" style={S.smallBtn("green")}  onClick={selectAll}>Select All</button>
          <button type="button" style={S.smallBtn("red")}    onClick={deselectAll}>Deselect All</button>
        </div>
      </div>

      {/* preview area */}
      {loadingPreviews ? (
        <div style={S.loadingBox}>
          <div style={S.spinner} />
          Scanning all schedule pages… please wait
        </div>
      ) : pagePreviews.length > 0 ? (
        <div style={S.grid}>
          {pagePreviews.map((page, i) => (
            <div
              key={i}
              style={S.thumb(page.selected, activeThumb === i)}
              onClick={() => toggle(i)}
              onMouseDown={() => setActiveThumb(i)}
              onMouseUp={() => setActiveThumb(null)}
              onMouseLeave={() => setActiveThumb(null)}
            >
              {/* page number badge */}
              <div style={S.pageNum(page.selected)}>P{i + 1}</div>

              {/* check badge */}
              {page.selected && (
                <div style={S.checkBadge}>✓</div>
              )}

              {/* thumbnail image */}
              {page.preview ? (
                <img src={page.preview} alt={`Page ${i + 1}`} style={S.thumbImg} />
              ) : (
                <div style={S.thumbNoPreview}>No preview</div>
              )}

              {/* footer label */}
              <div style={S.thumbFooter(page.selected)}>
                {page.date && page.date !== `Page ${i + 1}`
                  ? page.date
                  : `Page ${i + 1}`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={S.loadingBox}>
          No schedule pages found.
        </div>
      )}

      {/* progress bar */}
      {exporting && (
        <div style={S.progressWrap}>
          <span style={S.progressLabel}>{progressLabel}</span>
          <div style={S.progressTrack}>
            <div style={S.progressFill(progress)} />
            <div style={S.progressText}>
              <span>{progress}%</span>
              <button
                style={S.stopBtn}
                onClick={() => { stopExport.current = true; setExporting(false); toast.warn("Stopped."); }}
              >
                <FaRegStopCircle /> Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* export button */}
      <button style={S.exportBtn(isDisabled)} disabled={isDisabled} onClick={exportToPDF}>
        <FaFilePdf style={{ fontSize: 16 }} />
        {exporting
          ? `Exporting… ${progress}%`
          : `Export ${selectedCount > 0 ? selectedCount : "All"} Page(s) to PDF`}
        {approvalStatus === "approved" && !exporting && (
          <span style={{ fontSize: 11, opacity: .75, fontWeight: 400 }}>(with watermark)</span>
        )}
      </button>

    </div>
  );
};

export default ExportSchedule;