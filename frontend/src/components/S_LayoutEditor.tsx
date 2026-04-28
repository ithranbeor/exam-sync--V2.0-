/// <reference types="react" />
import React, { useState, useCallback, useEffect } from "react";
import { api } from "../lib/apiClient.ts";
import { toast } from "react-toastify";

// ─── Types ────────────────────────────────────────────────────────────────────

type Align = "left" | "center" | "right";
type FontFamily =
  | "serif" | "sans-serif" | "Georgia" | "Times New Roman"
  | "Palatino Linotype" | "Garamond" | "Courier New"
  | "Arial" | "Verdana" | "Tahoma";

export interface ElementStyle {
  fontSize: number;
  fontFamily: FontFamily;
  color: string;
  bold: boolean;
  align: Align;
  visible: boolean;
  offsetX: number;
  offsetY: number;
}

export interface LogoConfig {
  urls: string[];
  position: "left" | "center" | "right";
  size: number;
  gap: number;
}

export interface LayoutConfig {
  universityName: ElementStyle;
  campuses: ElementStyle;
  collegeName: ElementStyle;
  examTitle: ElementStyle;
  examPeriod: ElementStyle;
  logo: LogoConfig;
  tableDateHeader: ElementStyle;
  tableBuildingHeader: ElementStyle;
  tableRoomHeader: ElementStyle;
  tableTimeColumn: ElementStyle;
  tableCourseName: ElementStyle;
  tableSectionName: ElementStyle;
  tableInstructor: ElementStyle;
  tableProctor: ElementStyle;
  footerPreparedBy: ElementStyle;
  footerApprovedBy: ElementStyle;
  footerAddress: ElementStyle;
  footerContact: ElementStyle;
}

