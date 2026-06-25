import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "work-journal-entries";

const STATUS_OPTIONS = ["작업 중", "완료", "보류", "취소", "검토 중"];
const STATUS_COLORS = {
  "작업 중": { bg: "#FFF3CD", text: "#856404", dot: "#FFC107" },
  "완료":    { bg: "#D1E7DD", text: "#0F5132", dot: "#198754" },
  "보류":    { bg: "#E2E3E5", text: "#41464B", dot: "#6C757D" },
  "취소":    { bg: "#F8D7DA", text: "#842029", dot: "#DC3545" },
  "검토 중": { bg: "#CFF4FC", text: "#055160", dot: "#0DCAF0" },
};
const CATEGORIES = ["통지생성", "작업지시", "안전점검", "설비정비", "기타"];

/* ── 유틸 ── */
function parseNoticeText(raw) {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const result = {};
  const cat = lines.find(l => l.startsWith("[") && l.endsWith("]"));
  if (cat) result.category = cat.replace(/[\[\]]/g, "").trim();
  const map = {
    "통지번호": "noticeId", "통지생성일": "date", "통지생성시간": "time",
    "통지생성자": "creator", "통지내용": "content", "업무일지": "status",
  };
  lines.forEach(line => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (map[k]) result[map[k]] = v;
  });
  return result;
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ── 내보내기 유틸 ── */
function exportToCSV(entries) {
  const headers = ["통지번호", "유형", "생성일", "생성시간", "생성자", "통지내용", "상태", "작업내용", "마지막수정"];
  const rows = entries.map(e => [
    e.noticeId, e.category, e.date, e.time, e.creator,
    e.content, e.status, e.memo || "",
    e.updatedAt ? new Date(e.updatedAt).toLocaleString("ko-KR") : ""
  ].map(v => `"${String(v).replace(/"/g, '""')}"`));
  const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `업무일지_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportToJSON(entries) {
  const json = JSON.stringify(entries, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `업무일지_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

/* ── 내보내기 모달 ── */
function ExportModal({ entries, onClose }) {
  const [selected, setSelected] = useState("all");
  const [format, setFormat] = useState("csv");

  const filtered = selected === "all" ? entries
    : entries.filter(e => e.status === selected);

  function handleExport() {
    if (filtered.length === 0) { alert("내보낼 데이터가 없습니다."); return; }
    if (format === "csv") exportToCSV(filtered);
    else exportToJSON(filtered);
    onClose();
  }

  const btnBase = { flex:1, padding:"9px 0", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", border:"none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:1000, backdropFilter:"blur(2px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480,
        padding:"0 0 36px" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, borderRadius:9, background:"#D1D5DB" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 20px" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#111827" }}>📤 데이터 내보내기</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#6B7280" }}>×</button>
        </div>

        <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:18 }}>
          {/* 범위 선택 */}
          <div>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:"#6B7280" }}>내보낼 범위</p>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[["all", `전체 (${entries.length}건)`], ...STATUS_OPTIONS.map(s => [s, `${s} (${entries.filter(e=>e.status===s).length}건)`])].map(([val, label]) => (
                <label key={val} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  borderRadius:10, cursor:"pointer", border:`1.5px solid ${selected===val ? "#1D4ED8" : "#E5E7EB"}`,
                  background: selected===val ? "#EFF6FF" : "#F9FAFB" }}>
                  <input type="radio" name="range" value={val} checked={selected===val}
                    onChange={() => setSelected(val)} style={{ accentColor:"#1D4ED8" }} />
                  <span style={{ fontSize:14, fontWeight:600, color: selected===val ? "#1D4ED8" : "#374151" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 형식 선택 */}
          <div>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:"#6B7280" }}>파일 형식</p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setFormat("csv")} style={{ ...btnBase,
                background: format==="csv" ? "#1D4ED8" : "#F3F4F6",
                color: format==="csv" ? "#fff" : "#374151" }}>📊 CSV (엑셀)</button>
              <button onClick={() => setFormat("json")} style={{ ...btnBase,
                background: format==="json" ? "#1D4ED8" : "#F3F4F6",
                color: format==="json" ? "#fff" : "#374151" }}>📄 JSON</button>
            </div>
            <p style={{ margin:"8px 0 0", fontSize:11, color:"#9CA3AF" }}>
              {format === "csv" ? "엑셀에서 바로 열 수 있는 CSV 형식입니다." : "백업·복원에 적합한 JSON 형식입니다."}
            </p>
          </div>

          <button onClick={handleExport} style={{ background:"#1D4ED8", color:"#fff", border:"none",
            borderRadius:10, padding:"14px", fontSize:15, fontWeight:800, cursor:"pointer" }}>
            ⬇ {filtered.length}건 내보내기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 가져오기 모달 ── */
