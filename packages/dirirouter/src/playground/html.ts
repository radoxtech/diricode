import type { BootstrapResult } from "./types.js";
import { ModelAttributeSchema, FallbackTypeSchema } from "../picker/llm-picker/types.js";

export function renderPlayground(_data: Partial<BootstrapResult> = {}): string {
  const modelAttributes = ModelAttributeSchema.options;
  const fallbackTypes = FallbackTypeSchema.options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DiriRouter // Standalone</title>
  
  <!-- HTMX & SSE Extension -->
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://unpkg.com/htmx-ext-sse@2.2.2"></script>
  
  <!-- Alpine.js -->
  <script defer src="https://unpkg.com/alpinejs@3.14.8"></script>

  <style>
    :root {
      --bg: #1a1a2e;
      --fg: #f8fafc;
      --border: #334155;
      --accent: #38bdf8;
      --error: #ef4444;
      --success: #22c55e;
      --font-sys: system-ui, -apple-system, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
      background: #0f0f1a;
      display: flex;
      justify-content: space-between;
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
      background-color: #0f0f1a;
      font-family: var(--font-mono);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .section-title {
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
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: #cbd5e1;
    }
    
    input[type="text"], input[type="number"], select, textarea {
      width: 100%;
      background: #1e1e38;
      border: 1px solid var(--border);
      color: var(--fg);
      font-family: var(--font-mono);
      padding: 0.5rem;
      border-radius: 4px;
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
      background: #1e1e38;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 4px;
    }
    
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .slider-container { display: flex; align-items: center; gap: 1rem; }
    input[type="range"] { flex: 1; }
    
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    
    button {
      background: #1e1e38;
      color: var(--fg);
      border: 1px solid var(--border);
      padding: 0.5rem 1rem;
      font-family: var(--font-mono);
      font-weight: 600;
      cursor: pointer;
      border-radius: 4px;
    }
    
    button.primary {
      background: var(--accent);
      color: #0f0f1a;
      border-color: var(--accent);
    }
    
    .badges { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      border: 1px solid var(--border);
      background: #1e1e38;
    }
    .badge.available { border-color: var(--success); color: var(--success); }
    .badge.unavailable { border-color: var(--error); color: var(--error); }

    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--error);
      color: #fca5a5;
      padding: 1rem;
      border-radius: 4px;
      display: none;
    }
    
    .results-box {
      background: #1e1e38;
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 4px;
      overflow-y: auto;
      flex: 1;
      white-space: pre-wrap;
    }

    /* Model Toggles UI */
    .model-provider-group {
      margin-bottom: 1rem;
    }

    .model-provider-name {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent);
      margin-bottom: 0.4rem;
    }

    .model-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.3rem 0.5rem;
      border-radius: 3px;
      transition: background 0.15s;
    }

    .model-row:hover { background: #1e1e38; }

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
      width: 32px;
      height: 18px;
      flex-shrink: 0;
    }

    .toggle-switch input { opacity: 0; width: 0; height: 0; }

    .toggle-track {
      position: absolute;
      inset: 0;
      background: #334155;
      border-radius: 9px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .toggle-switch input:checked + .toggle-track { background: var(--success); }

    .toggle-track::before {
      content: "";
      position: absolute;
      width: 12px;
      height: 12px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle-switch input:checked + .toggle-track::before { transform: translateX(14px); }
    .toggle-switch input:disabled + .toggle-track { opacity: 0.4; cursor: not-allowed; }
  </style>
</head>
<body x-data="playground()">

  <header>
    <h1>DiriRouter <span>Playground</span></h1>
  </header>

  <main>
    <!-- LEFT PANEL: FORM -->
    <div class="panel panel-left">
      <form id="req-form" @submit.prevent>
        
        <div class="section-title">Task & Agent</div>
        
        <div class="form-group">
          <label>Prompt</label>
          <textarea name="prompt" required placeholder="Enter prompt..."></textarea>
        </div>

        <div class="form-row">
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
            <label>Task Type</label>
            <select name="task.type">
              <option value="code-generation">code-generation</option>
              <option value="code-review">code-review</option>
              <option value="debugging">debugging</option>
              <option value="research">research</option>
            </select>
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

        <div class="form-group">
          <label>Preferred Providers</label>
          <div class="checkbox-grid" id="pref-providers-grid">
            <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
          </div>
        </div>

        <div class="form-group">
          <label>Excluded Providers</label>
          <div class="checkbox-grid" id="excl-providers-grid">
            <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
          </div>
        </div>

        <div class="form-group">
          <label>Preferred Models</label>
          <div class="checkbox-grid" id="pref-models-grid">
            <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
          </div>
        </div>

        <div class="form-group">
          <label>Excluded Models</label>
          <div class="checkbox-grid" id="excl-models-grid">
            <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
          </div>
        </div>

        <div class="section-title">Generate Options</div>

        <div class="form-row">
          <div class="form-col">
            <label>Temperature (<span x-text="temp"></span>)</label>
            <div class="slider-container">
              <input type="range" name="temperature" min="0" max="2" step="0.1" x-model="temp">
            </div>
          </div>
          <div class="form-col">
            <label>Max Tokens</label>
            <input type="number" name="maxTokens" value="2048">
          </div>
        </div>

        <div class="actions">
          <!-- Pick Only uses hx-post and updates the results container -->
          <button type="button" 
                  hx-post="/api/pick" 
                  hx-target="#results-container"
                  hx-swap="innerHTML"
                  @click="clearErrors"
                  x-show="!loading">
            Pick Only
          </button>
          
          <!-- Pick + Chat uses custom Alpine logic to trigger SSE connection via HTMX -->
          <button type="button" class="primary"
                  @click="startChat"
                  x-show="!loading">
            Pick + Chat
          </button>
          
          <span x-show="loading" style="color: var(--accent);">Processing...</span>
        </div>
      </form>
    </div>

    <!-- RIGHT PANEL: RESULTS -->
    <div class="panel panel-right">
      
      <div class="section-title">Provider Status</div>
      <div class="badges" id="provider-status-badges">
        <span style="color:#94a3b8;font-size:0.8rem;">Loading...</span>
      </div>

      <div class="section-title">
        <span>Models</span>
        <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:0.78rem;color:#94a3b8;">
          <span x-text="enabledModelsCount"></span> of <span x-text="totalModelsCount"></span> enabled
        </span>
      </div>
      
      <div class="model-list-section">
        <template x-if="Object.keys(modelsByProvider).length === 0">
          <span style="color:#94a3b8;font-size:0.8rem;">Loading models...</span>
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

      <div class="section-title" style="margin-top: 1rem;">Results</div>
      
      <div id="error-container" class="error-box"></div>

      <div id="results-container" class="results-box">
        <span style="opacity: 0.5;">// Output will appear here...</span>
      </div>

      <!-- Hidden container for HTMX SSE to connect -->
      <div id="sse-container"></div>
    </div>
  </main>

  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.data('playground', () => ({
        temp: 0.7,
        loading: false,
        
        modelsByProvider: {},
        enabledModelsCount: 0,
        totalModelsCount: 0,
        
        init() {
          this.loadData();
        },
        
        async loadData() {
          try {
            // Load status
            const sRes = await fetch('/api/status');
            if (sRes.ok) {
              const data = await sRes.json();
              const providers = data.providers || [];
              
              // Render badges
              document.getElementById('provider-status-badges').innerHTML = providers.map(p => 
                \`<div class="badge \${p.available ? 'available' : 'unavailable'}">\${p.name} (\${p.envVar})</div>\`
              ).join('');
              
              // Render provider checkboxes
              const provHtml = providers.map(p => 
                \`<label class="checkbox-label"><input type="checkbox" name="constraints.preferredProviders[]" value="\${p.name}"> \${p.name}</label>\`
              ).join('');
              document.getElementById('pref-providers-grid').innerHTML = provHtml;
              
              const exclProvHtml = providers.map(p => 
                \`<label class="checkbox-label"><input type="checkbox" name="constraints.excludedProviders[]" value="\${p.name}"> \${p.name}</label>\`
              ).join('');
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
              
              // Render preferred/excluded models for form constraints
              const modHtml = modelCards.map(m => 
                \`<label class="checkbox-label"><input type="checkbox" name="constraints.preferredModels[]" value="\${m.id}"> \${m.id}</label>\`
              ).join('');
              document.getElementById('pref-models-grid').innerHTML = modHtml;
              
              const exclModHtml = modelCards.map(m => 
                \`<label class="checkbox-label"><input type="checkbox" name="constraints.excludedModels[]" value="\${m.id}"> \${m.id}</label>\`
              ).join('');
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

        async startChat() {
          this.loading = true;
          this.clearErrors();
          
          const form = document.getElementById('req-form');
          const results = document.getElementById('results-container');
          const sseContainer = document.getElementById('sse-container');
          
          results.innerHTML = '';
          sseContainer.innerHTML = '';
          
          try {
            // Because SSE via HTMX doesn't trivially support sending a complex JSON POST body to initiate a stream,
            // and the prompt says "Pick + Chat submits to /api/chat and displays SSE stream",
            // we'll POST first to get an ID or if the endpoint expects form-data, we can just use HTMX.
            // But we will manually POST the JSON, then set up the SSE connection.
            
            const formData = new FormData(form);
            const data = {
              agent: { role: formData.get('agent.role') },
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
                excludedModels: formData.getAll('constraints.excludedModels[]')
              },
              prompt: formData.get('prompt'),
              temperature: parseFloat(formData.get('temperature')),
              maxTokens: parseInt(formData.get('maxTokens'), 10)
            };

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

            // Read HTML response which contains the SSE setup from server
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
      
      // Handle SSE events defined in Reference (pick, chunk, done, error)
      document.body.addEventListener('htmx:sseMessage', (evt) => {
        const results = document.getElementById('results-container');
        const type = evt.detail.type;
        const data = evt.detail.data;
        
        if (type === 'pick') {
          try {
            const pickData = JSON.parse(data);
            let pickHtml = \`<div style="color:var(--accent); margin-bottom:1rem;">\`;
            if (pickData.selected) {
              pickHtml += \`<strong>Model:</strong> \${pickData.selected.provider}/\${pickData.selected.model} (Score: \${pickData.selected.score})<br>\`;
            }
            if (pickData.classificationTrace) {
              pickHtml += \`<strong>Trace:</strong> \${pickData.classificationTrace.classification} (Tier \${pickData.classificationTrace.tierUsed})\`;
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
