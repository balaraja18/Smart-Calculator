/* ══════════════════════════════════════════════
   CALC∞ — Frontend Logic
   ══════════════════════════════════════════════ */

const API = 'http://localhost:5000/api';

// ── State ──────────────────────────────────────────
let expression  = '';
let justEvaled  = false;
let currentMode = 'standard';

// ── DOM refs ──────────────────────────────────────
const exprEl      = document.getElementById('expression');
const liveEl      = document.getElementById('liveResult');
const modeLabel   = document.getElementById('modeLabel');
const sciPanel    = document.getElementById('sciPanel');
const historyList = document.getElementById('historyList');
const historyPanel= document.getElementById('historyPanel');
const keypad      = document.getElementById('keypad');

// ── Display helpers ────────────────────────────────
function updateDisplay() {
  exprEl.classList.remove('error', 'shake');
  const disp = expression || '0';
  exprEl.textContent = formatDisplay(disp);

  // Font sizing
  const len = disp.length;
  exprEl.className = exprEl.className.replace(/\b(small|xsmall)\b/g,'').trim();
  if (len > 22) exprEl.classList.add('xsmall');
  else if (len > 14) exprEl.classList.add('small');

  // Live preview
  if (expression.length > 1 && !justEvaled) {
    try {
      const prev = safeLocalEval(expression);
      liveEl.textContent = prev !== null ? '= ' + prev : '';
    } catch { liveEl.textContent = ''; }
  } else {
    liveEl.textContent = '';
  }
}

