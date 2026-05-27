'use strict';

/* ═══════════════════════════════════════════════
   1. STATE
   ═══════════════════════════════════════════════ */

const state = {
  panels: [],
  characters: [],
};

/* ═══════════════════════════════════════════════
   2. STORAGE
   ═══════════════════════════════════════════════ */

const STORAGE_KEY = 'panelcraft_state_v1';

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('PanelCraft: Could not save state.', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.panels))     state.panels     = saved.panels;
    if (Array.isArray(saved.characters)) state.characters = saved.characters;
  } catch (e) { console.warn('PanelCraft: Could not load state.', e); }
}

/* ═══════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════ */

function uid() {
  return 'pc-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════
   3. RENDER
   ═══════════════════════════════════════════════ */

const DOM = {};

function renderTimeline() {
  const timeline = DOM.timeline;
  const endDrop  = DOM.endDrop;

  const existingCards = [...timeline.querySelectorAll('.panel-card')];
  const stateIds      = state.panels.map(p => p.id);

  existingCards.forEach(c => { if (!stateIds.includes(c.dataset.id)) c.remove(); });

  state.panels.forEach((panel, idx) => {
    let card = timeline.querySelector(`[data-id="${panel.id}"]`);
    if (!card) {
      card = createCardElement(panel);
    } else {
      syncCardFields(card, panel);
    }
    const desired = timeline.children[idx];
    if (desired !== card) timeline.insertBefore(card, endDrop);
    card.querySelector('.panel-card__number').textContent = `#${idx + 1}`;
  });

  DOM.timelineEmpty.classList.toggle('visible', state.panels.length === 0);
  DOM.panelCount.textContent = `${state.panels.length} panel${state.panels.length !== 1 ? 's' : ''}`;
}

function createCardElement(panel) {
  const template = document.getElementById('panel-card-template');
  const card     = template.content.cloneNode(true).querySelector('.panel-card');

  card.dataset.id    = panel.id;
  card.dataset.scene = panel.sceneType;
  card.setAttribute('draggable', 'true');

  // Scene type select
  const select = card.querySelector('.panel-card__scene-select');
  select.value = panel.sceneType;
  select.addEventListener('change', e => onSceneTypeChange(panel.id, e.target.value));

  // Notes textarea
  const notes = card.querySelector('.panel-card__notes');
  notes.value = panel.notes;
  notes.addEventListener('input', e => onNotesChange(panel.id, e.target.value));

  // Image upload
  const imgInput    = card.querySelector('.panel-card__img-input');
  const imgPreview  = card.querySelector('.panel-card__img-preview');
  const placeholder = card.querySelector('.panel-card__img-placeholder');

  if (panel.imageDataUrl) {
    imgPreview.src = panel.imageDataUrl;
    imgPreview.style.display  = 'block';
    placeholder.style.display = 'none';
  }

  imgInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const p = state.panels.find(p => p.id === panel.id);
      if (p) p.imageDataUrl = ev.target.result;
      imgPreview.src = ev.target.result;
      imgPreview.style.display  = 'block';
      placeholder.style.display = 'none';
      saveState();
    };
    reader.readAsDataURL(file);
  });

  // Delete
  card.querySelector('.panel-card__delete').addEventListener('click', () => deletePanel(panel.id));

  // Drag & drop
  attachDragListeners(card);

  // Character tags
  renderCharTagsOnCard(card, panel);

  return card;
}

function syncCardFields(card, panel) {
  const select = card.querySelector('.panel-card__scene-select');
  if (document.activeElement !== select) select.value = panel.sceneType;
  card.dataset.scene = panel.sceneType;

  const notes = card.querySelector('.panel-card__notes');
  if (document.activeElement !== notes) notes.value = panel.notes;

  renderCharTagsOnCard(card, panel);
}

