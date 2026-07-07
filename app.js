/* ============================================================
   Teleprompter PWA — lógica principal
   ============================================================ */
'use strict';

/* ---------- Ajustes por defecto ---------- */
const DEFAULTS = {
  mode: 'fixed',          // 'fixed' (px/s) | 'duration' (tiempo total)
  speed: 80,              // px por segundo
  duration: 120,          // segundos (modo duración)
  countdown: 3,           // segundos de cuenta regresiva
  autoFullscreen: true,   // pantalla completa al reproducir
  fontSize: 64,           // px
  fontFamily: 'system-ui, sans-serif',
  bold: false,
  lineHeight: 1.5,
  letterSpacing: 0,       // px
  align: 'center',
  textColor: '#ffffff',
  bgColor: '#000000',
  marginX: 12,            // % por lado
  guide: 'line',          // 'line' | 'arrow' | 'both' | 'none'
  guidePos: 25,           // % desde arriba
  guideOpacity: 60,       // %
  guideColor: '#ff4d4d',
  mirrorX: false,
  mirrorY: false,
};

const SAMPLE_TEXT = 'Esta es una vista previa de tu teleprompter. El texto se desplaza a la velocidad configurada para que compruebes cada ajuste antes de grabar.';

let settings = loadSettings();

/* ---------- Estado del prompter ---------- */
const state = {
  playing: false,
  pos: 0,               // px recorridos desde el inicio
  totalDistance: 1,     // px totales a recorrer
  effectiveSpeed: 80,   // px/s en uso (puede venir del modo duración)
  rafId: null,
  lastTime: 0,
  countdownTimer: null,
  hideControlsTimer: null,
  wakeLock: null,
};

/* ---------- Referencias DOM ---------- */
const $ = (id) => document.getElementById(id);

const editorView = $('editor-view');
const prompterView = $('prompter-view');
const scriptInput = $('script-input');
const statsEl = $('stats');

const stage = $('prompter-stage');
const viewport = $('prompter-viewport');
const content = $('prompter-content');
const guide = $('guide');
const countdownEl = $('countdown');
const countdownNum = $('countdown-num');
const endOverlay = $('end-overlay');
const controls = $('prompter-controls');
const progressEl = $('progress');
const progressFill = $('progress-fill');
const speedDisplay = $('speed-display');
const timeDisplay = $('time-display');
const btnToggle = $('btn-toggle');

const settingsPanel = $('settings-panel');
const settingsBackdrop = $('settings-backdrop');
const previewStage = $('preview-stage');
const previewContent = $('preview-content');
const previewViewport = $('preview-viewport');
const previewGuide = $('preview-guide');

/* ============================================================
   Persistencia
   ============================================================ */
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('tp_settings') || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  localStorage.setItem('tp_settings', JSON.stringify(settings));
}

function loadText() {
  scriptInput.value = localStorage.getItem('tp_text') || '';
  updateStats();
}

function saveText() {
  localStorage.setItem('tp_text', scriptInput.value);
}

/* ============================================================
   Editor
   ============================================================ */
function updateStats() {
  const text = scriptInput.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const minutes = words / 150; // ritmo medio hablado
  const mm = Math.floor(minutes);
  const ss = Math.round((minutes - mm) * 60);
  statsEl.textContent = words
    ? `${words} palabras · ~${mm}:${String(ss).padStart(2, '0')} min hablando`
    : '';
}

scriptInput.addEventListener('input', () => {
  saveText();
  updateStats();
});

$('btn-clear').addEventListener('click', () => {
  if (scriptInput.value && !confirm('¿Borrar todo el texto?')) return;
  scriptInput.value = '';
  saveText();
  updateStats();
  scriptInput.focus();
});

/* ============================================================
   Renderizado del guion
   ============================================================ */
function renderScript(target, text) {
  target.innerHTML = '';
  const paragraphs = text.split(/\n{2,}/);
  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.textContent = para;
    target.appendChild(p);
  }
}

/* ============================================================
   Aplicar ajustes (prompter + vista previa)
   ============================================================ */
function applyTypography(el) {
  el.style.fontSize = settings.fontSize + 'px';
  el.style.fontFamily = settings.fontFamily;
  el.style.fontWeight = settings.bold ? '700' : '400';
  el.style.lineHeight = settings.lineHeight;
  el.style.letterSpacing = settings.letterSpacing + 'px';
  el.style.textAlign = settings.align;
  el.style.color = settings.textColor;
  el.style.paddingLeft = settings.marginX + '%';
  el.style.paddingRight = settings.marginX + '%';
}

