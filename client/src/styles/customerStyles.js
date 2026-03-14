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
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #f8f9fa;
    min-height: 100vh;
    padding: 1rem;
    color: #212529;
  }
  .cm-page { max-width: 1000px; margin: 0 auto; }

  /* Header */
  .cm-header   { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:.5rem; }
  .cm-title    { font-size:1.4rem; font-weight:700; color:#212529; margin:0; }
  .cm-subtitle { font-size:.7rem; font-weight:700; color:#6c757d; text-transform:uppercase; letter-spacing:.08em; margin-bottom:2px; }
  .cm-hdr-btns { display:flex; gap:.5rem; flex-wrap:wrap; flex-shrink:0; }

  /* Buttons */
  .cm-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:6px;
    padding:.45rem 1rem; border-radius:6px; font-size:.875rem; font-weight:500;
    border:none; cursor:pointer; transition:background .2s, border-color .2s, color .2s;
    font-family:inherit; white-space:nowrap; line-height:1.4;
  }
  .cm-btn:disabled { opacity:.55; cursor:not-allowed; }
  .cm-btn-primary  { background:#0d6efd; color:#fff; }
  .cm-btn-primary:not(:disabled):hover  { background:#0b5ed7; }
  .cm-btn-outline  { background:#fff; color:#495057; border:1px solid #ced4da; }
  .cm-btn-outline:not(:disabled):hover  { border-color:#0d6efd; color:#0d6efd; background:#f0f6ff; }
  .cm-btn-danger   { background:#dc3545; color:#fff; }
  .cm-btn-danger:not(:disabled):hover   { background:#bb2d3b; }
  .cm-btn-sm   { padding:.35rem .75rem; font-size:.8rem; }
  .cm-btn-full { width:100%; height:46px; font-size:.95rem; font-weight:600; }

  /* Card */
  .cm-card {
    background:#fff; border-radius:8px;
    border:1px solid #dee2e6;
    box-shadow:0 2px 8px rgba(0,0,0,.07);
    animation:cm-fadein .2s ease;
  }

  /* Section heading */
  .cm-section-head {
    font-size:.7rem; font-weight:700; color:#6c757d;
    text-transform:uppercase; letter-spacing:.08em;
    padding-bottom:.4rem; margin-bottom:.75rem;
    border-bottom:1px solid #dee2e6;
    display:flex; align-items:center; gap:.4rem;
  }
  .cm-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

  /* Tags / badges */
  .cm-tag { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:.73rem; font-weight:600; }
  .cm-tag-green { background:rgba(25,135,84,.1);  color:#198754; }
  .cm-tag-amber { background:rgba(255,193,7,.15); color:#664d03; }
  .cm-tag-red   { background:rgba(220,53,69,.1);  color:#dc3545; }
  .cm-tag-blue  { background:rgba(13,110,253,.1); color:#0d6efd; }
  .cm-tag-grey  { background:rgba(108,117,125,.1);color:#6c757d; }

  /* Inputs */
  .cm-inp {
    width:100%; height:40px; padding:0 .75rem;
    font-size:.9rem; font-weight:400;
    border:1px solid #ced4da; border-radius:6px;
    background:#fff; color:#212529; outline:none;
    transition:border-color .15s, box-shadow .15s;
    font-family:inherit; -webkit-appearance:none; appearance:none;
  }
  .cm-inp:focus       { border-color:#86b7fe; box-shadow:0 0 0 3px rgba(13,110,253,.15); }
  .cm-inp::placeholder{ color:#adb5bd; font-weight:400; }
  .cm-inp:disabled    { background:#f8f9fa; color:#6c757d; cursor:not-allowed; }
  select.cm-inp {
    cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236c757d' stroke-width='1.5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 10px center; padding-right:2rem;
  }
  input[type="file"].cm-inp {
    height:auto; padding:.45rem .75rem;
    border-style:dashed; background:#f8f9fa; cursor:pointer;
  }
  input[type="file"].cm-inp:hover:not(:disabled) { border-color:#0d6efd; background:#f0f6ff; }
  input[type="file"].cm-inp:disabled { cursor:not-allowed; opacity:.6; }

  .cm-lbl     { display:block; font-size:.82rem; font-weight:600; color:#495057; margin-bottom:4px; }
  .cm-lbl-opt { font-size:.75rem; font-weight:400; color:#6c757d; margin-left:4px; }
  .cm-field   { margin-bottom:.75rem; }
  .cm-field:last-child { margin-bottom:0; }

  /* Grid */
  .cm-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
  @media(max-width:520px) { .cm-grid2 { grid-template-columns:1fr; } }
  .cm-span2 { grid-column:span 2; }
  @media(max-width:520px) { .cm-span2 { grid-column:span 1; } }

  /* Search */
  .cm-search-wrap { position:relative; }
  .cm-search-ico  { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:15px; pointer-events:none; color:#6c757d; }
  .cm-search {
    width:100%; height:40px; padding:0 .75rem 0 2.5rem;
    font-size:.9rem; border:1px solid #ced4da; border-radius:6px;
    background:#fff; color:#212529; outline:none;
    transition:border-color .15s, box-shadow .15s; font-family:inherit;
  }
  .cm-search:focus { border-color:#86b7fe; box-shadow:0 0 0 3px rgba(13,110,253,.15); }
  .cm-search::placeholder { color:#adb5bd; }

  /* Table */
  .cm-table { width:100%; border-collapse:collapse; }
  .cm-table th {
    padding:.65rem 1rem; font-size:.75rem; font-weight:700; color:#6c757d;
    text-transform:uppercase; letter-spacing:.06em;
    background:#f8f9fa; border-bottom:2px solid #dee2e6; text-align:left;
    white-space:nowrap;
  }
  .cm-table td { padding:.75rem 1rem; font-size:.875rem; color:#212529; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
  .cm-tr:hover td { background:#f8f9fa; }

  /* Mobile list row */
  .cm-cust-row { display:flex; align-items:center; gap:.75rem; padding:.85rem 1rem; border-bottom:1px solid #f0f0f0; transition:background .12s; }
  .cm-cust-row:last-child { border-bottom:none; }
  .cm-cust-row:hover { background:#f8f9fa; }

  /* Avatar */
  .cm-avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,#0d6efd,#0b5ed7); color:#fff; font-size:.9rem; font-weight:700; display:flex; align-items:center; justify-content:center; }

  /* Pagination */
  .cm-page-btn { min-width:34px; height:34px; padding:0 8px; border-radius:6px; font-size:.82rem; font-weight:600; border:1px solid #dee2e6; background:#fff; color:#495057; cursor:pointer; transition:all .15s; font-family:inherit; }
  .cm-page-btn:hover:not(:disabled) { border-color:#0d6efd; color:#0d6efd; }
  .cm-page-btn.active { background:#0d6efd; border-color:#0d6efd; color:#fff; }
  .cm-page-btn:disabled { opacity:.4; cursor:not-allowed; }

  /* Modal */
  .cm-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); backdrop-filter:blur(4px); z-index:999; display:flex; align-items:center; justify-content:center; padding:1rem; animation:cm-fadein .18s ease; }
  .cm-modal { background:#fff; border-radius:12px; box-shadow:0 8px 40px rgba(0,0,0,.18); width:100%; max-width:460px; max-height:90vh; overflow-y:auto; animation:cm-fadein .2s ease; }
  .cm-modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem .75rem; border-bottom:1px solid #dee2e6; position:sticky; top:0; background:#fff; z-index:1; }
  .cm-modal-title { font-size:1.05rem; font-weight:700; color:#212529; margin:0; }
  .cm-modal-close { width:30px; height:30px; border-radius:50%; border:1px solid #dee2e6; background:transparent; color:#6c757d; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; line-height:1; font-family:inherit; }
  .cm-modal-close:hover { background:#e9ecef; color:#212529; }
  .cm-modal-body   { padding:1.25rem; }
  .cm-modal-footer { padding:.75rem 1.25rem 1rem; border-top:1px solid #dee2e6; display:flex; gap:.5rem; justify-content:flex-end; flex-wrap:wrap; }

  /* Info grid */
  .cm-info-grid  { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
  .cm-info-label { font-size:.7rem; font-weight:700; color:#6c757d; text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
  .cm-info-val   { font-size:.9rem; font-weight:500; color:#212529; }

  /* Error banner */
  .cm-error { background:#f8d7da; border:1px solid #f5c2c7; color:#842029; border-radius:8px; padding:.65rem 1rem; font-size:.875rem; font-weight:500; margin-bottom:1rem; }

  /* Divider */
  .cm-divider { border:none; border-top:1px solid #dee2e6; margin:1rem 0; }

  /* Spinner */
  .cm-spinner { width:32px; height:32px; border:3px solid #dee2e6; border-top-color:#0d6efd; border-radius:50%; animation:cm-spin .7s linear infinite; }

  /* Empty state */
  .cm-empty      { text-align:center; padding:3rem 1rem; }
  .cm-empty-icon { font-size:2.5rem; margin-bottom:.5rem; opacity:.7; }
  .cm-empty-text { font-size:1rem; font-weight:700; margin-bottom:4px; color:#212529; }
  .cm-empty-sub  { font-size:.85rem; color:#6c757d; }

  /* Responsive */
  .cm-desk { display:block; }
  .cm-mob  { display:none;  }
  @media(max-width:620px) {
    .cm-desk  { display:none  !important; }
    .cm-mob   { display:block !important; }
    .cm-wrap  { padding:.75rem; }
    .cm-title { font-size:1.2rem; }
  }
`;