function ImportModal({ currentEntries, onImport, onClose }) {
  const [mode, setMode] = useState("merge"); // merge | replace
  const [preview, setPreview] = useState(null); // { entries, filename, error }
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let parsed = [];
        if (ext === "json") {
          const raw = JSON.parse(ev.target.result);
          if (!Array.isArray(raw)) throw new Error("JSON 배열 형식이 아닙니다.");
          parsed = raw.map(e => ({
            id: e.id || genId(),
            category: e.category || "기타",
            noticeId: e.noticeId || "",
            date: e.date || "",
            time: e.time || "",
            creator: e.creator || "",
            content: e.content || "",
            status: STATUS_COLORS[e.status] ? e.status : "작업 중",
            memo: e.memo || "",
            updatedAt: e.updatedAt || new Date().toISOString(),
          }));
        } else if (ext === "csv") {
          const lines = ev.target.result.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
          const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
          const COL = { "통지번호":"noticeId","유형":"category","생성일":"date","생성시간":"time",
            "생성자":"creator","통지내용":"content","상태":"status","작업내용":"memo" };
          parsed = lines.slice(1).map(line => {
            const vals = [];
            let cur = "", inQ = false;
            for (const ch of line) {
              if (ch === '"') { inQ = !inQ; }
              else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
              else cur += ch;
            }
            vals.push(cur);
            const obj = { id: genId(), updatedAt: new Date().toISOString() };
            headers.forEach((h, i) => { if (COL[h]) obj[COL[h]] = (vals[i]||"").replace(/^"|"$/g,""); });
            if (!STATUS_COLORS[obj.status]) obj.status = "작업 중";
            obj.category = obj.category || "기타";
            return obj;
          }).filter(e => e.noticeId || e.content);
        } else {
          throw new Error("JSON 또는 CSV 파일만 지원합니다.");
        }
        setPreview({ entries: parsed, filename: file.name, error: null });
      } catch(err) {
        setPreview({ entries: [], filename: file.name, error: err.message });
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function handleImport() {
    if (!preview?.entries?.length) return;
    let next;
    if (mode === "replace") {
      if (!window.confirm(`기존 ${currentEntries.length}건을 모두 지우고 ${preview.entries.length}건으로 교체합니다. 계속하시겠습니까?`)) return;
      next = preview.entries;
    } else {
      const existingIds = new Set(currentEntries.map(e => e.id));
      const newOnly = preview.entries.filter(e => !existingIds.has(e.id));
      next = [...newOnly, ...currentEntries];
    }
    onImport(next);
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:1000, backdropFilter:"blur(2px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480,
        maxHeight:"90vh", overflow:"auto", padding:"0 0 36px" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, borderRadius:9, background:"#D1D5DB" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 20px" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#111827" }}>📥 데이터 가져오기</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#6B7280" }}>×</button>
        </div>

        <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:18 }}>
          {/* 파일 선택 */}
          <div>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:"#6B7280" }}>파일 선택 (JSON 또는 CSV)</p>
            <div onClick={() => fileRef.current?.click()} style={{
              border:"2px dashed #CBD5E1", borderRadius:12, padding:"24px 20px",
              textAlign:"center", cursor:"pointer", background:"#F8FAFC",
              transition:"border-color 0.2s" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
              <p style={{ margin:0, fontSize:13, color:"#64748B", fontWeight:600 }}>
                {preview ? preview.filename : "파일을 클릭해서 선택하세요"}
              </p>
              <p style={{ margin:"4px 0 0", fontSize:11, color:"#94A3B8" }}>JSON · CSV 지원</p>
            </div>
            <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleFile}
              style={{ display:"none" }} />
          </div>

          {/* 미리보기 */}
          {preview && (
            preview.error ? (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ margin:0, fontSize:13, color:"#DC2626", fontWeight:700 }}>⚠ 파일 오류</p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"#EF4444" }}>{preview.error}</p>
              </div>
            ) : (
              <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ margin:0, fontSize:13, color:"#15803D", fontWeight:700 }}>
                  ✓ {preview.entries.length}건 인식됨
                </p>
                <p style={{ margin:"4px 0 0", fontSize:11, color:"#16A34A" }}>
                  통지번호·내용이 있는 항목만 가져옵니다.
                </p>
              </div>
            )
          )}

          {/* 가져오기 방식 */}
          {preview && !preview.error && (
            <div>
              <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:"#6B7280" }}>가져오기 방식</p>
              {[
                ["merge",   "병합", `기존 ${currentEntries.length}건 유지 + 새 항목 추가 (중복 ID 제외)`, "#EFF6FF", "#1D4ED8"],
                ["replace", "교체", `기존 데이터를 모두 지우고 ${preview.entries.length}건으로 교체`, "#FFF7ED", "#EA580C"],
              ].map(([val, label, desc, bg, color]) => (
                <label key={val} onClick={() => setMode(val)} style={{
                  display:"flex", alignItems:"flex-start", gap:10, padding:"12px",
                  borderRadius:10, cursor:"pointer", marginBottom:6,
                  border:`1.5px solid ${mode===val ? color : "#E5E7EB"}`,
                  background: mode===val ? bg : "#F9FAFB" }}>
                  <input type="radio" name="importMode" value={val} checked={mode===val}
                    onChange={() => setMode(val)} style={{ accentColor:color, marginTop:2 }} />
                  <div>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color: mode===val ? color : "#374151" }}>{label}</p>
                    <p style={{ margin:"2px 0 0", fontSize:11, color:"#6B7280" }}>{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button onClick={handleImport}
            disabled={!preview || !!preview.error || preview.entries.length === 0}
            style={{ background: (!preview || preview.error) ? "#E5E7EB" : "#1D4ED8",
              color: (!preview || preview.error) ? "#9CA3AF" : "#fff",
              border:"none", borderRadius:10, padding:"14px",
              fontSize:15, fontWeight:800, cursor: (!preview || preview.error) ? "default" : "pointer" }}>
            {preview && !preview.error ? `⬆ ${preview.entries.length}건 가져오기` : "파일을 선택하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── 배지 ── */
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["보류"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      background:c.bg, color:c.text, fontSize:11, fontWeight:700,
      letterSpacing:0.3, padding:"3px 9px", borderRadius:99 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c.dot, flexShrink:0 }} />
      {status}
    </span>
  );
}
function CategoryBadge({ category }) {
  return (
    <span style={{ background:"#EEF2FF", color:"#4338CA", fontSize:10, fontWeight:700,
      letterSpacing:0.5, padding:"2px 7px", borderRadius:4 }}>
      {category}
    </span>
  );
}