function applyGuide(guideEl, viewportEl) {
  const show = settings.guide !== 'none';
  guideEl.style.display = show ? 'block' : 'none';
  if (!show) return;
  guideEl.style.top = settings.guidePos + '%';
  guideEl.style.color = settings.guideColor;
  guideEl.style.opacity = settings.guideOpacity / 100;
  guideEl.querySelector('.guide-line').style.display =
    (settings.guide === 'line' || settings.guide === 'both') ? 'block' : 'none';
  guideEl.querySelector('.guide-arrow').style.display =
    (settings.guide === 'arrow' || settings.guide === 'both') ? 'block' : 'none';
  viewportEl.style.background = settings.bgColor;
}

function applyMirror(stageEl) {
  stageEl.classList.toggle('mirror-x', settings.mirrorX);
  stageEl.classList.toggle('mirror-y', settings.mirrorY);
}

function applyAllToPrompter() {
  applyTypography(content);
  applyGuide(guide, prompterView);
  applyMirror(stage);
  prompterView.style.background = settings.bgColor;
  speedDisplay.textContent = Math.round(state.effectiveSpeed);
  $('btn-mirror').classList.toggle('active', settings.mirrorX);
  measure();
  positionContent();
  updateProgressUI();
}

/* ============================================================
   Motor de desplazamiento
   ============================================================ */
function guideY() {
  return viewport.clientHeight * settings.guidePos / 100;
}

function measure() {
  // Distancia total: todo el contenido pasa por la línea guía.
  state.totalDistance = Math.max(content.scrollHeight, 1);
}

function positionContent() {
  content.style.transform = `translateY(${guideY() - state.pos}px)`;
}

function computeEffectiveSpeed() {
  if (settings.mode === 'duration' && settings.duration > 0) {
    state.effectiveSpeed = state.totalDistance / settings.duration;
  } else {
    state.effectiveSpeed = settings.speed;
  }
}

function tick(now) {
  if (!state.playing) return;
  const dt = Math.min((now - state.lastTime) / 1000, 0.1);
  state.lastTime = now;
  state.pos += state.effectiveSpeed * dt;

  if (state.pos >= state.totalDistance) {
    state.pos = state.totalDistance;
    positionContent();
    updateProgressUI();
    finishScroll();
    return;
  }
  positionContent();
  updateProgressUI();
  state.rafId = requestAnimationFrame(tick);
}

function play() {
  if (state.playing) return;
  endOverlay.classList.add('hidden');
  if (state.pos >= state.totalDistance) state.pos = 0;
  state.playing = true;
  state.lastTime = performance.now();
  state.rafId = requestAnimationFrame(tick);
  btnToggle.textContent = '⏸';
  requestWakeLock();
  scheduleHideControls();
}

function pause() {
  state.playing = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  btnToggle.textContent = '▶';
  releaseWakeLock();
  showControls();
}

function togglePlay() {
  state.playing ? pause() : play();
}

function finishScroll() {
  pause();
  endOverlay.classList.remove('hidden');
}

function restart() {
  endOverlay.classList.add('hidden');
  state.pos = 0;
  positionContent();
  updateProgressUI();
}

function seekTo(fraction) {
  state.pos = Math.max(0, Math.min(1, fraction)) * state.totalDistance;
  endOverlay.classList.add('hidden');
  positionContent();
  updateProgressUI();
}

function nudge(seconds) {
  state.pos = Math.max(0, Math.min(state.totalDistance, state.pos + seconds * state.effectiveSpeed));
  endOverlay.classList.add('hidden');
  positionContent();
  updateProgressUI();
}

function updateProgressUI() {
  const frac = state.pos / state.totalDistance;
  progressFill.style.width = (frac * 100) + '%';
  const remaining = Math.max(0, (state.totalDistance - state.pos) / state.effectiveSpeed);
  const mm = Math.floor(remaining / 60);
  const ss = Math.floor(remaining % 60);
  timeDisplay.textContent = `-${mm}:${String(ss).padStart(2, '0')}`;
}

/* ============================================================
   Entrar / salir del prompter
   ============================================================ */