interface Props {
  collegeName: string;
  collegeId: string;
  examData?: { termName: string; semesterName: string; yearName: string; examPeriodName: string };
  footerData?: {
    prepared_by_name: string; prepared_by_title: string;
    approved_by_name: string; approved_by_title: string;
    address_line: string; contact_line: string; logo_urls?: string[];
  } | null;
  onSave?: () => void;
  onClose?: () => void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const ds = (size: number, bold = false, align: Align = "center", color = "#333333", family: FontFamily = "serif"): ElementStyle =>
  ({ fontSize: size, fontFamily: family, color, bold, align, visible: true, offsetX: 0, offsetY: 0 });

const defaultConfig = (): LayoutConfig => ({
  universityName:      ds(30, false, "center", "#333333", "serif"),
  campuses:            ds(15, false, "center", "#555555", "serif"),
  collegeName:         ds(30, false, "center", "#333333", "serif"),
  examTitle:           ds(20, true,  "center", "#333333", "serif"),
  examPeriod:          ds(20, false, "center", "#333333", "serif"),
  logo: { urls: [], position: "center", size: 130, gap: 16 },
  tableDateHeader:     ds(13, true,  "center", "#ffffff", "serif"),
  tableBuildingHeader: ds(12, true,  "center", "#ffffff", "serif"),
  tableRoomHeader:     ds(12, true,  "center", "#ffffff", "serif"),
  tableTimeColumn:     ds(11, false, "center", "#333333", "serif"),
  tableCourseName:     ds(11, true,  "left",   "#ffffff", "sans-serif"),
  tableSectionName:    ds(11, false, "left",   "#ffffff", "sans-serif"),
  tableInstructor:     ds(11, false, "left",   "#ffffff", "sans-serif"),
  tableProctor:        ds(11, false, "left",   "#ffffff", "sans-serif"),
  footerPreparedBy:    ds(14, false, "left",   "#000000", "serif"),
  footerApprovedBy:    ds(14, false, "left",   "#000000", "serif"),
  footerAddress:       ds(15, false, "center", "#000000", "serif"),
  footerContact:       ds(15, false, "center", "#000000", "serif"),
});

const storageKey = (id: string) => `layout_config_${id}`;

const FONT_OPTIONS: { label: string; value: FontFamily }[] = [
  { label: "Serif (default)", value: "serif" },
  { label: "Sans-serif", value: "sans-serif" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Palatino", value: "Palatino Linotype" },
  { label: "Garamond", value: "Garamond" },
  { label: "Courier New", value: "Courier New" },
  { label: "Arial", value: "Arial" },
  { label: "Verdana", value: "Verdana" },
  { label: "Tahoma", value: "Tahoma" },
];

const COLOR_PRESETS = [
  "#000000", "#1a1a1a", "#333333", "#555555", "#777777",
  "#ffffff", "#f5f5f5", "#e0e0e0",
  "#092C4C", "#1E3A5F", "#0D6EFD", "#198754", "#DC3545",
  "#6610F2", "#FD7E14", "#0DCAF0", "#B45309", "#6C757D",
];

type ElementKey = keyof Omit<LayoutConfig, "logo">;
type Section = "header" | "table" | "footer";

const ELEMENTS: { key: ElementKey; label: string; section: Section }[] = [
  { key: "universityName",      label: "University Name",      section: "header" },
  { key: "campuses",            label: "Campus Locations",     section: "header" },
  { key: "collegeName",         label: "College Name",         section: "header" },
  { key: "examTitle",           label: "Exam Title Line",      section: "header" },
  { key: "examPeriod",          label: "Exam Period",          section: "header" },
  { key: "tableDateHeader",     label: "Date Header Row",      section: "table"  },
  { key: "tableBuildingHeader", label: "Building Header Row",  section: "table"  },
  { key: "tableRoomHeader",     label: "Room Number Row",      section: "table"  },
  { key: "tableTimeColumn",     label: "Time Column",          section: "table"  },
  { key: "tableCourseName",     label: "Course Code (card)",   section: "table"  },
  { key: "tableSectionName",    label: "Section (card)",       section: "table"  },
  { key: "tableInstructor",     label: "Instructor (card)",    section: "table"  },
  { key: "tableProctor",        label: "Proctor (card)",       section: "table"  },
  { key: "footerPreparedBy",    label: "Prepared By",          section: "footer" },
  { key: "footerApprovedBy",    label: "Approved By",          section: "footer" },
  { key: "footerAddress",       label: "Address Line",         section: "footer" },
  { key: "footerContact",       label: "Contact Line",         section: "footer" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const ScheduleLayoutEditor: React.FC<Props> = ({ collegeName, collegeId, examData, footerData, onSave, onClose }) => {
  const [config, setConfig] = useState<LayoutConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey(collegeId));
      if (saved) return { ...defaultConfig(), ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return defaultConfig();
  });

  const [selectedKey, setSelectedKey] = useState<ElementKey | "logo">("universityName");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Section>("header");

  useEffect(() => {
    if (footerData?.logo_urls?.length) {
      setConfig(prev => ({ ...prev, logo: { ...prev.logo, urls: footerData!.logo_urls! } }));
    }
  }, [footerData]);

  const updateElement = useCallback((key: ElementKey, patch: Partial<ElementStyle>) => {
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  const updateLogo = useCallback((patch: Partial<LogoConfig>) => {
    setConfig(prev => ({ ...prev, logo: { ...prev.logo, ...patch } }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey(collegeId), JSON.stringify(config));
      window.dispatchEvent(new Event("layout-config-saved"));
      await api.patch(`/tbl_schedule_footer/by_college/${collegeId}/`, {
        layout_config: JSON.stringify(config),
      }).catch(() => {});
      toast.success("Layout saved!");
      onSave?.();
    } catch {
      toast.success("Layout saved locally!");
      onSave?.();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig());
    localStorage.removeItem(storageKey(collegeId));
    window.dispatchEvent(new Event("layout-config-saved"));
    toast.info("Layout reset to defaults.");
  };

  const sel = selectedKey === "logo" ? null : config[selectedKey as ElementKey];
  const isLogo = selectedKey === "logo";

  const logoJustify = config.logo.position === "left" ? "flex-start" : config.logo.position === "right" ? "flex-end" : "center";

  const es = (s: ElementStyle): React.CSSProperties => ({
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    color: s.color,
    fontWeight: s.bold ? "bold" : "normal",
    textAlign: s.align,
    marginBottom: s.offsetY,
    paddingLeft: s.align === "center" ? s.offsetX : undefined,
    marginLeft: s.align === "left" ? s.offsetX : undefined,
    display: s.visible ? undefined : "none",
  });

  const t = examData?.termName ?? "Midterm";
  const sem = examData?.semesterName ?? "1st";
  const yr = examData?.yearName ?? "2024-2025";
  const period = examData?.examPeriodName ?? "Examination Period";
  const logoUrls = config.logo.urls.length ? config.logo.urls : footerData?.logo_urls?.length ? footerData.logo_urls : ["/logo/USTPlogo.png"];
  const TABS: Section[] = ["header", "table", "footer"];

  return (
    <div style={{ display: "flex", height: "80vh", fontFamily: "sans-serif", fontSize: 13, overflow: "hidden" }}>

      {/* ── LEFT: element list ── */}
      <div style={{ width: 230, borderRight: "1px solid #ddd", display: "flex", flexDirection: "column", background: "#fafafa", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ display: "flex", borderBottom: "1px solid #ddd" }}>
          {TABS.map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
              fontWeight: activeTab === tab ? 700 : 400, fontSize: 11, textTransform: "capitalize",
              background: activeTab === tab ? "#092C4C" : "transparent",
              color: activeTab === tab ? "#fff" : "#555",
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
          {activeTab === "header" && (
            <Item label="Logo / Image" icon="🖼" active={selectedKey === "logo"} onClick={() => setSelectedKey("logo")} />
          )}
          {ELEMENTS.filter(e => e.section === activeTab).map(({ key, label }) => (
            <Item key={key} label={label} subtitle={`${config[key].fontSize}px`}
              active={selectedKey === key} dimmed={!config[key].visible}
              onClick={() => setSelectedKey(key)} />
          ))}
        </div>

        <div style={{ borderTop: "1px solid #ddd", padding: "10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            padding: "9px", borderRadius: 6, border: "none", cursor: saving ? "not-allowed" : "pointer",
            background: saving ? "#999" : "#092C4C", color: "#fff", fontWeight: 700, fontSize: 13,
          }}>{saving ? "Saving…" : "Save Layout"}</button>
          <button type="button" onClick={handleReset} style={{
            padding: "7px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer",
            background: "transparent", color: "#666", fontSize: 12,
          }}>Reset to Defaults</button>
          {onClose && (
            <button type="button" onClick={onClose} style={{
              padding: "7px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer",
              background: "transparent", color: "#333", fontSize: 12,
            }}>Close</button>
          )}
        </div>
      </div>

      {/* ── MIDDLE: controls ── */}
      <div style={{ width: 250, borderRight: "1px solid #ddd", overflowY: "auto", padding: "14px 12px", background: "#fff", flexShrink: 0 }}>
        {isLogo ? (
          <>
            <SL>Logo Position</SL>
            <Seg opts={[{ v: "left", l: "Left" }, { v: "center", l: "Center" }, { v: "right", l: "Right" }]}
              val={config.logo.position} onChange={v => updateLogo({ position: v as any })} />
            <SL>Logo Size</SL>
            <Sld min={40} max={240} step={4} val={config.logo.size} unit="px" onChange={v => updateLogo({ size: v })} />
            <SL>Gap Between Logos</SL>
            <Sld min={0} max={80} step={4} val={config.logo.gap} unit="px" onChange={v => updateLogo({ gap: v })} />
            <SL>Logo URLs</SL>
            {config.logo.urls.map((url, i) => (
              <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                <input type="text" value={url}
                  onChange={e => { const u = [...config.logo.urls]; u[i] = e.target.value; updateLogo({ urls: u }); }}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 11 }} placeholder="URL or /path" />
                <button type="button" onClick={() => updateLogo({ urls: config.logo.urls.filter((_, j) => j !== i) })}
                  style={{ padding: "5px 7px", borderRadius: 5, border: "1px solid #f88", background: "#fff8f8", color: "#c00", cursor: "pointer" }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => updateLogo({ urls: [...config.logo.urls, ""] })}
              style={{ marginTop: 4, padding: "6px 10px", borderRadius: 5, border: "1px solid #ddd", background: "#f5f5f5", cursor: "pointer", fontSize: 12, width: "100%" }}>
              + Add Logo URL
            </button>
          </>
        ) : sel ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 600 }}>Visible</span>
              <Tog checked={sel.visible} onChange={v => updateElement(selectedKey as ElementKey, { visible: v })} />
            </div>

            <SL>Font Size</SL>
            <Sld min={8} max={60} step={1} val={sel.fontSize} unit="px"
              onChange={v => updateElement(selectedKey as ElementKey, { fontSize: v })} />

            <SL>Font Family</SL>
            <select value={sel.fontFamily}
              onChange={e => updateElement(selectedKey as ElementKey, { fontFamily: e.target.value as FontFamily })}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 12, marginBottom: 12 }}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            <SL>Bold</SL>
            <div style={{ marginBottom: 12 }}>
              <Tog checked={sel.bold} onChange={v => updateElement(selectedKey as ElementKey, { bold: v })} />
            </div>

            <SL>Text Align</SL>
            <Seg opts={[{ v: "left", l: "L" }, { v: "center", l: "C" }, { v: "right", l: "R" }]}
              val={sel.align} onChange={v => updateElement(selectedKey as ElementKey, { align: v as Align })} />

            <SL>Color</SL>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input type="color" value={sel.color}
                onChange={e => updateElement(selectedKey as ElementKey, { color: e.target.value })}
                style={{ width: 40, height: 32, border: "1px solid #ccc", borderRadius: 5, cursor: "pointer", padding: 2 }} />
              <input type="text" value={sel.color}
                onChange={e => updateElement(selectedKey as ElementKey, { color: e.target.value })}
                style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc", fontSize: 12, fontFamily: "monospace" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {COLOR_PRESETS.map(c => (
                <button key={c} type="button" title={c}
                  onClick={() => updateElement(selectedKey as ElementKey, { color: c })}
                  style={{
                    width: 22, height: 22, borderRadius: 4,
                    border: sel.color === c ? "2px solid #092C4C" : "1px solid #ccc",
                    background: c, cursor: "pointer", padding: 0,
                    boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #ccc" : undefined,
                  }} />
              ))}
            </div>

            <SL>Horizontal Offset</SL>
            <Sld min={-120} max={120} step={2} val={sel.offsetX} unit="px" signed
              onChange={v => updateElement(selectedKey as ElementKey, { offsetX: v })} />

            <SL>Vertical Spacing Below</SL>
            <Sld min={-20} max={60} step={2} val={sel.offsetY} unit="px" signed
              onChange={v => updateElement(selectedKey as ElementKey, { offsetY: v })} />
          </>
        ) : null}
      </div>