/* ── 빈 화면 ── */
function EmptyState({ onAdd }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", flex:1, padding:"40px 20px", gap:16 }}>
      <div style={{ fontSize:52 }}>📋</div>
      <p style={{ color:"#6B7280", fontSize:14, textAlign:"center", lineHeight:1.6, margin:0 }}>
        등록된 업무일지가 없습니다.<br/>아래 버튼으로 첫 업무를 추가해보세요.
      </p>
      <button onClick={onAdd} style={{ background:"#1D4ED8", color:"#fff", border:"none",
        borderRadius:10, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
        + 업무 추가
      </button>
    </div>
  );
}

/* ── 입력/수정 모달 ── */
function EntryModal({ entry, onSave, onClose }) {
  const isNew = !entry.id;
  const [pasteMode, setPasteMode] = useState(isNew);
  const [rawText, setRawText]   = useState("");
  const [parseError, setParseError] = useState("");
  const [form, setForm] = useState({
    category: entry.category || "통지생성",
    noticeId: entry.noticeId || "",
    date:     entry.date     || new Date().toISOString().slice(0,10).replace(/-/g,"/"),
    time:     entry.time     || new Date().toTimeString().slice(0,8),
    creator:  entry.creator  || "",
    content:  entry.content  || "",
    status:   entry.status   || "작업 중",
    memo:     entry.memo     || "",
    purchase: entry.purchase || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleParse() {
    const p = parseNoticeText(rawText);
    if (!p.content && !p.noticeId) { setParseError("인식 가능한 데이터가 없습니다."); return; }
    setParseError("");
    setForm(f => ({
      ...f,
      category: p.category || f.category,
      noticeId: p.noticeId || f.noticeId,
      date:     p.date     || f.date,
      time:     p.time     || f.time,
      creator:  p.creator  || f.creator,
      content:  p.content  || f.content,
      status:   p.status && STATUS_COLORS[p.status] ? p.status : f.status,
    }));
    setPasteMode(false);
  }

  function handleSave() {
    if (!form.noticeId.trim()) { alert("통지번호를 입력해주세요."); return; }
    if (!form.content.trim())  { alert("통지내용을 입력해주세요."); return; }
    onSave({ ...entry, ...form, id: entry.id || genId(), updatedAt: new Date().toISOString() });
  }

  const field = {
    width:"100%", boxSizing:"border-box", border:"1.5px solid #E5E7EB",
    borderRadius:8, padding:"10px 12px", fontSize:14, color:"#111827",
    outline:"none", background:"#F9FAFB", fontFamily:"inherit",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:1000, backdropFilter:"blur(2px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480,
        maxHeight:"92vh", overflow:"auto", padding:"0 0 32px" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, borderRadius:9, background:"#D1D5DB" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 16px" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#111827" }}>
            {isNew ? "업무 추가" : "업무 수정"}
          </h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#6B7280" }}>×</button>
        </div>

        <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:14 }}>
          {isNew && (
            <div style={{ display:"flex", gap:8 }}>
              {[["📋 데이터 붙여넣기", true], ["✏️ 직접 입력", false]].map(([label, mode]) => (
                <button key={label} onClick={() => setPasteMode(mode)} style={{
                  flex:1, padding:"9px 0", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
                  background: pasteMode === mode ? "#1D4ED8" : "#F3F4F6",
                  color: pasteMode === mode ? "#fff" : "#374151", border:"none" }}>{label}</button>
              ))}
            </div>
          )}

          {pasteMode ? (
            <>
              <textarea value={rawText}
                onChange={e => { setRawText(e.target.value); setParseError(""); }}
                placeholder={"[통지생성]\n통지번호 : 10033685\n통지생성일 : 2026/06/24\n통지생성시간 : 10:37:47\n통지생성자 : AA00 / 김대웅\n통지내용 : [수위탁] 솔벤트 설비 전원 환기팬 인터락 작업\n업무일지 : 작업 중"}
                style={{ ...field, minHeight:180, resize:"vertical", lineHeight:1.6 }} />
              {parseError && <p style={{ color:"#DC3545", fontSize:12, margin:0 }}>{parseError}</p>}
              <button onClick={handleParse} style={{ background:"#059669", color:"#fff", border:"none",
                borderRadius:8, padding:"11px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                자동 분석 및 입력 →
              </button>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>유형</label>
                <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => set("category", c)} style={{
                      padding:"6px 12px", borderRadius:99, fontSize:12, fontWeight:700, cursor:"pointer",
                      background: form.category===c ? "#1D4ED8" : "#F3F4F6",
                      color: form.category===c ? "#fff" : "#374151", border:"none" }}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>통지번호</label>
                <input style={{ ...field, marginTop:6 }} value={form.noticeId}
                  onChange={e => set("noticeId", e.target.value)} placeholder="예) 10033685" />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>생성일</label>
                  <input style={{ ...field, marginTop:6 }} value={form.date}
                    onChange={e => set("date", e.target.value)} placeholder="2026/06/24" />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>생성시간</label>
                  <input style={{ ...field, marginTop:6 }} value={form.time}
                    onChange={e => set("time", e.target.value)} placeholder="10:37:47" />
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>생성자</label>
                <input style={{ ...field, marginTop:6 }} value={form.creator}
                  onChange={e => set("creator", e.target.value)} placeholder="예) AA00 / 김대웅" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>통지내용</label>
                <textarea style={{ ...field, marginTop:6, minHeight:60, resize:"vertical" }} value={form.content}
                  onChange={e => set("content", e.target.value)} placeholder="작업 내용을 입력하세요" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>상태</label>
                <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                  {STATUS_OPTIONS.map(s => {
                    const c = STATUS_COLORS[s]; const sel = form.status===s;
                    return (
                      <button key={s} onClick={() => set("status", s)} style={{
                        padding:"6px 12px", borderRadius:99, fontSize:12, fontWeight:700, cursor:"pointer",
                        background: sel ? c.dot : "#F3F4F6", color: sel ? "#fff" : "#374151",
                        border: sel ? "none" : "1.5px solid #E5E7EB" }}>{s}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>작업내용</label>
                <textarea style={{ ...field, marginTop:6, minHeight:120, resize:"vertical" }} value={form.memo}
                  onChange={e => set("memo", e.target.value)} placeholder="추가 작업내용을 입력하세요" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B7280" }}>제품구매</label>
                <textarea style={{ ...field, marginTop:6, minHeight:80, resize:"vertical" }} value={form.purchase}
                  onChange={e => set("purchase", e.target.value)} placeholder="구매 제품명, 수량, 비용 등을 입력하세요" />
              </div>
              <button onClick={handleSave} style={{ background:"#1D4ED8", color:"#fff", border:"none",
                borderRadius:10, padding:"13px", fontSize:15, fontWeight:800, cursor:"pointer", marginTop:4 }}>
                {isNew ? "업무 등록" : "수정 완료"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 상세 모달 ── */
function DetailModal({ entry, onEdit, onDelete, onClose }) {
  const rows = [
    ["통지번호", entry.noticeId],
    ["생성일시", `${entry.date} ${entry.time}`],
    ["생성자", entry.creator],
    ["통지내용", entry.content],
    ["작업내용", entry.memo],
    ["제품구매", entry.purchase],
  ].filter(([, v]) => v);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:1000, backdropFilter:"blur(2px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480,
        maxHeight:"85vh", overflow:"auto", padding:"0 0 32px" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, borderRadius:9, background:"#D1D5DB" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <CategoryBadge category={entry.category} />
            <StatusBadge status={entry.status} />
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#6B7280" }}>×</button>
        </div>
        <div style={{ padding:"0 20px" }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ borderBottom:"1px solid #F3F4F6", padding:"12px 0" }}>
              <p style={{ margin:"0 0 3px", fontSize:11, fontWeight:700, color:"#9CA3AF" }}>{label}</p>
              <p style={{ margin:0, fontSize:14, color:"#111827", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{val}</p>
            </div>
          ))}
          {entry.updatedAt && (
            <p style={{ margin:"12px 0 0", fontSize:11, color:"#9CA3AF" }}>
              마지막 수정: {new Date(entry.updatedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
        <div style={{ padding:"20px 20px 0", display:"flex", gap:8 }}>
          <button onClick={onEdit} style={{ flex:1, background:"#1D4ED8", color:"#fff", border:"none",
            borderRadius:10, padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer" }}>✏️ 수정</button>
          <button onClick={onDelete} style={{ background:"#FEF2F2", color:"#DC2626", border:"none",
            borderRadius:10, padding:"12px 16px", fontSize:14, fontWeight:700, cursor:"pointer" }}>🗑</button>
        </div>
      </div>
    </div>
  );
}

/* ── 카드 ── */
function EntryCard({ entry, onClick }) {
  return (
    <div onClick={onClick} style={{ background:"#fff", borderRadius:14, padding:"14px 16px",
      boxShadow:"0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
      cursor:"pointer", display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <CategoryBadge category={entry.category} />
          <span style={{ fontSize:11, color:"#9CA3AF", fontWeight:600 }}>#{entry.noticeId}</span>
        </div>
        <StatusBadge status={entry.status} />
      </div>
      <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#111827", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{entry.content}</p>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, color:"#9CA3AF" }}>{entry.date} {entry.time}</span>
        <span style={{ fontSize:11, color:"#6B7280", fontWeight:600 }}>{entry.creator}</span>
      </div>
    </div>
  );
}

/* ── 메인 앱 ── */
export default function App() {
  const [entries, setEntries]         = useState([]);
  const [modal, setModal]             = useState(null);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [tab, setTab]                 = useState("list");
  const [showExport, setShowExport]   = useState(false);
  const [showImport, setShowImport]   = useState(false);

  // localStorage 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEntries(JSON.parse(saved));
    } catch (_) {}
  }, []);

  function saveEntries(next) {
    setEntries(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  }

  function handleSave(entry) {
    const idx = entries.findIndex(e => e.id === entry.id);
    saveEntries(idx >= 0 ? entries.map(e => e.id === entry.id ? entry : e) : [entry, ...entries]);
    setModal(null);
  }
  function handleImport(next) {
    saveEntries(next);
  }
  function handleDelete(id) {
    if (!window.confirm("이 업무일지를 삭제하시겠습니까?")) return;
    saveEntries(entries.filter(e => e.id !== id));
    setModal(null);
  }

  const filtered = entries.filter(e => {
    const okStatus = filterStatus === "전체" || e.status === filterStatus;
    const q = search.toLowerCase();
    const okSearch = !q || [e.noticeId, e.content, e.creator, e.category, e.memo, e.purchase].some(v => v?.toLowerCase().includes(q));
    return okStatus && okSearch;
  });

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = entries.filter(e => e.status === s).length; return acc;
  }, {});

  return (
    <div style={{ minHeight:"100vh", background:"#F1F5F9",
      fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
      display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>

      {/* 헤더 */}
      <div style={{ background:"linear-gradient(135deg,#1E3A8A 0%,#1D4ED8 100%)",
        padding:"20px 20px 16px", color:"#fff",
        position:"sticky", top:0, zIndex:10,
        boxShadow:"0 2px 12px rgba(29,78,216,0.25)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:900, letterSpacing:-0.5 }}>업무일지</h1>
            <p style={{ margin:"2px 0 0", fontSize:12, opacity:0.7 }}>총 {entries.length}건 등록</p>
          </div>
          <div style={{ display:"flex", gap:6 }}>
<button onClick={() => setShowImport(true)} style={{
                background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.35)",
                color:"#fff", borderRadius:10, padding:"8px 12px",
                fontSize:13, fontWeight:700, cursor:"pointer" }}>📥 가져오기</button>
            {entries.length > 0 && (
              <button onClick={() => setShowExport(true)} style={{
                background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.35)",
                color:"#fff", borderRadius:10, padding:"8px 12px",
                fontSize:13, fontWeight:700, cursor:"pointer" }}>📤 내보내기</button>
            )}
            <button onClick={() => setModal({ type:"add", entry:{} })} style={{
              background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.4)",
              color:"#fff", borderRadius:10, padding:"8px 14px",
              fontSize:13, fontWeight:800, cursor:"pointer" }}>+ 추가</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:4, marginTop:14,
          background:"rgba(0,0,0,0.15)", borderRadius:8, padding:3 }}>
          {["list","stats"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:"7px 0", borderRadius:6, fontSize:13, fontWeight:700, cursor:"pointer", border:"none",
              background: tab===t ? "#fff" : "transparent",
              color: tab===t ? "#1D4ED8" : "rgba(255,255,255,0.7)" }}>
              {t==="list" ? "📋 목록" : "📊 현황"}
            </button>
          ))}
        </div>
      </div>

      {tab === "list" ? (
        <>
          <div style={{ padding:"12px 16px 0", display:"flex", flexDirection:"column", gap:10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  통지번호, 내용, 생성자 검색"
              style={{ width:"100%", boxSizing:"border-box", border:"none", borderRadius:10,
                padding:"11px 14px", fontSize:14, color:"#111827", background:"#fff",
                boxShadow:"0 1px 3px rgba(0,0,0,0.08)", outline:"none", fontFamily:"inherit" }} />
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
              {["전체", ...STATUS_OPTIONS].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  flexShrink:0, padding:"6px 12px", borderRadius:99, fontSize:12, fontWeight:700,
                  cursor:"pointer", border:"none",
                  background: filterStatus===s ? "#1D4ED8" : "#fff",
                  color: filterStatus===s ? "#fff" : "#374151",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  {s} ({s==="전체" ? entries.length : statusCounts[s]||0})
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"12px 16px 100px", gap:10 }}>
            {filtered.length === 0
              ? entries.length === 0
                ? <EmptyState onAdd={() => setModal({ type:"add", entry:{} })} />
                : <div style={{ textAlign:"center", padding:40, color:"#9CA3AF", fontSize:14 }}>검색 결과가 없습니다.</div>
              : filtered.map(e => (
                  <EntryCard key={e.id} entry={e} onClick={() => setModal({ type:"detail", entry:e })} />
                ))
            }
          </div>
        </>
      ) : (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:"16px", boxShadow:"0 1px 4px rgba(0,0,0,0.07)" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:800, color:"#374151" }}>상태별 현황</h3>
            {STATUS_OPTIONS.map(s => {
              const c = STATUS_COLORS[s]; const cnt = statusCounts[s]||0;
              const pct = entries.length ? Math.round((cnt/entries.length)*100) : 0;
              return (
                <div key={s} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{s}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:c.text }}>{cnt}건 ({pct}%)</span>
                  </div>
                  <div style={{ height:8, background:"#F3F4F6", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:c.dot, borderRadius:99, transition:"width 0.4s" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { label:"전체 업무",  value:entries.length,                                           color:"#1D4ED8" },
              { label:"완료",       value:statusCounts["완료"]||0,                                  color:"#059669" },
              { label:"작업 중",    value:statusCounts["작업 중"]||0,                               color:"#D97706" },
              { label:"보류/취소",  value:(statusCounts["보류"]||0)+(statusCounts["취소"]||0),      color:"#DC2626" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:"#fff", borderRadius:14, padding:"16px",
                boxShadow:"0 1px 4px rgba(0,0,0,0.07)", borderLeft:`4px solid ${color}` }}>
                <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700, color:"#9CA3AF" }}>{label}</p>
                <p style={{ margin:0, fontSize:28, fontWeight:900, color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setModal({ type:"add", entry:{} })} style={{
        position:"fixed", bottom:24, right:16,
        width:56, height:56, borderRadius:"50%",
        background:"linear-gradient(135deg,#1D4ED8,#1E40AF)",
        color:"#fff", border:"none", fontSize:26, cursor:"pointer",
        boxShadow:"0 4px 16px rgba(29,78,216,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>+</button>

      {/* 모달 */}
      {showImport && <ImportModal currentEntries={entries} onImport={handleImport} onClose={() => setShowImport(false)} />}
      {showExport && <ExportModal entries={entries} onClose={() => setShowExport(false)} />}
      {modal?.type==="add"    && <EntryModal entry={{}}          onSave={handleSave} onClose={() => setModal(null)} />}
      {modal?.type==="edit"   && <EntryModal entry={modal.entry} onSave={handleSave} onClose={() => setModal(null)} />}
      {modal?.type==="detail" && (
        <DetailModal entry={modal.entry}
          onEdit={() => setModal({ type:"edit", entry:modal.entry })}
          onDelete={() => handleDelete(modal.entry.id)}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}