function openPrompter() {
  const text = scriptInput.value.trim();
  if (!text) {
    scriptInput.focus();
    scriptInput.placeholder = '⚠ Escribe o pega tu texto primero…';
    return;
  }
  renderScript(content, text);
  editorView.classList.add('hidden');
  prompterView.classList.remove('hidden');
  state.pos = 0;
  measure();
  computeEffectiveSpeed();
  applyAllToPrompter();

  if (settings.autoFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  startCountdown();
}

function closePrompter() {
  pause();
  cancelCountdown();
  endOverlay.classList.add('hidden');
  prompterView.classList.add('hidden');
  editorView.classList.remove('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  scriptInput.focus();
}

function startCountdown() {
  cancelCountdown();
  let n = settings.countdown;
  if (n <= 0) { play(); return; }
  countdownEl.classList.remove('hidden');
  countdownNum.textContent = n;
  state.countdownTimer = setInterval(() => {
    n--;
    if (n <= 0) {
      cancelCountdown();
      play();
    } else {
      countdownNum.textContent = n;
    }
  }, 1000);
}

function cancelCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
  countdownEl.classList.add('hidden');
}

/* ============================================================
   Controles del prompter
   ============================================================ */
$('btn-play').addEventListener('click', openPrompter);
$('btn-exit').addEventListener('click', closePrompter);
$('btn-end-edit').addEventListener('click', closePrompter);
$('btn-replay').addEventListener('click', () => { restart(); startCountdown(); });
$('btn-toggle').addEventListener('click', togglePlay);
$('btn-restart').addEventListener('click', restart);

function changeSpeed(delta) {
  settings.mode = 'fixed';
  settings.speed = Math.max(10, Math.min(400, Math.round(state.effectiveSpeed) + delta));
  computeEffectiveSpeed();
  speedDisplay.textContent = Math.round(state.effectiveSpeed);
  updateProgressUI();
  saveSettings();
  syncSettingsUI();
}

function changeFontSize(delta) {
  settings.fontSize = Math.max(24, Math.min(160, settings.fontSize + delta));
  applyTypography(content);
  measure();
  computeEffectiveSpeed();
  positionContent();
  updateProgressUI();
  saveSettings();
  syncSettingsUI();
}

$('btn-speed-up').addEventListener('click', () => changeSpeed(5));
$('btn-speed-down').addEventListener('click', () => changeSpeed(-5));
$('btn-font-up').addEventListener('click', () => changeFontSize(4));
$('btn-font-down').addEventListener('click', () => changeFontSize(-4));

$('btn-mirror').addEventListener('click', () => {
  settings.mirrorX = !settings.mirrorX;
  applyMirror(stage);
  $('btn-mirror').classList.toggle('active', settings.mirrorX);
  saveSettings();
  syncSettingsUI();
});

$('btn-fullscreen').addEventListener('click', toggleFullscreen);

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

/* Barra de progreso: clic para saltar */
progressEl.addEventListener('click', (e) => {
  const rect = progressEl.getBoundingClientRect();
  seekTo((e.clientX - rect.left) / rect.width);
});

/* Clic sobre el texto = pausa/reanuda */
viewport.addEventListener('click', () => {
  if (!countdownEl.classList.contains('hidden')) return;
  togglePlay();
});

/* Rueda del ratón = desplazamiento manual */
prompterView.addEventListener('wheel', (e) => {
  e.preventDefault();
  state.pos = Math.max(0, Math.min(state.totalDistance, state.pos + e.deltaY));
  endOverlay.classList.add('hidden');
  positionContent();
  updateProgressUI();
}, { passive: false });

/* Autoocultar controles */
function showControls() {
  controls.classList.remove('faded');
  prompterView.classList.remove('hide-cursor');
  scheduleHideControls();
}

function scheduleHideControls() {
  clearTimeout(state.hideControlsTimer);
  if (!state.playing) return;
  state.hideControlsTimer = setTimeout(() => {
    controls.classList.add('faded');
    prompterView.classList.add('hide-cursor');
  }, 2500);
}

prompterView.addEventListener('mousemove', showControls);

/* Redimensionar ventana */
window.addEventListener('resize', () => {
  if (prompterView.classList.contains('hidden')) return;
  measure();
  computeEffectiveSpeed();
  positionContent();
  updateProgressUI();
});

/* ============================================================
   Atajos de teclado
   ============================================================ */
document.addEventListener('keydown', (e) => {
  // Editor: Ctrl+Enter reproduce
  if (!editorView.classList.contains('hidden')) {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      openPrompter();
    }
    if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) {
      closeSettings();
    }
    return;
  }

  if (prompterView.classList.contains('hidden')) return;
  if (!settingsPanel.classList.contains('hidden')) {
    if (e.key === 'Escape') closeSettings();
    return;
  }

  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (countdownEl.classList.contains('hidden')) togglePlay();
      break;
    case 'ArrowUp':
      e.preventDefault();
      changeSpeed(e.shiftKey ? 20 : 5);
      break;
    case 'ArrowDown':
      e.preventDefault();
      changeSpeed(e.shiftKey ? -20 : -5);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      nudge(-3);
      break;
    case 'ArrowRight':
      e.preventDefault();
      nudge(3);
      break;
    case 'PageUp':
      e.preventDefault();
      nudge(-10);
      break;
    case 'PageDown':
      e.preventDefault();
      nudge(10);
      break;
    case 'Home':
      e.preventDefault();
      restart();
      break;
    case 'End':
      e.preventDefault();
      seekTo(1);
      break;
    case '+':
    case '=':
      changeFontSize(4);
      break;
    case '-':
      changeFontSize(-4);
      break;
    case 'f': case 'F':
      toggleFullscreen();
      break;
    case 'm': case 'M':
      $('btn-mirror').click();
      break;
    case 'Escape':
      if (!document.fullscreenElement) closePrompter();
      break;
  }
});