      {/* ── RIGHT: preview ── */}
      <div style={{ flex: 1, overflowY: "auto", background: "#ddd", padding: "14px" }}>
        <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Live Preview — {activeTab}
        </div>

        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: "18px 20px", maxWidth: 1000, margin: "0 auto" }}>

          {/* Header preview */}
          {activeTab !== "footer" && (
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: logoJustify, gap: config.logo.gap, marginBottom: 8 }}>
                {logoUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Logo ${i + 1}`}
                    style={{ width: config.logo.size, height: config.logo.size * 0.8, objectFit: "contain" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ))}
              </div>
              {config.universityName.visible && <div style={es(config.universityName)}>University of Science and Technology of Southern Philippines</div>}
              {config.campuses.visible && <div style={es(config.campuses)}>Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva</div>}
              {config.collegeName.visible && <div style={es(config.collegeName)}>{collegeName}, USTP-CDO</div>}
              {config.examTitle.visible && <div style={es(config.examTitle)}>{t} Examination Schedule | {sem} Semester | A.Y. {yr}</div>}
              {config.examPeriod.visible && <div style={es(config.examPeriod)}>{period}</div>}
              <hr style={{ borderColor: "#ddd", margin: "10px 0" }} />
            </div>
          )}

          {/* Table preview */}
        {activeTab === "table" && (
        <table style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 1px 6px rgba(9,44,76,0.1)",
            marginBottom: 16,
        }}>
            <thead>
            {/* Date row */}
            <tr>
                <th colSpan={4} style={{
                background: "#0b3660",
                padding: "12px 14px",
                fontSize: config.tableDateHeader.fontSize,
                fontFamily: config.tableDateHeader.fontFamily,
                color: config.tableDateHeader.color,
                fontWeight: config.tableDateHeader.bold ? "bold" : 700,
                textAlign: config.tableDateHeader.align,
                letterSpacing: "0.01em",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: config.tableDateHeader.visible ? undefined : "none",
                }}>
                January 15, 2025
                </th>
            </tr>

            {/* Building row */}
            <tr>
                <th colSpan={4} style={{
                background: "#0d4075",
                padding: "8px 10px",
                fontSize: config.tableBuildingHeader.fontSize,
                fontFamily: config.tableBuildingHeader.fontFamily,
                color: config.tableBuildingHeader.color,
                fontWeight: config.tableBuildingHeader.bold ? "bold" : 600,
                textAlign: config.tableBuildingHeader.align,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: config.tableBuildingHeader.visible ? undefined : "none",
                }}>
                ICT BUILDING (BLDG. 09)
                </th>
            </tr>

            {/* Room + Time header row */}
            <tr>
                {["Time", "09-204", "09-301", "09-302"].map((h, i) => (
                <th key={i} style={{
                    background: "#092C4C",
                    padding: "9px 8px",
                    fontSize: config.tableRoomHeader.fontSize,
                    fontFamily: config.tableRoomHeader.fontFamily,
                    color: config.tableRoomHeader.color,
                    fontWeight: config.tableRoomHeader.bold ? "bold" : 700,
                    textAlign: config.tableRoomHeader.align,
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    width: i === 0 ? "108px" : undefined,
                }}>
                    {h}
                </th>
                ))}
            </tr>
            </thead>

            <tbody>
            {/* Row 1 — exam card spans 3 rows */}
            <tr>
                <td style={{
                padding: "0 8px",
                height: 52,
                textAlign: config.tableTimeColumn.align as any,
                fontFamily: config.tableTimeColumn.fontFamily,
                fontSize: config.tableTimeColumn.fontSize,
                fontWeight: config.tableTimeColumn.bold ? "bold" : 500,
                color: config.tableTimeColumn.color,
                background: "#f0f4f8",
                borderRight: "2px solid #C8D3E0",
                borderBottom: "1px solid #DDE3EC",
                whiteSpace: "nowrap",
                width: 108,
                display: config.tableTimeColumn.visible ? undefined : "none",
                }}>
                7:00AM - 7:30AM
                </td>
                <td rowSpan={3} style={{ border: "1px solid #DDE3EC", padding: 3, verticalAlign: "top", background: "#fff" }}>
                <div style={{
                    background: "#1E40AF", borderRadius: 5,
                    padding: "6px 8px", height: "100%", minHeight: 140,
                    display: "flex", flexDirection: "column", gap: 2,
                }}>
                    <div style={{
                    fontSize: config.tableCourseName.fontSize,
                    fontFamily: config.tableCourseName.fontFamily,
                    color: config.tableCourseName.color,
                    fontWeight: config.tableCourseName.bold ? "bold" : 700,
                    textAlign: config.tableCourseName.align as any,
                    display: config.tableCourseName.visible ? undefined : "none",
                    }}>
                    <strong>IT323</strong>
                    </div>
                    <div style={{
                    fontSize: config.tableSectionName.fontSize,
                    fontFamily: config.tableSectionName.fontFamily,
                    color: config.tableSectionName.color,
                    fontWeight: config.tableSectionName.bold ? "bold" : "normal",
                    textAlign: config.tableSectionName.align as any,
                    lineHeight: 1.2,
                    display: config.tableSectionName.visible ? undefined : "none",
                    }}>
                    IT3R2_Track1
                    </div>
                    <div style={{
                    fontSize: config.tableInstructor.fontSize,
                    fontFamily: config.tableInstructor.fontFamily,
                    color: config.tableInstructor.color,
                    fontWeight: config.tableInstructor.bold ? "bold" : "normal",
                    textAlign: config.tableInstructor.align as any,
                    lineHeight: 1.2,
                    display: config.tableInstructor.visible ? undefined : "none",
                    }}>
                    Instructor: J. Dela Cruz
                    </div>
                    <div style={{
                    fontSize: config.tableProctor.fontSize,
                    fontFamily: config.tableProctor.fontFamily,
                    color: config.tableProctor.color,
                    fontWeight: config.tableProctor.bold ? "bold" : "normal",
                    textAlign: config.tableProctor.align as any,
                    lineHeight: 1.2,
                    display: config.tableProctor.visible ? undefined : "none",
                    }}>
                    Proctor: Not Assigned
                    </div>
                </div>
                </td>
                <td rowSpan={2} style={{ border: "1px solid #DDE3EC", padding: 3, verticalAlign: "top", background: "#fff" }}>
                <div style={{
                    background: "#065F46", borderRadius: 5,
                    padding: "6px 8px", height: "100%", minHeight: 88,
                    display: "flex", flexDirection: "column", gap: 2,
                }}>
                    <div style={{
                    fontSize: config.tableCourseName.fontSize,
                    fontFamily: config.tableCourseName.fontFamily,
                    color: config.tableCourseName.color,
                    fontWeight: config.tableCourseName.bold ? "bold" : 700,
                    display: config.tableCourseName.visible ? undefined : "none",
                    }}>
                    <strong>IT122</strong>
                    </div>
                    <div style={{
                    fontSize: config.tableSectionName.fontSize,
                    fontFamily: config.tableSectionName.fontFamily,
                    color: config.tableSectionName.color,
                    lineHeight: 1.2,
                    display: config.tableSectionName.visible ? undefined : "none",
                    }}>
                    IT1R3
                    </div>
                </div>
                </td>
                <td style={{ border: "1px solid #DDE3EC", background: "#fafbfc" }} />
            </tr>

            {/* Row 2 */}
            <tr>
                <td style={{
                padding: "0 8px", height: 52,
                textAlign: config.tableTimeColumn.align as any,
                fontFamily: config.tableTimeColumn.fontFamily,
                fontSize: config.tableTimeColumn.fontSize,
                fontWeight: config.tableTimeColumn.bold ? "bold" : 500,
                color: config.tableTimeColumn.color,
                background: "#e8edf3",
                borderRight: "2px solid #C8D3E0",
                borderBottom: "1px solid #DDE3EC",
                whiteSpace: "nowrap",
                display: config.tableTimeColumn.visible ? undefined : "none",
                }}>
                7:30AM - 8:00AM
                </td>
                <td style={{ border: "1px solid #DDE3EC", background: "#ffffff" }} />
            </tr>

            {/* Row 3 */}
            <tr>
                <td style={{
                padding: "0 8px", height: 52,
                textAlign: config.tableTimeColumn.align as any,
                fontFamily: config.tableTimeColumn.fontFamily,
                fontSize: config.tableTimeColumn.fontSize,
                fontWeight: config.tableTimeColumn.bold ? "bold" : 500,
                color: config.tableTimeColumn.color,
                background: "#f0f4f8",
                borderRight: "2px solid #C8D3E0",
                borderBottom: "1px solid #DDE3EC",
                whiteSpace: "nowrap",
                display: config.tableTimeColumn.visible ? undefined : "none",
                }}>
                8:00AM - 8:30AM
                </td>
                <td style={{ border: "1px solid #DDE3EC", background: "#fafbfc" }} />
                <td style={{ border: "1px solid #DDE3EC", background: "#fafbfc" }} />
            </tr>
            </tbody>
        </table>
        )}

          {activeTab === "header" && (
            <div style={{ textAlign: "center", color: "#bbb", fontSize: 12, padding: "16px 0" }}>[ Table appears here ]</div>
          )}

          {/* Footer preview */}
          {activeTab !== "header" && (
            <div style={{ borderTop: "2px solid #092C4C", paddingTop: 14, marginTop: activeTab === "footer" ? 0 : 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                {config.footerPreparedBy.visible && (
                  <div style={{ ...es(config.footerPreparedBy), width: "45%" }}>
                    <div style={{ fontWeight: "bold", marginBottom: 2 }}>Prepared by:</div>
                    <div style={{ fontStyle: "italic", marginBottom: 4 }}>(sgd.)</div>
                    <div style={{ fontWeight: "bold" }}>{footerData?.prepared_by_name || "[ Name ]"}</div>
                    <div>{footerData?.prepared_by_title || `Dean, ${collegeName}`}</div>
                  </div>
                )}
                {config.footerApprovedBy.visible && (
                  <div style={{ ...es(config.footerApprovedBy), width: "30%" }}>
                    <div style={{ fontWeight: "bold", marginBottom: 2 }}>Approved:</div>
                    <div style={{ fontStyle: "italic", marginBottom: 4 }}>(sgd.)</div>
                    <div style={{ fontWeight: "bold" }}>{footerData?.approved_by_name || "[ Name ]"}</div>
                    <div>{footerData?.approved_by_title || "VCAA, USTP-CDO"}</div>
                  </div>
                )}
              </div>
              {config.footerAddress.visible && <div style={es(config.footerAddress)}>{footerData?.address_line || "C.M Recto Avenue, Lapasan, Cagayan de Oro City"}</div>}
              {config.footerContact.visible && <div style={es(config.footerContact)}>{footerData?.contact_line || "Tel Nos. +63 (88) 856 1738 | http://www.ustp.edu.ph"}</div>}
            </div>
          )}
        </div>

        {selectedKey !== "logo" && (
          <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: "#777" }}>
            Editing: <strong style={{ color: "#092C4C" }}>{ELEMENTS.find(e => e.key === selectedKey)?.label ?? selectedKey}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Item: React.FC<{ label: string; subtitle?: string; icon?: string; active: boolean; dimmed?: boolean; onClick: () => void }> = ({ label, subtitle, icon, active, dimmed, onClick }) => (
  <div onClick={onClick} style={{
    padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
    background: active ? "#092C4C" : "transparent",
    color: active ? "#fff" : "#333",
    borderLeft: active ? "3px solid #F5A623" : "3px solid transparent",
    opacity: dimmed ? 0.45 : 1, transition: "all 0.1s",
  }}>
    {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
    {subtitle && <span style={{ fontSize: 10, opacity: 0.6, fontFamily: "monospace", minWidth: 28 }}>{subtitle}</span>}
    <span style={{ fontWeight: active ? 700 : 400, fontSize: 12 }}>{label}</span>
    {dimmed && <span style={{ fontSize: 9, opacity: 0.6, marginLeft: "auto" }}>hidden</span>}
  </div>
);

const SL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, marginTop: 12 }}>{children}</div>
);

const Tog: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 11, cursor: "pointer", background: checked ? "#092C4C" : "#ccc", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
    <div style={{ position: "absolute", top: 3, left: checked ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
  </div>
);

const Seg: React.FC<{ opts: { v: string; l: string }[]; val: string; onChange: (v: string) => void }> = ({ opts, val, onChange }) => (
  <div style={{ display: "flex", borderRadius: 7, overflow: "hidden", border: "1px solid #ccc", marginBottom: 12 }}>
    {opts.map(o => (
      <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{ flex: 1, padding: "6px 0", border: "none", cursor: "pointer", background: val === o.v ? "#092C4C" : "#fff", color: val === o.v ? "#fff" : "#555", fontSize: 12, fontWeight: val === o.v ? 700 : 400, transition: "all 0.15s" }}>{o.l}</button>
    ))}
  </div>
);

const Sld: React.FC<{ min: number; max: number; step: number; val: number; unit: string; signed?: boolean; onChange: (v: number) => void }> = ({ min, max, step, val, unit, signed, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <input type="range" min={min} max={max} step={step} value={val} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
    <span style={{ minWidth: 44, fontSize: 12, color: "#555", textAlign: "right" }}>{signed && val > 0 ? "+" : ""}{val}{unit}</span>
  </div>
);

// ─── Exports ──────────────────────────────────────────────────────────────────

export const applyLayoutConfig = (collegeId: string): LayoutConfig | null => {
  try {
    const saved = localStorage.getItem(storageKey(collegeId));
    return saved ? { ...defaultConfig(), ...JSON.parse(saved) } : null;
  } catch { return null; }
};

export const useLayoutConfig = (collegeId: string): LayoutConfig => {
  const [config, setConfig] = useState<LayoutConfig>(() => applyLayoutConfig(collegeId) ?? defaultConfig());

  useEffect(() => {
    const sync = () => setConfig(applyLayoutConfig(collegeId) ?? defaultConfig());
    window.addEventListener("storage", sync);
    window.addEventListener("layout-config-saved", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("layout-config-saved", sync);
    };
  }, [collegeId]);

  return config;
};

export default ScheduleLayoutEditor;