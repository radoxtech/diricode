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
              const modelCards = data.modelCards || [];
              
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
              results.innerHTML = '<pre style="white-space: pre-wrap; word-wrap: break-word;">' + JSON.stringify(json, null, 2) + '</pre>';
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
            
            // Show structured output
            let pickHtml = \`<div style="margin-bottom: 1rem;">\`;
            if (pickData.selected) {
              pickHtml += \`<span style="color:var(--success);font-weight:700;">✓ Selected:</span>
                <span style="color:var(--accent);"> \${pickData.selected.provider}/\${pickData.selected.model}</span>
                <span style="color:#64748b;margin-left:0.5rem;">(score: \${pickData.selected.score})</span>\`;
            }
            if (pickData.classificationTrace) {
              const ct = pickData.classificationTrace;
              pickHtml += \`<br><span style="color:#64748b;">Classified as </span><span style="color:var(--fg);">\${ct.classification}</span>
                <span style="color:#64748b;"> tier </span><span style="color:var(--fg);">\${ct.tierUsed}</span>\`;
            }
            pickHtml += \`</div><hr style="border:1px dashed var(--border);margin:1rem 0;"><div id="chat-stream"></div>\`;
            results.innerHTML = pickHtml;
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