/* ============================================================
   Panel de ajustes + vista previa en vivo
   ============================================================ */
let previewRaf = null;
let previewPos = 0;
let previewLast = 0;

function openSettings() {
  syncSettingsUI();
  settingsPanel.classList.remove('hidden');
  settingsBackdrop.classList.remove('hidden');
  startPreview();
}

function closeSettings() {
  settingsPanel.classList.add('hidden');
  settingsBackdrop.classList.add('hidden');
  stopPreview();
  saveSettings();
}

$('btn-settings').addEventListener('click', openSettings);
$('btn-settings-2').addEventListener('click', openSettings);
$('btn-close-settings').addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', closeSettings);

function previewText() {
  const t = scriptInput.value.trim();
  if (!t) return SAMPLE_TEXT;
  const words = t.split(/\s+/).slice(0, 60).join(' ');
  return words;
}

function applyAllToPreview() {
  applyTypography(previewContent);
  applyGuide(previewGuide, previewViewport);
  applyMirror(previewStage);
  previewViewport.style.background = settings.bgColor;
}

function startPreview() {
  renderScript(previewContent, previewText());
  applyAllToPreview();
  previewPos = 0;
  previewLast = performance.now();
  cancelAnimationFrame(previewRaf);
  const loop = (now) => {
    const dt = Math.min((now - previewLast) / 1000, 0.1);
    previewLast = now;
    const speed = settings.mode === 'duration' && settings.duration > 0
      ? Math.max(20, settings.speed) // en modo duración la velocidad real depende del guion; usa referencia
      : settings.speed;
    previewPos += speed * dt;
    const total = previewContent.scrollHeight + 200;
    if (previewPos > total) previewPos = 0;
    // La guía está al guidePos% de la caja de 150px (sin escalar); dentro del wrapper
    // escalado al 40% el equivalente es /0.4.
    const guideOffset = (150 * settings.guidePos / 100) / 0.4;
    previewContent.style.transform = `translateY(${guideOffset - previewPos}px)`;
    previewRaf = requestAnimationFrame(loop);
  };
  previewRaf = requestAnimationFrame(loop);
}

function stopPreview() {
  cancelAnimationFrame(previewRaf);
  previewRaf = null;
}

/* ---------- Vincular controles de ajustes ---------- */
function bindRange(id, key, outId, fmt = (v) => v, parse = parseFloat) {
  const input = $(id);
  input.addEventListener('input', () => {
    settings[key] = parse(input.value);
    if (outId) $(outId).textContent = fmt(settings[key]);
    onSettingChanged();
  });
}

function bindCheck(id, key) {
  const input = $(id);
  input.addEventListener('change', () => {
    settings[key] = input.checked;
    onSettingChanged();
  });
}

function bindSelect(id, key) {
  const input = $(id);
  input.addEventListener('change', () => {
    settings[key] = input.value;
    onSettingChanged();
  });
}

function bindColor(id, key) {
  const input = $(id);
  input.addEventListener('input', () => {
    settings[key] = input.value;
    onSettingChanged();
  });
}

function onSettingChanged() {
  saveSettings();
  applyAllToPreview();
  $('row-speed').classList.toggle('hidden', settings.mode === 'duration');
  $('row-duration').classList.toggle('hidden', settings.mode !== 'duration');
  // Si el prompter está abierto, aplica también en vivo.
  if (!prompterView.classList.contains('hidden')) {
    computeEffectiveSpeed();
    applyAllToPrompter();
  }
}

