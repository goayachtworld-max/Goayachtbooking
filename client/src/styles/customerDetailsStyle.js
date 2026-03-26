/* ─────────────────────────────────────────────────────────────
   Shared design system – Customer screens
   Usage in each component:
     import { GLOBAL_CSS } from "../styles/customerStyles";
     // inside JSX:  <style>{GLOBAL_CSS}</style>
───────────────────────────────────────────────────────────── */

export const GLOBAL_CSS = `
  @keyframes cm-spin   { to { transform:rotate(360deg); } }
  @keyframes cm-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

  .cm-wrap * { box-sizing:border-box; }
  .cm-wrap {
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#f1f5f9; min-height:100dvh; padding:16px;
  }
  .cm-page { max-width:1000px; margin:0 auto; }

  /* Header */
  .cm-header  { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:10px; }
  .cm-title   { font-size:24px; font-weight:900; color:#0f172a; letter-spacing:-.3px; line-height:1.1; }
  .cm-subtitle{ font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; }
  .cm-hdr-btns{ display:flex; gap:8px; flex-wrap:wrap; flex-shrink:0; }

  /* Buttons */
  .cm-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:7px;
    padding:10px 20px; border-radius:9px; font-size:14px; font-weight:800;
    border:none; cursor:pointer; transition:all .18s;
    font-family:inherit; white-space:nowrap; line-height:1;
  }
  .cm-btn:disabled { opacity:.55; cursor:not-allowed; transform:none !important; box-shadow:none !important; }
  .cm-btn-primary { background:#2563eb; color:#fff; box-shadow:0 3px 12px rgba(37,99,235,.3); }
  .cm-btn-primary:not(:disabled):hover { background:#1d4ed8; transform:translateY(-1px); box-shadow:0 6px 18px rgba(37,99,235,.38); }
  .cm-btn-outline { background:#fff; color:#374151; border:2px solid #cbd5e1; }
  .cm-btn-outline:not(:disabled):hover { border-color:#2563eb; color:#2563eb; background:#eff6ff; }
  .cm-btn-sm   { padding:7px 14px; font-size:12px; }
  .cm-btn-full { width:100%; }

  /* Card */
  .cm-card { background:#fff; border-radius:14px; border:2px solid #e2e8f0; box-shadow:0 2px 12px rgba(0,0,0,.07); animation:cm-fadein .2s ease; }

  /* Section heading */
  .cm-section-head { display:flex; align-items:center; gap:9px; font-size:13px; font-weight:900; color:#0f172a; padding-bottom:12px; margin-bottom:16px; border-bottom:2px solid #f1f5f9; }
  .cm-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

  /* Tags */
  .cm-tag { display:inline-flex; align-items:center; gap:4px; padding:4px 11px; border-radius:20px; font-size:12px; font-weight:800; letter-spacing:.2px; border:1.5px solid; }
  .cm-tag-green { background:#dcfce7; color:#14532d; border-color:#86efac; }
  .cm-tag-amber { background:#fef9c3; color:#78350f; border-color:#fde047; }
  .cm-tag-red   { background:#fef2f2; color:#dc2626; border-color:#fca5a5; }
  .cm-tag-blue  { background:#dbeafe; color:#1d4ed8; border-color:#93c5fd; }
  .cm-tag-grey  { background:#f1f5f9; color:#475569; border-color:#cbd5e1; }

  /* Inputs */
  .cm-inp {
    width:100%; padding:11px 14px; font-size:15px; font-weight:600;
    border:2px solid #94a3b8; border-radius:9px;
    background:#fff; color:#0f172a; outline:none;
    transition:border-color .18s, box-shadow .18s;
    font-family:inherit; -webkit-appearance:none; line-height:1.4;
  }
  .cm-inp:focus     { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.13); }
  .cm-inp::placeholder { color:#94a3b8; font-weight:400; }
  .cm-inp:disabled  { background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; cursor:not-allowed; }
  select.cm-inp { cursor:pointer; }

  .cm-lbl     { display:block; font-size:13px; font-weight:800; color:#1e293b; margin-bottom:6px; }
  .cm-lbl-opt { font-size:11px; font-weight:500; color:#94a3b8; margin-left:5px; }
  .cm-field   { margin-bottom:16px; }
  .cm-field:last-child { margin-bottom:0; }

  /* Grid */
  .cm-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 18px; }
  @media(max-width:520px) { .cm-grid2 { grid-template-columns:1fr; } }

  /* Search */
  .cm-search-wrap { position:relative; }
  .cm-search-ico  { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:17px; pointer-events:none; color:#64748b; }
  .cm-search {
    width:100%; padding:11px 14px 11px 42px; font-size:15px; font-weight:600;
    border:2px solid #94a3b8; border-radius:10px;
    background:#fff; color:#0f172a; outline:none;
    transition:border-color .18s, box-shadow .18s; font-family:inherit;
  }
  .cm-search:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
  .cm-search::placeholder { color:#94a3b8; font-weight:400; }

  /* Table */
  .cm-table { width:100%; border-collapse:collapse; }
  .cm-table th {
    padding:11px 16px; font-size:11px; font-weight:900; color:#475569;
    text-transform:uppercase; letter-spacing:.8px;
    background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;
  }
  .cm-table td { padding:14px 16px; font-size:14px; font-weight:600; color:#1e293b; border-bottom:1.5px solid #f8fafc; vertical-align:middle; }
  .cm-tr:hover td { background:#f8fafc; transition:background .12s; }

  /* Mobile list row */
  .cm-cust-row { display:flex; align-items:center; gap:14px; padding:14px 16px; border-bottom:2px solid #f1f5f9; transition:background .12s; }
  .cm-cust-row:last-child { border-bottom:none; }
  .cm-cust-row:hover { background:#fafbfc; }

  /* Avatar */
  .cm-avatar { width:42px; height:42px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; font-size:15px; font-weight:900; display:flex; align-items:center; justify-content:center; }

  /* Pagination */
  .cm-page-btn { min-width:36px; height:36px; padding:0 10px; border-radius:8px; font-size:13px; font-weight:800; border:2px solid #e2e8f0; background:#fff; color:#374151; cursor:pointer; transition:all .15s; font-family:inherit; }
  .cm-page-btn:hover:not(:disabled) { border-color:#2563eb; color:#2563eb; }
  .cm-page-btn.active { background:#2563eb; border-color:#2563eb; color:#fff; }
  .cm-page-btn:disabled { opacity:.4; cursor:not-allowed; }

  /* Modal */
  .cm-overlay { position:fixed; inset:0; background:rgba(15,23,42,.65); backdrop-filter:blur(6px); z-index:999; display:flex; align-items:center; justify-content:center; padding:16px; animation:cm-fadein .18s ease; }
  .cm-modal { background:#fff; border-radius:16px; border:2px solid #e2e8f0; box-shadow:0 24px 64px rgba(0,0,0,.28); width:100%; max-width:460px; max-height:90vh; overflow-y:auto; animation:cm-fadein .2s ease; }
  .cm-modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 14px; border-bottom:2px solid #f1f5f9; position:sticky; top:0; background:#fff; z-index:1; }
  .cm-modal-title { font-size:18px; font-weight:900; color:#0f172a; }
  .cm-modal-close { width:32px; height:32px; border-radius:8px; border:2px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:16px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; line-height:1; }
  .cm-modal-close:hover { background:#fef2f2; border-color:#fca5a5; color:#dc2626; }
  .cm-modal-body   { padding:20px; }
  .cm-modal-footer { padding:14px 20px 18px; border-top:2px solid #f1f5f9; display:flex; gap:10px; justify-content:flex-end; }

  /* Info grid (details page) */
  .cm-info-grid  { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .cm-info-label { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px; }
  .cm-info-val   { font-size:15px; font-weight:700; color:#0f172a; }

  /* Trip progress */
  .cm-progress-track { height:6px; background:#e2e8f0; border-radius:99px; overflow:hidden; margin-bottom:14px; }
  .cm-progress-fill  { height:100%; background:linear-gradient(90deg,#16a34a,#22c55e); border-radius:99px; transition:width .4s; }
  .cm-steps     { display:flex; justify-content:space-between; }
  .cm-step      { display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; }
  .cm-step-dot  { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; border:2px solid #e2e8f0; background:#fff; color:#94a3b8; transition:all .3s; }
  .cm-step-dot.done  { background:#16a34a; border-color:#16a34a; color:#fff; }
  .cm-step-lbl       { font-size:11px; font-weight:700; color:#94a3b8; }
  .cm-step-lbl.done  { color:#16a34a; }

  /* Spinner */
  .cm-spinner { width:36px; height:36px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:cm-spin .7s linear infinite; }

  /* Empty state */
  .cm-empty      { text-align:center; padding:48px 16px; }
  .cm-empty-icon { font-size:44px; margin-bottom:10px; opacity:.7; }
  .cm-empty-text { font-size:17px; font-weight:800; margin-bottom:4px; color:#334155; }
  .cm-empty-sub  { font-size:13px; color:#94a3b8; }

  /* Responsive breakpoints */
  .cm-desk { display:block; }
  .cm-mob  { display:none;  }
  @media(max-width:620px) {
    .cm-desk  { display:none  !important; }
    .cm-mob   { display:block !important; }
    .cm-wrap  { padding:12px; }
    .cm-title { font-size:20px; }
    .cm-btn   { font-size:13px; padding:9px 15px; }
  }
  @media(max-width:400px) {
    .cm-btn { font-size:12px; padding:8px 12px; }
    .cm-title { font-size:18px; }
  }
`;