function renderCharTagsOnCard(card, panel) {
  const container = card.querySelector('.panel-card__char-tags');
  container.innerHTML = '';

  if (state.characters.length === 0) {
    container.insertAdjacentHTML('beforeend',
      `<span style="font-size:.65rem;color:var(--text-muted)">No characters yet</span>`);
    return;
  }

  state.characters.forEach(char => {
    const isActive = panel.characters.includes(char.id);
    const tag = document.createElement('div');
    tag.className = 'char-tag' + (isActive ? ' active' : '');
    tag.style.setProperty('--tag-color', char.color);
    tag.style.background  = char.color + '22';
    tag.style.borderColor = isActive ? char.color : 'transparent';
    tag.style.color       = char.color;
    tag.title = `${char.name} (${char.role}) – click to toggle`;
    tag.innerHTML = `<span class="char-tag__dot" style="background:${char.color};"></span>${char.name}`;
    tag.addEventListener('click', () => toggleCharacterOnPanel(panel.id, char.id));
    container.appendChild(tag);
  });
}

function renderCharacterList() {
  DOM.charList.innerHTML = '';

  state.characters.forEach(char => {
    const li = document.createElement('li');
    li.className = 'char-item';
    li.dataset.id = char.id;
    li.innerHTML = `
      <span class="char-item__dot" style="background:${char.color};color:${char.color};"></span>
      <div class="char-item__info">
        <div class="char-item__name">${escapeHtml(char.name)}</div>
        <div class="char-item__role">${escapeHtml(char.role || '—')}</div>
      </div>
      <button class="char-item__delete" aria-label="Delete ${escapeHtml(char.name)}">✕</button>
    `;
    li.querySelector('.char-item__delete').addEventListener('click', () => deleteCharacter(char.id));
    DOM.charList.appendChild(li);
  });

  DOM.charCount.textContent = `${state.characters.length} character${state.characters.length !== 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════════════
   4. PACING ENGINE
   ═══════════════════════════════════════════════ */

const SCENE_COLORS = {
  'Action'   : '#f87171',
  'Dialogue' : '#60a5fa',
  'Suspense' : '#c084fc',
  'Lore Drop': '#fbbf24',
};

const SCENE_BAR_CLASS = {
  'Action'   : 'action',
  'Dialogue' : 'dialogue',
  'Suspense' : 'suspense',
  'Lore Drop': 'lore',
};

function analyzePacing() {
  const panels = state.panels;
  const total  = panels.length;

  const counts = { Action: 0, Dialogue: 0, Suspense: 0, 'Lore Drop': 0 };
  panels.forEach(p => { if (counts[p.sceneType] !== undefined) counts[p.sceneType]++; });

  DOM.pacingBars.innerHTML   = '';
  DOM.pacingLegend.innerHTML = '';

  Object.keys(counts).forEach(type => {
    const pct = total === 0 ? 0 : Math.round((counts[type] / total) * 100);

    if (pct > 0) {
      const bar = document.createElement('div');
      bar.className = `pacing-bar pacing-bar--${SCENE_BAR_CLASS[type]}`;
      bar.style.width = pct + '%';
      bar.title = `${type}: ${pct}%`;
      DOM.pacingBars.appendChild(bar);
    }

    const legend = document.createElement('div');
    legend.className = 'pacing-legend-item';
    legend.innerHTML = `
      <span class="pacing-legend-dot" style="background:${SCENE_COLORS[type]};"></span>
      ${type} ${pct}%
    `;
    DOM.pacingLegend.appendChild(legend);
  });

  showPacingAlert(checkPacingAlerts(panels));
}

function checkPacingAlerts(panels) {
  if (panels.length < 2) return null;

  // WIN: Suspense immediately followed by Lore Drop
  for (let i = 1; i < panels.length; i++) {
    if (panels[i - 1].sceneType === 'Suspense' && panels[i].sceneType === 'Lore Drop') {
      return { type: 'win', message: '🔥 High Engagement Zone created! (Suspense → Lore Drop)' };
    }
  }

  // WARN: 3+ consecutive Dialogue panels
  let run = 0;
  for (let i = 0; i < panels.length; i++) {
    run = panels[i].sceneType === 'Dialogue' ? run + 1 : 0;
    if (run >= 3) {
      return { type: 'warn', message: '⚠️ High chance of slow pacing. Consider adding a visual hook or action panel.' };
    }
  }

  return null;
}

let alertTimer = null;

function showPacingAlert(alert) {
  clearTimeout(alertTimer);
  const el = DOM.pacingAlert;

  if (!alert) { el.classList.remove('pacing-alert--visible', 'pacing-alert--win'); return; }

  el.textContent = alert.message;
  el.classList.remove('pacing-alert--win');
  if (alert.type === 'win') el.classList.add('pacing-alert--win');
  el.classList.add('pacing-alert--visible');

  if (alert.type === 'win') {
    alertTimer = setTimeout(() => el.classList.remove('pacing-alert--visible'), 5000);
  }
}

/* ═══════════════════════════════════════════════
   5. DRAG & DROP
   ═══════════════════════════════════════════════ */

let dragSrcCard  = null;
let dragSrcIndex = -1;

function attachDragListeners(card) {
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragover',  onDragOver);
  card.addEventListener('drop',      onDrop);
  card.addEventListener('dragend',   onDragEnd);
}

function onDragStart(e) {
  dragSrcCard  = this;
  dragSrcIndex = state.panels.findIndex(p => p.id === this.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
  requestAnimationFrame(() => this.classList.add('dragging'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this !== dragSrcCard) this.classList.add('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  if (!dragSrcCard || this === dragSrcCard) return;
  this.classList.remove('drag-over');
  reorderPanels(dragSrcCard.dataset.id, this.dataset.id);
}

function onDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragSrcCard  = null;
  dragSrcIndex = -1;
}

function setupEndDropZone() {
  DOM.endDrop.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    DOM.endDrop.classList.add('drag-over');
  });
  DOM.endDrop.addEventListener('dragleave', () => DOM.endDrop.classList.remove('drag-over'));
  DOM.endDrop.addEventListener('drop', e => {
    e.preventDefault();
    DOM.endDrop.classList.remove('drag-over');
    if (dragSrcCard) reorderPanels(dragSrcCard.dataset.id, undefined);
  });
}

/* ═══════════════════════════════════════════════
   6. PANEL CRUD
   ═══════════════════════════════════════════════ */

function addPanel() {
  const panel = { id: uid(), sceneType: 'Action', notes: '', characters: [], imageDataUrl: null };
  state.panels.push(panel);
  commitMutation();
  return panel;
}

function deletePanel(id) {
  const idx = state.panels.findIndex(p => p.id === id);
  if (idx === -1) return;
  state.panels.splice(idx, 1);
  commitMutation();
}

function reorderPanels(srcId, destId) {
  const panels  = state.panels;
  const srcIdx  = panels.findIndex(p => p.id === srcId);
  if (srcIdx === -1) return;
  const [moved] = panels.splice(srcIdx, 1);
  if (!destId) {
    panels.push(moved);
  } else {
    const destIdx = panels.findIndex(p => p.id === destId);
    panels.splice(destIdx === -1 ? panels.length : destIdx, 0, moved);
  }
  commitMutation();
}

function onSceneTypeChange(id, sceneType) {
  const panel = state.panels.find(p => p.id === id);
  if (!panel) return;
  panel.sceneType = sceneType;
  const card = DOM.timeline.querySelector(`[data-id="${id}"]`);
  if (card) card.dataset.scene = sceneType;
  commitMutation();
}

let notesTimer = null;
function onNotesChange(id, notes) {
  const panel = state.panels.find(p => p.id === id);
  if (!panel) return;
  panel.notes = notes;
  clearTimeout(notesTimer);
  notesTimer = setTimeout(saveState, 400);
}

function toggleCharacterOnPanel(panelId, charId) {
  const panel = state.panels.find(p => p.id === panelId);
  if (!panel) return;
  const idx = panel.characters.indexOf(charId);
  if (idx === -1) panel.characters.push(charId); else panel.characters.splice(idx, 1);
  const card = DOM.timeline.querySelector(`[data-id="${panelId}"]`);
  if (card) renderCharTagsOnCard(card, panel);
  saveState();
}

function commitMutation() {
  renderTimeline();
  analyzePacing();
  saveState();
}

/* ═══════════════════════════════════════════════
   7. CHARACTER CRUD
   ═══════════════════════════════════════════════ */

function addCharacter() {
  const name  = DOM.charNameInput.value.trim();
  const role  = DOM.charRoleInput.value.trim();
  const color = DOM.charColorInput.value;

  if (!name) {
    DOM.charNameInput.focus();
    DOM.charNameInput.style.borderColor = '#f87171';
    setTimeout(() => DOM.charNameInput.style.borderColor = '', 1200);
    return;
  }

  state.characters.push({ id: uid(), name, role, color });
  DOM.charNameInput.value  = '';
  DOM.charRoleInput.value  = '';
  DOM.charColorInput.value = '#a78bfa';
  DOM.colorPreview.textContent = '#a78bfa';

  renderCharacterList();
  state.panels.forEach(panel => {
    const card = DOM.timeline.querySelector(`[data-id="${panel.id}"]`);
    if (card) renderCharTagsOnCard(card, panel);
  });
  saveState();
}

function deleteCharacter(id) {
  const idx = state.characters.findIndex(c => c.id === id);
  if (idx === -1) return;
  state.characters.splice(idx, 1);
  state.panels.forEach(p => {
    const ci = p.characters.indexOf(id);
    if (ci !== -1) p.characters.splice(ci, 1);
  });
  renderCharacterList();
  state.panels.forEach(panel => {
    const card = DOM.timeline.querySelector(`[data-id="${panel.id}"]`);
    if (card) renderCharTagsOnCard(card, panel);
  });
  saveState();
}

/* ═══════════════════════════════════════════════
   8. INIT
   ═══════════════════════════════════════════════ */

function cacheDOM() {
  DOM.timeline      = document.getElementById('timeline');
  DOM.endDrop       = document.getElementById('end-drop');
  DOM.timelineEmpty = document.getElementById('timeline-empty');
  DOM.panelCount    = document.getElementById('panel-count');
  DOM.pacingBars    = document.getElementById('pacing-bars');
  DOM.pacingLegend  = document.getElementById('pacing-legend');
  DOM.pacingAlert   = document.getElementById('pacing-alert');
  DOM.charList      = document.getElementById('char-list');
  DOM.charCount     = document.getElementById('char-count');
  DOM.charForm      = document.getElementById('char-form');
  DOM.charNameInput = document.getElementById('char-name');
  DOM.charRoleInput = document.getElementById('char-role');
  DOM.charColorInput= document.getElementById('char-color');
  DOM.colorPreview  = document.getElementById('color-preview');
  DOM.addPanelBtn   = document.getElementById('add-panel-btn');
  DOM.clearBtn      = document.getElementById('clear-btn');
}

function attachGlobalListeners() {
  DOM.addPanelBtn.addEventListener('click', () => {
    addPanel();
    requestAnimationFrame(() => {
      const last = DOM.timeline.querySelector('.panel-card:last-of-type');
      if (last) last.scrollIntoView({ behavior: 'smooth', inline: 'end' });
    });
  });

  DOM.clearBtn.addEventListener('click', () => {
    if (state.panels.length === 0) return;
    if (!confirm(`Delete all ${state.panels.length} panel${state.panels.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    state.panels = [];
    commitMutation();
  });

  DOM.charForm.addEventListener('submit', e => { e.preventDefault(); addCharacter(); });
  DOM.charColorInput.addEventListener('input', e => { DOM.colorPreview.textContent = e.target.value; });
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDOM();
  loadState();
  attachGlobalListeners();
  setupEndDropZone();
  renderCharacterList();
  renderTimeline();
  analyzePacing();
});