function formatDisplay(s) {
  return s.replace(/\*/g,'×').replace(/\//g,'÷');
}

function showError(msg) {
  exprEl.textContent = msg;
  exprEl.classList.add('error');
  void exprEl.offsetWidth; // reflow
  exprEl.classList.add('shake');
  liveEl.textContent = '';
  setTimeout(() => {
    exprEl.classList.remove('error','shake');
    expression = '';
    updateDisplay();
  }, 1600);
}

// ── Local eval (for live preview only) ───────────
function safeLocalEval(expr) {
  try {
    const e = expr
      .replace(/÷/g,'/')
      .replace(/×/g,'*')
      .replace(/π/g, Math.PI)
      .replace(/\^/g,'**');
    if (/[a-zA-Z]/.test(e)) return null;          // skip if has func names
    const r = Function('"use strict"; return (' + e + ')')();
    if (!isFinite(r)) return null;
    if (r === Math.trunc(r)) return r;
    return parseFloat(r.toFixed(8)).toString();
  } catch { return null; }
}

// ── Input handling ─────────────────────────────────
function appendValue(val) {
  if (justEvaled) {
    // If operator, continue; else start fresh
    if ('+-×÷*/'.includes(val)) { justEvaled = false; }
    else { expression = ''; justEvaled = false; }
  }
  expression += val;
  updateDisplay();
}

function handleAction(action) {
  switch (action) {
    case 'clear':
      expression = '';
      justEvaled = false;
      updateDisplay();
      document.getElementById('clearBtn').textContent = 'AC';
      break;

    case 'backspace':
      if (justEvaled) { expression = ''; justEvaled = false; }
      else { expression = expression.slice(0,-1); }
      updateDisplay();
      break;

    case 'equals':
      calculate();
      break;

    case 'sign':
      if (expression) {
        if (expression.startsWith('-')) expression = expression.slice(1);
        else expression = '-' + expression;
        updateDisplay();
      }
      break;

    case 'percent':
      if (expression) {
        try {
          const v = parseFloat(expression);
          if (!isNaN(v)) { expression = String(v / 100); updateDisplay(); }
        } catch {}
      }
      break;
  }
}

// ── API calculate ──────────────────────────────────
async function calculate() {
  if (!expression.trim()) return;

  // Balance parentheses
  const opens  = (expression.match(/\(/g) || []).length;
  const closes = (expression.match(/\)/g) || []).length;
  const balanced = expression + ')'.repeat(Math.max(0, opens - closes));

  try {
    const res = await fetch(`${API}/calculate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ expression: balanced })
    });
    const data = await res.json();

    if (data.error) {
      showError(data.error);
    } else {
      expression = data.result;
      justEvaled  = true;
      liveEl.textContent = '';
      updateDisplay();
      loadHistory();
    }
  } catch (err) {
    // Fallback: local eval
    const local = safeLocalEval(balanced);
    if (local !== null) {
      expression = String(local);
      justEvaled  = true;
      liveEl.textContent = '';
      updateDisplay();
    } else {
      showError('Server unreachable');
    }
  }
}

// ── History ────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch(`${API}/history?limit=40`);
    const data = await res.json();
    renderHistory(data);
  } catch {
    historyList.innerHTML = '<div class="history-empty">Backend offline</div>';
  }
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
    return;
  }
  historyList.innerHTML = items.map(item => `
    <div class="history-item" data-expr="${escHtml(item.expression)}" data-result="${escHtml(item.result)}">
      <button class="history-del" data-id="${item.id}" title="Delete">✕</button>
      <div class="history-expr">${escHtml(formatDisplay(item.expression))}</div>
      <div class="history-res">${escHtml(item.result)}</div>
      <div class="history-time">${item.timestamp}</div>
    </div>
  `).join('');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

historyList.addEventListener('click', async e => {
  const delBtn = e.target.closest('.history-del');
  if (delBtn) {
    e.stopPropagation();
    const id = delBtn.dataset.id;
    try { await fetch(`${API}/history/${id}`, { method: 'DELETE' }); } catch {}
    await loadHistory();
    return;
  }
  const item = e.target.closest('.history-item');
  if (item) {
    expression = item.dataset.expr;
    justEvaled = true;
    updateDisplay();
  }
});

document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
  try { await fetch(`${API}/history`, { method: 'DELETE' }); } catch {}
  await loadHistory();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  window.open(`${API}/export`, '_blank');
});

// ── Keyboard input ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key;

  if (k >= '0' && k <= '9') { appendValue(k); return; }
  if (['+','-','/','*','(',')','.','^','%'].includes(k)) { appendValue(k); return; }
  if (k === 'Enter' || k === '=') { e.preventDefault(); handleAction('equals'); return; }
  if (k === 'Backspace') { handleAction('backspace'); return; }
  if (k === 'Escape') { handleAction('clear'); return; }
  if (k.toLowerCase() === 'p') { appendValue('π'); return; }
  if (k.toLowerCase() === 'e') { appendValue('e'); return; }
});

// ── Button click delegation ───────────────────────
keypad.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  ripple(btn, e);

  const action = btn.dataset.action;
  const value  = btn.dataset.value;

  if (action) handleAction(action);
  else if (value !== undefined) appendValue(value);

  // Toggle AC ↔ C
  document.getElementById('clearBtn').textContent = expression ? 'C' : 'AC';
});

sciPanel.addEventListener('click', e => {
  const btn = e.target.closest('.btn-sci');
  if (!btn) return;
  ripple(btn, e);
  appendValue(btn.dataset.value);
});

document.querySelector('.utility-row').addEventListener('click', e => {
  const btn = e.target.closest('.util-btn');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action) handleAction(action);
});

// ── Ripple effect ──────────────────────────────────
function ripple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const rip  = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  const x    = (e.clientX - rect.left) - size / 2;
  const y    = (e.clientY - rect.top)  - size / 2;
  rip.style.cssText = `
    position:absolute;width:${size}px;height:${size}px;
    left:${x}px;top:${y}px;border-radius:50%;pointer-events:none;
    background:rgba(255,255,255,0.18);transform:scale(0);
    animation:rippleAnim .45s linear;
  `;
  btn.appendChild(rip);
  rip.addEventListener('animationend', () => rip.remove());
}
if (!document.getElementById('rippleStyle')) {
  const s = document.createElement('style');
  s.id = 'rippleStyle';
  s.textContent = '@keyframes rippleAnim{to{transform:scale(2.5);opacity:0;}}';
  document.head.appendChild(s);
}

// ── Mode tabs ──────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentMode = tab.dataset.mode;
    modeLabel.textContent = currentMode.toUpperCase();
    if (currentMode === 'scientific') {
      sciPanel.classList.add('visible');
    } else {
      sciPanel.classList.remove('visible');
    }
  });
});

// ── Theme toggle ───────────────────────────────────
document.getElementById('themeToggle').addEventListener('click', () => {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('calc-theme', html.dataset.theme);
});

// Restore theme
const savedTheme = localStorage.getItem('calc-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

// ── History panel toggle (mobile) ─────────────────
document.getElementById('historyToggle').addEventListener('click', () => {
  historyPanel.classList.toggle('open');
});

// ── Graph Plotter ──────────────────────────────────
const graphModal  = document.getElementById('graphModal');
const graphCanvas = document.getElementById('graphCanvas');
const ctx         = graphCanvas.getContext('2d');

document.getElementById('graphBtn').addEventListener('click', () => {
  graphModal.classList.add('open');
  // Pre-fill if expression looks graphable
  if (expression && expression.includes('x')) {
    document.getElementById('graphExpr').value = expression;
  }
});
document.getElementById('closeGraph').addEventListener('click', () => graphModal.classList.remove('open'));
graphModal.addEventListener('click', e => { if(e.target===graphModal) graphModal.classList.remove('open'); });

document.getElementById('plotBtn').addEventListener('click', plotGraph);
document.getElementById('graphExpr').addEventListener('keydown', e => {
  if (e.key === 'Enter') plotGraph();
});

function plotGraph() {
  const exprRaw = document.getElementById('graphExpr').value.trim();
  if (!exprRaw) return;

  const W = graphCanvas.offsetWidth;
  const H = graphCanvas.offsetHeight;
  graphCanvas.width  = W * devicePixelRatio;
  graphCanvas.height = H * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const isDark = document.documentElement.dataset.theme !== 'light';
  const gridCol  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const axisCol  = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
  const lineCol  = '#6c63ff';
  const textCol  = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  ctx.clearRect(0, 0, W, H);

  const xMin=-10, xMax=10, yMin=-10, yMax=10;
  const toCanvasX = x => (x - xMin) / (xMax - xMin) * W;
  const toCanvasY = y => H - (y - yMin) / (yMax - yMin) * H;

  // Grid
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  for (let gx = xMin; gx <= xMax; gx++) {
    ctx.beginPath(); ctx.moveTo(toCanvasX(gx), 0); ctx.lineTo(toCanvasX(gx), H); ctx.stroke();
  }
  for (let gy = yMin; gy <= yMax; gy++) {
    ctx.beginPath(); ctx.moveTo(0, toCanvasY(gy)); ctx.lineTo(W, toCanvasY(gy)); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = axisCol;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(toCanvasX(0), 0); ctx.lineTo(toCanvasX(0), H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, toCanvasY(0)); ctx.lineTo(W, toCanvasY(0)); ctx.stroke();

  // Labels
  ctx.fillStyle = textCol;
  ctx.font = '10px Space Mono, monospace';
  for (let i=xMin; i<=xMax; i++) {
    if (i===0) continue;
    ctx.fillText(i, toCanvasX(i)+2, toCanvasY(0)-4);
  }

  // Plot
  const expSafe = exprRaw
    .replace(/\^/g,'**')
    .replace(/π/g, Math.PI)
    .replace(/sin/g,'Math.sin')
    .replace(/cos/g,'Math.cos')
    .replace(/tan/g,'Math.tan')
    .replace(/log/g,'Math.log10')
    .replace(/ln/g,'Math.log')
    .replace(/sqrt/g,'Math.sqrt')
    .replace(/abs/g,'Math.abs')
    .replace(/(?<![a-zA-Z])e(?![a-zA-Z])/g, Math.E);

  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();

  const steps = W * 2;
  let penDown = false;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (xMax - xMin) * i / steps;
    try {
      const y = Function('x', `"use strict"; return (${expSafe})`)(x);
      if (!isFinite(y) || Math.abs(y) > yMax * 3) { penDown = false; continue; }
      const cx = toCanvasX(x), cy = toCanvasY(y);
      if (!penDown) { ctx.moveTo(cx, cy); penDown = true; }
      else ctx.lineTo(cx, cy);
    } catch { penDown = false; }
  }
  ctx.stroke();

  // Expression label
  ctx.fillStyle = lineCol;
  ctx.font = 'bold 11px Space Mono, monospace';
  ctx.fillText('y = ' + exprRaw, 10, 18);
}

// ── Voice Input ────────────────────────────────────
const voiceModal  = document.getElementById('voiceModal');
const voiceStatus = document.getElementById('voiceStatus');
const pulseRing   = document.getElementById('pulseRing');
let recognition   = null;

document.getElementById('voiceBtn').addEventListener('click', () => voiceModal.classList.add('open'));
document.getElementById('closeVoice').addEventListener('click', () => {
  voiceModal.classList.remove('open');
  if (recognition) recognition.stop();
});

document.getElementById('startVoice').addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    voiceStatus.textContent = '❌ Voice not supported in this browser.';
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart  = () => { pulseRing.classList.add('active'); voiceStatus.textContent = '🎙 Listening…'; };
  recognition.onend    = () => { pulseRing.classList.remove('active'); voiceStatus.textContent = 'Done. Click Start to try again.'; };
  recognition.onerror  = e => { voiceStatus.textContent = `Error: ${e.error}`; pulseRing.classList.remove('active'); };

  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript.toLowerCase();
    voiceStatus.textContent = `Heard: "${transcript}"`;
    const parsed = parseVoice(transcript);
    if (parsed) {
      expression = parsed;
      updateDisplay();
      voiceModal.classList.remove('open');
    } else {
      voiceStatus.textContent = `Couldn't parse: "${transcript}"`;
    }
  };
  recognition.start();
});

function parseVoice(t) {
  const words = {
    'zero':'0','one':'1','two':'2','three':'3','four':'4',
    'five':'5','six':'6','seven':'7','eight':'8','nine':'9','ten':'10',
    'plus':'+','minus':'-','times':'*','multiplied by':'*',
    'divided by':'/','over':'/',
    'squared':'**2','cubed':'**3',
    'point':'.','dot':'.',
    'pi':'π','pie':'π',
    'sine':'sin(','cosine':'cos(','tangent':'tan(',
    'square root':'sqrt(','log':'log('
  };
  let s = t;
  for (const [word, sym] of Object.entries(words)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), sym);
  }
  s = s.replace(/\s+/g,'');
  // Auto-close parens
  const opens  = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  s += ')'.repeat(Math.max(0, opens - closes));
  if (/[\d+\-*/πe().]/.test(s)) return s;
  return null;
}

// ── Init ───────────────────────────────────────────
updateDisplay();
loadHistory();