bindSelect('set-mode', 'mode');
bindRange('set-speed', 'speed', 'out-speed', (v) => v, (v) => parseInt(v, 10));
bindRange('set-countdown', 'countdown', 'out-countdown', (v) => v, (v) => parseInt(v, 10));
bindCheck('set-autofull', 'autoFullscreen');
bindRange('set-fontsize', 'fontSize', 'out-fontsize', (v) => v, (v) => parseInt(v, 10));
bindSelect('set-font', 'fontFamily');
bindCheck('set-bold', 'bold');
bindRange('set-lineheight', 'lineHeight', 'out-lineheight', (v) => v.toFixed(1));
bindRange('set-letterspacing', 'letterSpacing', 'out-letterspacing', (v) => v);
bindSelect('set-align', 'align');
bindColor('set-textcolor', 'textColor');
bindColor('set-bgcolor', 'bgColor');
bindRange('set-margin', 'marginX', 'out-margin', (v) => v, (v) => parseInt(v, 10));
bindSelect('set-guide', 'guide');
bindRange('set-guidepos', 'guidePos', 'out-guidepos', (v) => v, (v) => parseInt(v, 10));
bindRange('set-guideopacity', 'guideOpacity', 'out-guideopacity', (v) => v, (v) => parseInt(v, 10));
bindColor('set-guidecolor', 'guideColor');
bindCheck('set-mirrorx', 'mirrorX');
bindCheck('set-mirrory', 'mirrorY');

/* Duración mm:ss */
$('set-duration').addEventListener('change', () => {
  const m = $('set-duration').value.match(/^(\d{1,3}):([0-5]\d)$/);
  if (m) {
    settings.duration = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    onSettingChanged();
  }
});

/* Presets de color */
document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.textColor = btn.dataset.text;
    settings.bgColor = btn.dataset.bg;
    syncSettingsUI();
    onSettingChanged();
  });
});

/* Restaurar valores por defecto */
$('btn-reset').addEventListener('click', () => {
  if (!confirm('¿Restaurar todos los ajustes a sus valores por defecto?')) return;
  settings = { ...DEFAULTS };
  syncSettingsUI();
  onSettingChanged();
});

/* Sincronizar UI del panel con los valores actuales */
function syncSettingsUI() {
  $('set-mode').value = settings.mode;
  $('set-speed').value = settings.speed;
  $('out-speed').textContent = settings.speed;
  const mm = Math.floor(settings.duration / 60);
  const ss = settings.duration % 60;
  $('set-duration').value = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  $('set-countdown').value = settings.countdown;
  $('out-countdown').textContent = settings.countdown;
  $('set-autofull').checked = settings.autoFullscreen;
  $('set-fontsize').value = settings.fontSize;
  $('out-fontsize').textContent = settings.fontSize;
  $('set-font').value = settings.fontFamily;
  $('set-bold').checked = settings.bold;
  $('set-lineheight').value = settings.lineHeight;
  $('out-lineheight').textContent = Number(settings.lineHeight).toFixed(1);
  $('set-letterspacing').value = settings.letterSpacing;
  $('out-letterspacing').textContent = settings.letterSpacing;
  $('set-align').value = settings.align;
  $('set-textcolor').value = settings.textColor;
  $('set-bgcolor').value = settings.bgColor;
  $('set-margin').value = settings.marginX;
  $('out-margin').textContent = settings.marginX;
  $('set-guide').value = settings.guide;
  $('set-guidepos').value = settings.guidePos;
  $('out-guidepos').textContent = settings.guidePos;
  $('set-guideopacity').value = settings.guideOpacity;
  $('out-guideopacity').textContent = settings.guideOpacity;
  $('set-guidecolor').value = settings.guideColor;
  $('set-mirrorx').checked = settings.mirrorX;
  $('set-mirrory').checked = settings.mirrorY;
  $('row-speed').classList.toggle('hidden', settings.mode === 'duration');
  $('row-duration').classList.toggle('hidden', settings.mode !== 'duration');
}

/* ============================================================
   Wake Lock — mantener pantalla encendida al reproducir
   ============================================================ */
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* sin soporte o denegado: no es crítico */ }
}

function releaseWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.playing) requestWakeLock();
});

/* ============================================================
   PWA: instalación + service worker
   ============================================================ */
let deferredInstall = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('btn-install').classList.remove('hidden');
});

$('btn-install').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('btn-install').classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ============================================================
   Inicio
   ============================================================ */
loadText();
syncSettingsUI();
scriptInput.focus();
