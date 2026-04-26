import type { BootstrapResult } from "./types.js";
import { ModelAttributeSchema, FallbackTypeSchema } from "../llm-picker/types.js";

export function renderPlayground(_data: Partial<BootstrapResult> = {}): string {
  const modelAttributes = ModelAttributeSchema.options;
  const fallbackTypes = FallbackTypeSchema.options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DiriRouter // Standalone</title>
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@500;700;800&display=swap" rel="stylesheet">
  
  <!-- HTMX & SSE Extension -->
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://unpkg.com/htmx-ext-sse@2.2.2"></script>
  <script src="https://unpkg.com/htmx-ext-json-enc@2.0.0"></script>
  
  <!-- Alpine.js -->
  <script defer src="https://unpkg.com/alpinejs@3.14.8"></script>

  <style>
    :root {
      --bg: #0b0c10;
      --fg: #e2e8f0;
      --border: #232736;
      --accent: #00f2fe;
      --accent-dim: rgba(0, 242, 254, 0.15);
      --bg-panel: #12141c;
      --error: #ff2a5f;
      --success: #39ff14;
      --font-sys: 'Syne', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sys);
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: #0f1015;
      display: flex;
      justify-content: space-between;
    }
    
    h1 {
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    h1 span {
      font-weight: 500;
      color: var(--accent);
    }

    main {
      display: flex;
      flex: 1;
      overflow: hidden;
      max-width: 1600px;
      margin: 0 auto;
      width: 100%;
    }

    .panel {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }
    
    .panel-left {
      border-right: 1px solid var(--border);
      max-width: 50%;
    }
    
    .panel-right {
      background-color: var(--bg-panel);
      font-family: var(--font-mono);
      display: flex;
      flex-direction: column;
      gap: 0;
      overflow-y: auto;
    }

    /* Tab Bar */
    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.5rem;
    }
    
    .tab-btn {
      background: transparent;
      color: #64748b;
      border: none;
      padding: 0.75rem 1.5rem;
      font-family: var(--font-sys);
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      border-radius: 0;
    }
    
    .tab-btn:hover {
      color: var(--fg);
    }
    
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    .section-title {
      font-family: var(--font-sys);
      font-weight: 700;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 1rem;
      border-bottom: 1px dashed var(--border);
      padding-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .form-group { margin-bottom: 1rem; }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-col { flex: 1; }
    
    label {
      display: block;
      font-family: var(--font-sys);
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
      color: #cbd5e1;
    }
    
    input[type="text"], input[type="number"], select, textarea {
      width: 100%;
      background: #151821;
      border: 1px solid var(--border);
      color: var(--fg);
      font-family: var(--font-mono);
      padding: 0.6rem;
      border-radius: 4px;
      transition: border-color 0.2s;
    }
    
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    textarea { min-height: 80px; resize: vertical; }

    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.5rem;
      background: #151821;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 4px;
    }
    
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-sys);
      font-size: 0.85rem;
      cursor: pointer;
      color: #94a3b8;
      transition: color 0.2s;
    }
    
    .checkbox-label:hover {
      color: var(--fg);
    }

    .scrollable-menu {
      max-height: 150px;
      overflow-y: auto;
      background: #151821;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.5rem;
    }
    
    .scrollable-menu .checkbox-label {
      padding: 0.35rem 0.5rem;
      border-radius: 3px;
      margin-bottom: 0.25rem;
    }
    
    .scrollable-menu .checkbox-label:hover {
      background: #1e2230;
    }
    
    .scrollable-menu .checkbox-label:last-child {
      margin-bottom: 0;
    }
    
    .scrollable-menu::-webkit-scrollbar {
      width: 8px;
    }
    
    .scrollable-menu::-webkit-scrollbar-track {
      background: #151821;
      border-radius: 4px;
    }
    
    .scrollable-menu::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }
    
    .scrollable-menu::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }

    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px dashed var(--border);
    }
    
    button {
      background: #151821;
      color: var(--fg);
      border: 1px solid var(--border);
      padding: 0.6rem 1.2rem;
      font-family: var(--font-sys);
      font-size: 0.9rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    button:hover {
      border-color: var(--fg);
    }
    
    button.primary {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    
    button.primary:hover {
      background: #00d2de;
      border-color: #00d2de;
    }

    /* Error box */
    .error-box {
      background: rgba(255, 42, 95, 0.1);
      border: 1px solid var(--error);
      color: #fca5a5;
      padding: 1rem;
      border-radius: 4px;
      display: none;
      font-family: var(--font-mono);
      font-size: 0.85rem;
    }

    /* Results / Output */
    .output-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .output-box {
      background: #151821;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      overflow-y: auto;
      flex: 1;
      white-space: pre-wrap;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      min-height: 0;
    }

    .output-placeholder {
      opacity: 0.4;
      font-style: italic;
    }

    /* Decision Visualization */
    .decision-viz {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      display: none;
    }
    
    .decision-viz.visible {
      display: block;
    }
    
    .decision-viz-title {
      font-family: var(--font-sys);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }
    
    .trace-pipeline {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    
    .trace-step {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: #64748b;
    }
    
    .trace-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--border);
      color: var(--fg);
      font-size: 0.7rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    
    .trace-num.final {
      background: var(--success);
      color: #000;
    }
    
    .trace-text {
      flex: 1;
    }
    
    .trace-arrow {
      color: var(--accent);
      font-size: 0.9rem;
    }
    
    .trace-count {
      color: var(--accent);
      font-weight: 700;
    }
    
    .trace-model {
      color: var(--success);
      font-weight: 700;
    }

    /* Pick Result UI */
    .pick-result { display: flex; flex-direction: column; gap: 1.25rem; }
    .pick-summary {
      background: var(--accent-dim);
      border: 1px solid var(--accent);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      font-family: var(--font-sys);
      font-size: 0.95rem;
      color: var(--fg);
    }
    .pick-summary strong { color: var(--accent); }
    .result-card {
      background: #151821;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
    }
    .result-card-title {
      font-family: var(--font-sys);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }
    .selected-model-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .selected-model-name {
      font-family: var(--font-mono);
      font-size: 1rem;
      font-weight: 700;
      color: var(--success);
    }
    .score-badge {
      background: var(--border);
      color: var(--fg);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.5rem;
    }
    .breakdown-item {
      background: #0f1015;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.5rem;
      text-align: center;
    }
    .breakdown-item.negative { border-color: rgba(255,42,95,0.4); }
    .breakdown-label {
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .breakdown-value {
      font-family: var(--font-mono);
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--fg);
      margin-top: 0.25rem;
    }
    .breakdown-item.negative .breakdown-value { color: #ff6b8a; }
    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .steps-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    .steps-list li::before {
      content: "→";
      color: var(--accent);
      font-weight: 700;
      flex-shrink: 0;
    }
    .excluded-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-height: 200px;
      overflow-y: auto;
    }
    .excluded-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #94a3b8;
      background: rgba(255,42,95,0.05);
      border: 1px solid rgba(255,42,95,0.15);
      border-radius: 4px;
      padding: 0.4rem 0.6rem;
    }
    .excluded-model { font-family: var(--font-mono); color: #fca5a5; flex-shrink: 0; }
    .excluded-reason { color: #94a3b8; }
    .cost-impact {
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    .runner-ups-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .runner-ups-table th, .runner-ups-table td {
      text-align: left;
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .runner-ups-table th {
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
    }
    .runner-ups-table td { color: #cbd5e1; }

    .semantic-compare-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      margin-bottom: 1rem;
    }
    .semantic-compare-table th, .semantic-compare-table td {
      text-align: left;
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .semantic-compare-table th {
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
    }
    .semantic-compare-table td { color: #cbd5e1; }
    .semantic-compare-table tr.selected-row {
      border-left: 2px solid #22c55e;
      background: rgba(34, 197, 94, 0.05);
    }
    .score-high { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .score-med { background: rgba(234, 179, 8, 0.15); color: #eab308; }
    .score-low { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

    .cascade-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      margin-top: 0.5rem;
    }
    .cascade-item {
      display: flex;
      align-items: stretch;
      gap: 1rem;
      position: relative;
      background: #151821;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .cascade-icon {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: bold;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }
    .cascade-item.success {
      border-color: rgba(57, 255, 20, 0.4);
      background: rgba(57, 255, 20, 0.05);
    }
    .cascade-item.success .cascade-icon {
      background: var(--success);
      color: #0f1015;
    }
    .cascade-item.fallback .cascade-icon {
      background: #f59e0b;
      color: #0f1015;
    }
    .cascade-item.skipped {
      opacity: 0.7;
    }
    .cascade-item.skipped .cascade-icon {
      background: #334155;
      color: #94a3b8;
    }
    .cascade-body {
      font-size: 0.9rem;
      color: #cbd5e1;
      line-height: 1.5;
      flex: 1;
    }
    .cascade-title {
      font-family: var(--font-sys);
      font-weight: 700;
      margin-bottom: 0.25rem;
      color: var(--fg);
    }
    .cascade-item.success .cascade-title {
      color: var(--success);
    }
    .cascade-item.fallback .cascade-title {
      color: #fcd34d;
    }
    .cascade-item.skipped .cascade-title {
      color: #94a3b8;
    }
    .cascade-line {
      position: absolute;
      left: 2rem;
      top: 3.5rem;
      bottom: -1rem;
      width: 2px;
      background: var(--border);
    }
    .cascade-item.success + .cascade-item .cascade-line {
      background: linear-gradient(to bottom, var(--success), var(--border));
    }

    .semantic-flow {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin: 1rem 0;
    }
    .semantic-flow-step {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      position: relative;
      padding: 0.75rem 1rem;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 6px;
      width: 100%;
    }
    .semantic-flow-step:not(:last-child)::after {
      content: "↓";
      position: absolute;
      bottom: -1.3rem;
      left: 1.5rem;
      top: auto;
      right: auto;
      transform: none;
      color: var(--accent);
      font-size: 1.2rem;
      font-weight: 700;
      z-index: 1;
    }
    .sfs-label {
      font-size: 0.6rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.4rem;
    }
    .sfs-value {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--fg);
      background: #0b0c10;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.3rem 0.5rem;
      word-break: break-word;
      width: 100%;
    }
    .sfs-value.highlight {
      border-color: var(--accent);
      color: var(--accent);
    }
    .bridge-tag {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 0.65rem;
      background: rgba(0, 242, 254, 0.1);
      border: 1px solid rgba(0, 242, 254, 0.3);
      color: var(--accent);
      border-radius: 3px;
      padding: 0.15rem 0.35rem;
      margin: 0.15rem;
    }
    .attr-grid {
      display: grid;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .attr-row {
      display: grid;
      grid-template-columns: 140px repeat(var(--model-count, 3), 1fr);
      gap: 0.4rem;
      align-items: center;
    }
    .attr-row-header {
      font-size: 0.65rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .attr-name {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .attr-cell {
      text-align: center;
      font-size: 0.8rem;
      padding: 0.2rem;
      border-radius: 3px;
    }
    .attr-cell.has {
      color: var(--success);
      background: rgba(57, 255, 20, 0.08);
    }
    .attr-cell.missing {
      color: #64748b;
      background: rgba(255, 255, 255, 0.02);
    }
    .model-col-header {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--fg);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .model-col-header.selected-col {
      color: var(--success);
      font-weight: 700;
    }
    .method-badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.5rem;
      border-radius: 3px;
    }
    .method-badge.bridge {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }
    .method-badge.embeddings {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #a78bfa;
    }
    .method-badge.deberta {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #60a5fa;
    }
    /* Provider Status in Config Tab */
    .provider-status-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .provider-status-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.8rem;
      background: #151821;
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    
    .provider-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .provider-dot.available {
      background: var(--success);
      box-shadow: 0 0 6px var(--success);
    }
    
    .provider-dot.unavailable {
      background: var(--error);
    }
    
    .provider-name {
      font-family: var(--font-sys);
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--fg);
      flex: 1;
    }
    
    .provider-env {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #475569;
    }

    /* Model Toggles in Config Tab */
    .model-provider-group {
      margin-bottom: 1.5rem;
      background: #151821;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }

    .model-provider-name {
      font-family: var(--font-sys);
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      padding: 0.6rem 0.8rem;
      background: #1a1d27;
      border-bottom: 1px solid var(--border);
    }

    .model-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.8rem;
      transition: background 0.15s;
    }
    
    .model-row + .model-row {
      border-top: 1px dashed var(--border);
    }

    .model-row:hover { background: rgba(255,255,255,0.02); }

    .model-row.disabled .model-id {
      color: #475569;
      text-decoration: line-through;
    }

    .model-id {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: #cbd5e1;
      transition: color 0.15s;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }

    .toggle-switch input { opacity: 0; width: 0; height: 0; }

    .toggle-track {
      position: absolute;
      inset: 0;
      background: var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .toggle-switch input:checked + .toggle-track { background: var(--success); }

    .toggle-track::before {
      content: "";
      position: absolute;
      width: 14px;
      height: 14px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle-switch input:checked + .toggle-track::before { transform: translateX(16px); }
    .toggle-switch input:disabled + .toggle-track { opacity: 0.4; cursor: not-allowed; }
    
    /* Tab content visibility */
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body x-data="playground()">

  <header>
    <h1>DiriRouter <span>Playground</span></h1>
  </header>

  <main>
    <!-- LEFT PANEL: TABBED INTERFACE -->
    <div class="panel panel-left">
      
      <!-- Tab Bar -->
      <div class="tab-bar">
        <button class="tab-btn" :class="activeTab === 'picker' ? 'active' : ''" @click="activeTab = 'picker'">
          Picker Form
        </button>
        <button class="tab-btn" :class="activeTab === 'config' ? 'active' : ''" @click="activeTab = 'config'">
          Subscription Config
        </button>
      </div>

      <!-- TAB: PICKER FORM -->
      <div class="tab-content" :class="activeTab === 'picker' ? 'active' : ''">
        <form id="req-form" @submit.prevent hx-ext="json-enc">
          
          <div class="section-title">Task & Agent</div>
          
          <div class="form-group">
            <label>Prompt</label>
            <textarea name="prompt" required placeholder="Enter prompt..."></textarea>
          </div>

          <div class="form-row">
            <div class="form-col">
              <label>Agent ID</label>
              <input type="text" name="agent.id" value="playground-agent" placeholder="playground-agent">
            </div>
            <div class="form-col">
              <label>Agent Role</label>
              <select name="agent.role">
                <option value="coder">coder</option>
                <option value="architect">architect</option>
                <option value="researcher">researcher</option>
                <option value="reviewer">reviewer</option>
              </select>
            </div>
            <div class="form-col">
              <label>Agent Seniority</label>
              <select name="agent.seniority">
                <option value="junior">junior</option>
                <option value="mid" selected>mid</option>
                <option value="senior">senior</option>
                <option value="lead">lead</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-col">
              <label>Task Type</label>
              <select name="task.type">
                <option value="code-generation">code-generation</option>
                <option value="code-review">code-review</option>
                <option value="debugging">debugging</option>
                <option value="research">research</option>
              </select>
            </div>
            <div class="form-col">
              <label>Agent Specializations (comma separated)</label>
              <input type="text" name="agent.specializations" placeholder="e.g. react, nodejs">
            </div>
          </div>

          <div class="section-title">Model Dimensions</div>

          <div class="form-row">
            <div class="form-col">
              <label>Tier</label>
              <select name="modelDimensions.tier">
                <option value="heavy">heavy</option>
                <option value="medium" selected>medium</option>
                <option value="low">low</option>
              </select>
            </div>
            <div class="form-col">
              <label>Fallback Type</label>
              <select name="modelDimensions.fallbackType">
                <option value="none">none</option>
                ${fallbackTypes.map((f) => '<option value="' + f + '">' + f + "</option>").join("")}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Model Attributes</label>
            <div class="checkbox-grid">
              ${modelAttributes.map((attr) => '<label class="checkbox-label"><input type="checkbox" name="modelDimensions.modelAttributes[]" value="' + attr + '"> ' + attr + "</label>").join("")}
            </div>
          </div>

          <div class="section-title">Constraints</div>

          <div class="form-row">
            <div class="form-col">
              <label>Context Tier</label>
              <select name="constraints.contextTier">
                <option value="">any</option>
                <option value="standard">standard (≤200k)</option>
                <option value="extended">extended (200k–800k)</option>
                <option value="massive">massive (800k+)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Preferred Providers <span style="font-weight:400;color:#94a3b8">(available only)</span></label>
            <div class="scrollable-menu" id="pref-providers-grid">
              <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
            </div>
          </div>

          <div class="form-group">
            <label>Excluded Providers <span style="font-weight:400;color:#94a3b8">(available only)</span></label>
            <div class="scrollable-menu" id="excl-providers-grid">
              <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
            </div>
          </div>

          <div class="form-group">
            <label>Preferred Models <span style="font-weight:400;color:#94a3b8">(by family)</span></label>
            <div class="scrollable-menu" id="pref-models-grid">
              <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
            </div>
          </div>

          <div class="form-group">
            <label>Excluded Models <span style="font-weight:400;color:#94a3b8">(by family)</span></label>
            <div class="scrollable-menu" id="excl-models-grid">
              <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
            </div>
          </div>

          <div class="actions">
            <button type="button" @click="pickOnly" x-show="!loading">Pick Only</button>
            <button type="button" class="primary" @click="startChat" x-show="!loading">Pick + Chat</button>
            <span x-show="loading" style="color: var(--accent);">Processing...</span>
          </div>
        </form>
      </div>

      <!-- TAB: SUBSCRIPTION CONFIG -->
      <div class="tab-content" :class="activeTab === 'config' ? 'active' : ''">
        
        <div class="section-title">Provider Status</div>
        <div class="provider-status-list" id="provider-status-list">
          <span style="color:#94a3b8;font-size:0.85rem;">Loading...</span>
        </div>

        <div class="section-title">
          <span>Models</span>
          <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:0.78rem;color:#94a3b8;">
            <span x-text="enabledModelsCount"></span> of <span x-text="totalModelsCount"></span> enabled
          </span>
        </div>
        
        <div class="model-list-section">
          <template x-if="Object.keys(modelsByProvider).length === 0">
            <span style="color:#94a3b8;font-size:0.85rem;">Loading models...</span>
          </template>
          
          <template x-for="[provider, models] in Object.entries(modelsByProvider)" :key="provider">
            <div class="model-provider-group">
              <div class="model-provider-name" x-text="provider"></div>
              <template x-for="model in models" :key="model.id">
                <div class="model-row" :class="model.enabled ? '' : 'disabled'">
                  <span class="model-id" x-text="model.id"></span>
                  <label class="toggle-switch" :title="model.enabled ? 'Disable' : 'Enable'">
                    <input type="checkbox" x-model="model.enabled" @change="toggleModel(model)">
                    <span class="toggle-track"></span>
                  </label>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL: OUTPUT + DECISION VIZ -->
    <div class="panel panel-right">
      
      <!-- Decision Visualization -->
      <div class="decision-viz" id="decision-viz">
        <div class="decision-viz-title">Decision Path</div>
        <div class="trace-pipeline" id="trace-pipeline">
          <template x-if="decisionTrace.length === 0">
            <span style="color:#475569;font-size:0.8rem;font-family:var(--font-mono);">No decision yet — run Pick or Pick+Chat</span>
          </template>
          <template x-for="(step, i) in decisionTrace" :key="i">
            <div class="trace-step">
              <span class="trace-num" :class="step.final ? 'final' : ''" x-text="i + 1"></span>
              <span class="trace-text" x-text="step.label"></span>
              <span class="trace-count" x-show="step.count !== undefined" x-text="'(' + step.count + ')'"></span>
              <span class="trace-arrow" x-show="!step.final">→</span>
              <span class="trace-model" x-show="step.final" x-text="'✓ ' + step.value"></span>
            </div>
          </template>
        </div>
      </div>
      
      <!-- Error -->
      <div id="error-container" class="error-box" style="margin: 1rem 1.5rem 0;"></div>

      <!-- Output -->
      <div class="output-section" style="padding: 1rem 1.5rem 1.5rem;">
        <div class="section-title" style="border-bottom: none; margin-bottom: 0.75rem;">Output</div>
        <div id="results-container" class="output-box">
          <span class="output-placeholder">// Output will appear here...</span>
        </div>
      </div>

      <!-- Hidden container for HTMX SSE -->
      <div id="sse-container"></div>
    </div>
  </main>

  <script>
    function escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    document.addEventListener('alpine:init', () => {
      Alpine.data('playground', () => ({
        loading: false,
        activeTab: 'picker',
        
        modelsByProvider: {},
        enabledModelsCount: 0,
        totalModelsCount: 0,
        decisionTrace: [],
        
        init() {
          this.loadData();
        },
        
        async loadData() {
          try {
            // Load status → provider list
            const sRes = await fetch('/api/status');
            if (sRes.ok) {
              const data = await sRes.json();
              const providers = data.providers || [];
              
              // Render provider status list (for config tab)
              const provListEl = document.getElementById('provider-status-list');
              if (provListEl) {
                provListEl.innerHTML = providers.map(p => 
                  \`<div class="provider-status-item">
                    <span class="provider-dot \${p.available ? 'available' : 'unavailable'}"></span>
                    <span class="provider-name">\${p.name}</span>
                    <span class="provider-env">\${p.envVar}</span>
                  </div>\`
                ).join('');
              }
              
              // Render preferred/excluded provider grids (for picker tab)
              const availableProviders = providers.filter(p => p.available);
              const provHtml = availableProviders.length > 0
                ? availableProviders.map(p => 
                    \`<label class="checkbox-label"><input type="checkbox" name="constraints.preferredProviders[]" value="\${p.name}"> \${p.name}</label>\`
                  ).join('')
                : '<span style="color:#64748b;font-size:0.8rem;">No available providers</span>';
              document.getElementById('pref-providers-grid').innerHTML = provHtml;
              
              const exclProvHtml = availableProviders.length > 0
                ? availableProviders.map(p => 
                    \`<label class="checkbox-label"><input type="checkbox" name="constraints.excludedProviders[]" value="\${p.name}"> \${p.name}</label>\`
                  ).join('')
                : '<span style="color:#64748b;font-size:0.8rem;">No available providers</span>';
              document.getElementById('excl-providers-grid').innerHTML = exclProvHtml;
            }
            
            // Load models
            const mRes = await fetch('/api/models');
            if (mRes.ok) {
              const data = await mRes.json();
              const modelCards = data.availabilities || data.modelCards || [];
              
              this.totalModelsCount = modelCards.length;
              this.enabledModelsCount = modelCards.filter(m => m.enabled).length;
              
              const grouped = {};
              for (const m of modelCards) {
                const provider = m.provider || 'unknown';
                if (!grouped[provider]) grouped[provider] = [];
                grouped[provider].push({ ...m });
              }
              this.modelsByProvider = grouped;
              
              // Unique families for constraint grids
              const uniqueFamilies = [...new Set(modelCards.map(m => m.family))].sort();
              const modHtml = uniqueFamilies.length > 0
                ? uniqueFamilies.map(family => 
                    \`<label class="checkbox-label"><input type="checkbox" name="constraints.preferredModels[]" value="\${family}"> \${family}</label>\`
                  ).join('')
                : '<span style="color:#64748b;font-size:0.8rem;">No models available</span>';
              document.getElementById('pref-models-grid').innerHTML = modHtml;
              
              const exclModHtml = uniqueFamilies.length > 0
                ? uniqueFamilies.map(family => 
                    \`<label class="checkbox-label"><input type="checkbox" name="constraints.excludedModels[]" value="\${family}"> \${family}</label>\`
                  ).join('')
                : '<span style="color:#64748b;font-size:0.8rem;">No models available</span>';
              document.getElementById('excl-models-grid').innerHTML = exclModHtml;
            }
          } catch(e) {
            console.error('Failed to load data', e);
          }
        },
        
        async toggleModel(model) {
          this.enabledModelsCount = model.enabled ? this.enabledModelsCount + 1 : this.enabledModelsCount - 1;
          try {
            const res = await fetch('/api/models/toggle', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ modelId: model.id })
            });
            if (!res.ok) {
              model.enabled = !model.enabled;
              this.enabledModelsCount = model.enabled ? this.enabledModelsCount + 1 : this.enabledModelsCount - 1;
            }
          } catch (e) {
            model.enabled = !model.enabled;
            this.enabledModelsCount = model.enabled ? this.enabledModelsCount + 1 : this.enabledModelsCount - 1;
          }
        },
        
        clearErrors() {
          const err = document.getElementById('error-container');
          err.style.display = 'none';
          err.innerText = '';
        },
        
        showError(msg, actionable = "") {
          const err = document.getElementById('error-container');
          err.style.display = 'block';
          err.innerHTML = \`<strong>Error:</strong> \${msg}<br>\${actionable ? \`<span style="color:#f87171">\${actionable}</span>\` : ''}\`;
        },

        getFormData() {
          const form = document.getElementById('req-form');
          const formData = new FormData(form);
          const contextTierStr = formData.get('constraints.contextTier');

          const specRaw = formData.get('agent.specializations');
          const specializations = specRaw 
            ? specRaw.split(',').map(s => s.trim()).filter(Boolean) 
            : [];

          return {
            agent: { 
              id: formData.get('agent.id') || 'playground-agent',
              role: formData.get('agent.role'),
              seniority: formData.get('agent.seniority'),
              specializations
            },
            task: { type: formData.get('task.type'), description: formData.get('prompt') },
            modelDimensions: {
              tier: formData.get('modelDimensions.tier'),
              modelAttributes: formData.getAll('modelDimensions.modelAttributes[]'),
              fallbackType: formData.get('modelDimensions.fallbackType') === 'none' ? null : formData.get('modelDimensions.fallbackType')
            },
            constraints: {
              preferredProviders: formData.getAll('constraints.preferredProviders[]'),
              excludedProviders: formData.getAll('constraints.excludedProviders[]'),
              preferredModels: formData.getAll('constraints.preferredModels[]'),
              excludedModels: formData.getAll('constraints.excludedModels[]'),
              contextTier: contextTierStr || undefined
            },
            prompt: formData.get('prompt')
          };
        },
        
        buildDecisionTrace(pickData) {
          const trace = [];
          const totalModels = this.totalModelsCount;
          const enabledModels = this.enabledModelsCount;
          
          trace.push({ label: \`Starting pool: \${totalModels} total models\`, count: totalModels });
          trace.push({ label: \`Filtered to enabled: \${enabledModels} models\`, count: enabledModels });
          
          if (pickData.classificationTrace) {
            const ct = pickData.classificationTrace;
            trace.push({ label: \`Classification: \${ct.classification} (tier \${ct.tierUsed})\` });
          }
          
          if (pickData.selected) {
            trace.push({ 
              label: \`Scored & ranked\`, 
              final: false 
            });
            trace.push({ 
              label: \`Selected: \${pickData.selected.provider}/\${pickData.selected.model}\`, 
              value: \`\${pickData.selected.provider}/\${pickData.selected.model}\`,
              final: true 
            });
          } else if (pickData.candidates && pickData.candidates.length > 0) {
            trace.push({ label: \`Ranked candidates: \${pickData.candidates.length}\`, final: false });
            if (pickData.candidates[0]) {
              trace.push({ 
                label: \`Top pick: \${pickData.candidates[0].provider}/\${pickData.candidates[0].model}\`,
                value: \`\${pickData.candidates[0].provider}/\${pickData.candidates[0].model}\`,
                final: true 
              });
            }
          }
          
          return trace;
        },

        renderPickResult(pickData) {
          const explanation = pickData.selectionExplanation;
          const selected = pickData.selected;
          const candidates = pickData.candidates || [];
          const excluded = candidates.filter(c => c.status === 'excluded');
          const runnerUps = candidates.filter(c => c.status === 'runner_up');
          
          let html = '<div class="pick-result">';
          
          if (explanation) {
            html += \`<div class="pick-summary">\${escapeHtml(explanation.summary)}</div>\`;
          }
          
          if (selected) {
            html += '<div class="result-card">';
            html += '<div class="result-card-title">Selected Model</div>';
            html += \`<div class="selected-model-row">\`;
            html += \`<span class="selected-model-name">\${escapeHtml(selected.provider)}/\${escapeHtml(selected.model)}</span>\`;
            html += \`<span class="score-badge">score \${selected.score}</span>\`;
            html += \`</div>\`;
            
            const bd = candidates.find(c => c.provider === selected.provider && c.model === selected.model)?.scoresBreakdown;
            if (bd) {
              html += '<div class="breakdown-grid">';
              html += \`<div class="breakdown-item"><div class="breakdown-label">Quality</div><div class="breakdown-value">\${bd.quality}</div></div>\`;
              html += \`<div class="breakdown-item"><div class="breakdown-label">Capability</div><div class="breakdown-value">\${bd.capabilityMatch}</div></div>\`;
              html += \`<div class="breakdown-item"><div class="breakdown-label">Latency</div><div class="breakdown-value">\${bd.latency}</div></div>\`;
              html += \`<div class="breakdown-item \${bd.cost < 0 ? 'negative' : ''}"><div class="breakdown-label">Cost</div><div class="breakdown-value">\${bd.cost}</div></div>\`;
              if (bd.overkillPenalty !== undefined) {
                html += \`<div class="breakdown-item negative"><div class="breakdown-label">Overkill</div><div class="breakdown-value">\${bd.overkillPenalty}</div></div>\`;
              }
              if (bd.semanticBoost !== undefined && bd.semanticBoost > 0) {
                html += \`<div class="breakdown-item" style="border-color:var(--accent);"><div class="breakdown-label" style="color:var(--accent);">AI Match</div><div class="breakdown-value">\${bd.semanticBoost}</div></div>\`;
              }
              html += '</div>';

              if (bd.semanticSimilarity !== undefined) {
                const pct = Math.round(bd.semanticSimilarity * 100);
                const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
                const matchLabel = bd.modelAttributesMatched ? \`matched: "\${bd.modelAttributesMatched}"\` : '';
                html += \`<div style="margin-top:0.75rem;padding:0.5rem;background:#0f172a;border-radius:4px;">\`;
                html += \`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">\`;
                html += \`<span style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">🧠 Semantic Match \${matchLabel}</span>\`;
                html += \`<span style="font-size:0.85rem;font-weight:700;color:\${color};">\${pct}%</span>\`;
                html += \`</div>\`;
                html += \`<div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">\`;
                html += \`<div style="height:100%;width:\${pct}%;background:\${color};border-radius:3px;transition:width 0.3s;"></div>\`;
                html += \`</div>\`;
                html += \`<div style="font-size:0.7rem;color:#64748b;margin-top:0.25rem;">Agent skills → model attributes: "\${bd.agentSpecializationsMatched}"</div>\`;
                html += \`</div>\`;
              }
            }
            html += '</div>';
          }
          
          if (explanation) {
            if (explanation.cascadeSteps && explanation.cascadeSteps.length > 0) {
              html += '<div class="result-card" style="border:none;background:transparent;padding:0;">';
              html += '<div class="result-card-title">Decision Trace (Cascade Path)</div>';
              html += '<div class="cascade-list">';
              for (let i = 0; i < explanation.cascadeSteps.length; i++) {
                const step = explanation.cascadeSteps[i];
                const isLast = i === explanation.cascadeSteps.length - 1;
                const status = step.includes('Skipped') ? 'skipped' : step.includes('Success') ? 'success' : 'fallback';
                const icon = status === 'skipped' ? '⊘' : status === 'success' ? '✓' : '↓';
                
                const match = step.match(/^(Tier \\d+):\\s*(.*)$/);
                const title = match ? match[1] : \`Step \${i + 1}\`;
                const msg = match ? match[2] : step;

                html += \`<div class="cascade-item \${status}">\`;
                html += \`<div class="cascade-icon">\${icon}</div>\`;
                html += \`<div class="cascade-body">\`;
                html += \`<div class="cascade-title">\${escapeHtml(title)}</div>\`;
                html += \`\${escapeHtml(msg)}\`;
                html += \`</div>\`;
                if (!isLast) {
                  html += '<div class="cascade-line"></div>';
                }
                html += '</div>';
              }
              html += '</div>';
              html += '</div>';
            }

            const selectedBd = selected ? candidates.find(c => c.provider === selected.provider && c.model === selected.model)?.scoresBreakdown : null;

            html += '<div class="result-card">';
            html += '<div class="result-card-title">Decision Steps</div>';
            html += '<ul class="steps-list">';
            for (const step of explanation.steps) {
              html += \`<li>\${escapeHtml(step)}</li>\`;
            }
            html += '</ul>';

            if (pickData.classifierComparison) {
              const cc = pickData.classifierComparison;
              html += '<div style="margin:1rem 0;padding:1rem;background:#0f172a;border-radius:8px;border:1px solid var(--border);">';
              html += '<div style="font-size:0.75rem;font-weight:700;color:#94a3b8;margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em;">Zero-Shot Classifier Comparison</div>';
              html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:0.75rem;">';

              html += '<div>';
              html += \`<div style="font-size:0.7rem;color:#60a5fa;font-weight:600;margin-bottom:0.4rem;">\${escapeHtml(cc.debertaModelName)}</div>\`;
              if (cc.debertaPrimaryTags && cc.debertaPrimaryTags.length > 0) {
                for (const tag of cc.debertaPrimaryTags.slice(0, 4)) {
                  const score = tag.score;
                  const barColor = score >= 0.7 ? '#22c55e' : score >= 0.4 ? '#eab308' : '#94a3b8';
                  html += \`<div style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;font-size:0.7rem;">\`;
                  html += \`<span style="color:#cbd5e1;min-width:70px;">\${escapeHtml(tag.tag)}</span>\`;
                  html += \`<div style="flex:1;height:5px;background:#1e293b;border-radius:2px;"><div style="height:100%;width:\${Math.round(score * 100)}%;background:\${barColor};border-radius:2px;"></div></div>\`;
                  html += \`<span style="color:\${barColor};font-family:var(--font-mono);min-width:35px;text-align:right;">\${Math.round(score * 100)}%</span>\`;
                  html += \`</div>\`;
                }
              } else {
                html += '<div style="color:#64748b;font-size:0.7rem;">no scores available</div>';
              }
              html += '</div>';

              html += '<div>';
              html += \`<div style="font-size:0.7rem;color:#a78bfa;font-weight:600;margin-bottom:0.4rem;">\${escapeHtml(cc.modernBertModelName)}</div>\`;
              if (cc.modernBertPrimaryTags && cc.modernBertPrimaryTags.length > 0) {
                for (const tag of cc.modernBertPrimaryTags.slice(0, 4)) {
                  const score = tag.score;
                  const barColor = score >= 0.7 ? '#22c55e' : score >= 0.4 ? '#eab308' : '#94a3b8';
                  html += \`<div style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;font-size:0.7rem;">\`;
                  html += \`<span style="color:#cbd5e1;min-width:70px;">\${escapeHtml(tag.tag)}</span>\`;
                  html += \`<div style="flex:1;height:5px;background:#1e293b;border-radius:2px;"><div style="height:100%;width:\${Math.round(score * 100)}%;background:\${barColor};border-radius:2px;"></div></div>\`;
                  html += \`<span style="color:\${barColor};font-family:var(--font-mono);min-width:35px;text-align:right;">\${Math.round(score * 100)}%</span>\`;
                  html += \`</div>\`;
                }
              } else {
                html += '<div style="color:#64748b;font-size:0.7rem;">model unavailable</div>';
              }
              html += '</div>';

              html += '</div>';

              html += \`<div style="display:flex;gap:1rem;font-size:0.7rem;color:#94a3b8;">\`;
              html += \`<span><span style="color:#22c55e;">◆</span> \${cc.agreementCount} agreed</span>\`;
              html += \`<span><span style="color:#eab308;">◆</span> \${cc.disagreementCount} disagreed</span>\`;
              html += '</div>';

              html += '</div>';
            }

            if (explanation.tierUsed === 2 && selectedBd && selectedBd.semanticSimilarity !== undefined) {
              html += '<li style="list-style:none; margin:1rem 0; padding:1rem; background:#1e293b; border-radius:8px; border:1px solid var(--border);">';
                
                const hasDeberta = selectedBd.debertaTagScores && selectedBd.debertaTagScores.length > 0;
                const method = hasDeberta ? 'deberta' : (selectedBd.bridgeConceptsUsed && selectedBd.bridgeConceptsUsed.length > 0 ? 'bridge' : 'embeddings');
                html += \`<div style="margin-bottom:1rem;"><span class="method-badge \${method}">\${method === 'deberta' ? '🧠 DeBERTa NLI' : method === 'bridge' ? '🔗 Bridge Concepts' : '🧮 Neural Embeddings'}</span></div>\`;
                
                html += '<div class="semantic-flow" style="margin-bottom:1.5rem;">';
                html += '<div class="semantic-flow-step">';
                html += '<div class="sfs-label">Agent Skills</div>';
                html += \`<div class="sfs-value">\${escapeHtml(selectedBd.agentSpecializationsMatched || '—')}</div>\`;
                html += '</div>';
                
                if (method === 'bridge' && selectedBd.bridgeConceptsUsed) {
                  html += '<div class="semantic-flow-step">';
                  html += '<div class="sfs-label">Keywords Found</div>';
                  html += '<div>';
                  const uniquePhrases = [...new Set(selectedBd.bridgeConceptsUsed.map(b => b.phrase))];
                  for (const phrase of uniquePhrases.slice(0, 5)) {
                    html += \`<span class="bridge-tag">"\${escapeHtml(phrase)}"</span>\`;
                  }
                  html += '</div>';
                  html += '</div>';
                  
                  html += '<div class="semantic-flow-step">';
                  html += '<div class="sfs-label">Mapped To Attributes</div>';
                  html += '<div>';
                  const uniqueAttrs = [...new Set(selectedBd.bridgeConceptsUsed.map(b => b.attribute))];
                  for (const attr of uniqueAttrs) {
                    const topScore = Math.max(...selectedBd.bridgeConceptsUsed.filter(b => b.attribute === attr).map(b => b.score));
                    const barColor = topScore >= 0.8 ? '#22c55e' : topScore >= 0.5 ? '#eab308' : '#94a3b8';
                    html += \`<div style="display:flex;align-items:center;gap:0.4rem;margin:0.15rem 0;">\`;
                    html += \`<span class="bridge-tag" style="border-color:\${barColor};color:\${barColor};">\${escapeHtml(attr)}</span>\`;
                    html += \`<div style="flex:1;height:4px;background:#0f172a;border-radius:2px;min-width:30px;"><div style="height:100%;width:\${Math.round(topScore * 100)}%;background:\${barColor};border-radius:2px;"></div></div>\`;
                    html += \`<span style="font-size:0.6rem;color:\${barColor};font-family:var(--font-mono);">\${Math.round(topScore * 100)}%</span>\`;
                    html += \`</div>\`;
                  }
                  html += '</div>';
                  html += '</div>';
                } else {
                  html += '<div class="semantic-flow-step">';
                  html += '<div class="sfs-label">AI Compared Against</div>';
                  html += \`<div class="sfs-value">all \${(selectedBd.matchedAttributesList?.length || 0) + (selectedBd.missingAttributesList?.length || 0)} requested attributes</div>\`;
                  html += '</div>';
                }
                
                html += '<div class="semantic-flow-step">';
                html += '<div class="sfs-label">Best Match</div>';
                html += \`<div class="sfs-value highlight">\${escapeHtml(selectedBd.modelAttributesMatched || '—')}</div>\`;
                html += '</div>';
                html += '</div>';

                if (hasDeberta && selectedBd.debertaTagScores) {
                  html += '<div class="semantic-flow-step" style="margin-top:1rem;">';
                  html += '<div class="sfs-label">DeBERTa Tag Scores</div>';
                  html += '<div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.5rem;">';
                  for (const tagScore of selectedBd.debertaTagScores.slice(0, 6)) {
                    const score = tagScore.score;
                    const barColor = score >= 0.7 ? '#22c55e' : score >= 0.4 ? '#eab308' : '#94a3b8';
                    html += \`<div style="display:flex;align-items:center;gap:0.5rem;">\`;
                    html += \`<span style="font-family:var(--font-mono);font-size:0.7rem;color:#cbd5e1;min-width:80px;">\${escapeHtml(tagScore.tag)}</span>\`;
                    html += \`<div style="flex:1;height:6px;background:#0f172a;border-radius:3px;min-width:40px;"><div style="height:100%;width:\${Math.round(score * 100)}%;background:\${barColor};border-radius:3px;"></div></div>\`;
                    html += \`<span style="font-size:0.65rem;color:\${barColor};font-family:var(--font-mono);min-width:35px;text-align:right;">\${Math.round(score * 100)}%</span>\`;
                    html += \`</div>\`;
                  }
                  html += '</div>';
                  html += '</div>';
                }

                const semCandidates = candidates
                  .filter(c => c.status !== 'excluded' && c.scoresBreakdown && c.scoresBreakdown.semanticSimilarity !== undefined)
                  .sort((a, b) => (b.scoresBreakdown?.semanticSimilarity || 0) - (a.scoresBreakdown?.semanticSimilarity || 0))
                  .slice(0, 5);

                if (semCandidates.length > 0) {
                  html += '<div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1rem;">';
                  for (const c of semCandidates) {
                    const isSelected = selected && c.provider === selected.provider && c.model === selected.model;
                    const bd = c.scoresBreakdown;
                    const sim = bd?.semanticSimilarity || 0;
                    let scoreClass = 'score-low';
                    if (sim >= 0.7) scoreClass = 'score-high';
                    else if (sim >= 0.4) scoreClass = 'score-med';
                    const boost = bd?.semanticBoost || 0;
                    const boostStr = boost > 0 ? '+' + boost.toFixed(1) : '—';
                    const attrMatched = bd?.modelAttributesMatched || '—';
                    const bridgeCount = bd?.bridgeConceptsUsed?.length || 0;
                    const bridgeStr = bridgeCount > 0 ? bridgeCount + ' concepts' : '—';
                    const selStyle = isSelected ? 'border-left:3px solid #22c55e;background:rgba(34,197,94,0.05);' : '';
                    
                    html += \`<div style="padding:0.75rem;border:1px solid var(--border);border-radius:6px;background:#151821;\${selStyle}">\`;
                    html += \`<div style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;margin-bottom:0.5rem;color:\${isSelected ? '#22c55e' : 'var(--fg)'};">\${escapeHtml(c.model)}</div>\`;
                    html += \`<div style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.75rem;">\`;
                    html += \`<div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Semantic Score</span><span class="\${scoreClass}" style="padding:0.1rem 0.4rem;border-radius:3px;font-weight:700;">\${Math.round(sim * 100)}%</span></div>\`;
                    html += \`<div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Boost</span><span>\${boostStr}</span></div>\`;
                    html += \`<div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Best Matched</span><span style="color:#cbd5e1;">\${escapeHtml(attrMatched)}</span></div>\`;
                    html += \`<div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Bridge</span><span style="color:#94a3b8;">\${bridgeStr}</span></div>\`;
                    html += \`</div></div>\`;
                  }
                  html += '</div>';
                }

                const comparisonModels = [
                  candidates.find(c => c.status === 'selected'),
                  ...candidates.filter(c => c.status === 'runner_up').slice(0, 2)
                ].filter(Boolean);
                
                const requestedAttrs = selectedBd.matchedAttributesList || [];
                const allRequestedAttrs = [...requestedAttrs, ...(selectedBd.missingAttributesList || [])];
                
                if (allRequestedAttrs.length > 0 && comparisonModels.length > 1) {
                  html += \`<div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1rem;">\`;
                  for (const attr of allRequestedAttrs) {
                    html += \`<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;">\`;
                    html += \`<div style="background:#0f1015;padding:0.4rem 0.75rem;font-family:var(--font-mono);font-size:0.75rem;font-weight:700;border-bottom:1px solid var(--border);">\${escapeHtml(attr)}</div>\`;
                    html += \`<div style="display:flex;flex-direction:column;">\`;
                    for (const m of comparisonModels) {
                      const isSelected = m.status === 'selected';
                      const bd = m.scoresBreakdown;
                      const has = bd?.matchedAttributesList?.includes(attr);
                      const selBg = isSelected ? 'background:rgba(255,255,255,0.02);' : '';
                      html += \`<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.75rem;\${selBg}">\`;
                      html += \`<span style="color:\${isSelected ? '#22c55e' : '#cbd5e1'};font-family:var(--font-mono);">\${escapeHtml(m.model)}</span>\`;
                      html += \`<span style="padding:0.1rem 0.4rem;border-radius:3px;background:\${has ? 'rgba(57,255,20,0.08)' : 'rgba(255,255,255,0.02)'};color:\${has ? 'var(--success)' : '#64748b'};font-weight:700;">\${has ? '✓' : '✗'}</span>\`;
                      html += \`</div>\`;
                    }
                    html += \`</div></div>\`;
                  }
                  html += \`</div>\`;
                }

                html += '</li>';
              }
            html += '</ul>';
            html += '</div>';
            
            html += '<div class="result-card">';
            html += '<div class="result-card-title">Why This Model?</div>';
            html += \`<div style="font-size:0.85rem;color:#cbd5e1;line-height:1.5;white-space:pre-wrap;font-family:monospace;">\${escapeHtml(explanation.whySelected)}</div>\`;
            html += '</div>';
            
            if (explanation.costImpact) {
              html += '<div class="result-card">';
              html += '<div class="result-card-title">Cost Impact</div>';
              html += \`<div class="cost-impact">\${escapeHtml(explanation.costImpact)}</div>\`;
              html += '</div>';
            }
          }
          
          if (runnerUps.length > 0 || selected) {
            html += '<div class="result-card">';
            html += '<div class="result-card-title">Winner & Runner-ups</div>';
            html += '<table class="runner-ups-table"><thead><tr><th>Model</th><th>Score</th><th>Capability</th><th>Attrs Matched</th></tr></thead><tbody>';
            
            const tableRows = [];
            const winner = candidates.find(c => c.status === 'selected');
            if (winner) {
              tableRows.push({ ...winner, isWinner: true });
            }
            tableRows.push(...runnerUps.slice(0, 5));

            for (const r of tableRows) {
              const rbd = r.scoresBreakdown;
              const capVal = rbd ? rbd.capabilityMatch : '—';
              const matchedCount = rbd?.matchedAttributesList?.length || 0;
              const totalCount = matchedCount + (rbd?.missingAttributesList?.length || 0);
              const attrDisplay = totalCount > 0 ? \`\${matchedCount}/\${totalCount}\` : '—';
              
              if (r.isWinner) {
                html += \`<tr style="background:rgba(34,197,94,0.1);"><td style="border-left:3px solid #22c55e;"><strong style="color:#22c55e;">\${escapeHtml(r.provider)}/\${escapeHtml(r.model)}</strong></td><td style="font-weight:bold;color:#22c55e;">\${r.score}</td><td style="font-weight:bold;">\${capVal}</td><td style="font-weight:bold;">\${attrDisplay}</td></tr>\`;
              } else {
                html += \`<tr><td>\${escapeHtml(r.provider)}/\${escapeHtml(r.model)}</td><td>\${r.score}</td><td>\${capVal}</td><td>\${attrDisplay}</td></tr>\`;
              }
            }
            html += '</tbody></table>';
            html += '</div>';
          }
          
          if (excluded.length > 0) {
            html += '<div class="result-card">';
            html += \`<div class="result-card-title">Excluded Models (\${excluded.length})</div>\`;
            html += '<div class="excluded-list">';
            for (const e of excluded.slice(0, 20)) {
              html += \`<div class="excluded-item"><span class="excluded-model">\${escapeHtml(e.provider)}/\${escapeHtml(e.model)}</span><span class="excluded-reason">\${escapeHtml(e.rejectionReason || '')}</span></div>\`;
            }
            if (excluded.length > 20) {
              html += \`<div style="font-size:0.75rem;color:#64748b;padding:0.25rem 0;">...and \${excluded.length - 20} more</div>\`;
            }
            html += '</div>';
            html += '</div>';
          }
          
          html += '</div>';
          return html;
        },

        async pickOnly() {
          this.loading = true;
          this.clearErrors();
          this.decisionTrace = [];
          
          const results = document.getElementById('results-container');
          const sseContainer = document.getElementById('sse-container');
          const vizEl = document.getElementById('decision-viz');
          results.innerHTML = '<span class="output-placeholder">Running picker...</span>';
          vizEl.classList.remove('visible');
          sseContainer.innerHTML = '';
          
          try {
            const data = this.getFormData();
            const res = await fetch('/api/pick', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            const json = await res.json();
            
            if (!res.ok) {
              this.showError(json.error || 'Failed to pick model', json.actionable || JSON.stringify(json.details || json));
              results.innerHTML = '';
            } else {
              this.decisionTrace = this.buildDecisionTrace(json);
              vizEl.classList.add('visible');
              results.innerHTML = this.renderPickResult(json);
            }
          } catch(e) {
            this.showError('Network Error', e.message);
            results.innerHTML = '';
          } finally {
            this.loading = false;
          }
        },

        async startChat() {
          this.loading = true;
          this.clearErrors();
          this.decisionTrace = [];
          
          const results = document.getElementById('results-container');
          const sseContainer = document.getElementById('sse-container');
          const vizEl = document.getElementById('decision-viz');
          results.innerHTML = '';
          vizEl.classList.remove('visible');
          sseContainer.innerHTML = '';
          
          try {
            const data = this.getFormData();

            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              this.showError(errData.error || 'Failed to start chat', errData.actionable || 'Check server logs');
              this.loading = false;
              return;
            }

            const html = await res.text();
            sseContainer.innerHTML = html;
            htmx.process(sseContainer);
            
          } catch(e) {
            this.showError('Network Error', e.message);
          } finally {
            this.loading = false;
          }
        }
      }));
      
      // Global error handler for HTMX
      document.body.addEventListener('htmx:responseError', (evt) => {
        const err = document.getElementById('error-container');
        err.style.display = 'block';
        err.innerHTML = \`<strong>API Error (\${evt.detail.xhr.status}):</strong> \${evt.detail.xhr.responseText}\`;
      });
      
      // Handle SSE events
      document.body.addEventListener('htmx:sseMessage', (evt) => {
        const results = document.getElementById('results-container');
        const vizEl = document.getElementById('decision-viz');
        const type = evt.detail.type;
        const data = evt.detail.data;
        const alpine = document.querySelector('[x-data]').__x.$data;
        
        if (type === 'pick') {
          try {
            const pickData = JSON.parse(data);

            // Build and show decision trace
            const trace = alpine.buildDecisionTrace(pickData);
            alpine.decisionTrace = trace;
            vizEl.classList.add('visible');

            // Show full visualization with cascade path
            results.innerHTML = alpine.renderPickResult(pickData) + '<hr style="border:1px dashed var(--border);margin:1rem 0;"><div id="chat-stream"></div>';
          } catch(e) {}
        } else if (type === 'chunk') {
          const streamContainer = document.getElementById('chat-stream');
          if (streamContainer) {
            streamContainer.appendChild(document.createTextNode(data));
          } else {
            results.appendChild(document.createTextNode(data));
          }
        } else if (type === 'error') {
          const err = document.getElementById('error-container');
          err.style.display = 'block';
          err.innerHTML = \`<strong>Stream Error:</strong> \${data}\`;
        }
      });
    });
  </script>
</body>
</html>`;
}
