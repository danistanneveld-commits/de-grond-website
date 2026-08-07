(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const beheerActief = params.get('beheer') === '1' || window.location.hash === '#beheer';
  if (!beheerActief) return;

  document.documentElement.dataset.beheer = 'actief';
  console.info('DE GROND beheerstand actief');

  const DRAFT_KEY = 'dgWebsiteDraftV2';
  const GITHUB_KEY = 'dgGithubSettingsV1';
  const API_VERSION = '2026-03-10';
  let githubToken = '';
  let publishAfterSettings = false;
  let saveTimer = null;

  const editableNodes = [...document.querySelectorAll('[data-edit-key]')];
  const entries = [];
  const byKey = new Map();

  const cleanText = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const nodesFor = (key) => editableNodes.filter((el) => el.dataset.editKey === key);

  editableNodes.forEach((el) => {
    const key = el.dataset.editKey;
    if (byKey.has(key)) return;
    const group = el.closest('[data-edit-group]')?.dataset.editGroup || 'Overig';
    const label = el.dataset.editLabel || cleanText(el).slice(0, 72) || key;
    const entry = { key, group, label, first: el };
    byKey.set(key, entry);
    entries.push(entry);
  });

  const root = document.createElement('div');
  root.id = 'dg-editor-root';
  root.setAttribute('data-dg-runtime', 'true');
  root.innerHTML = `
    <div class="dg-admin-pill">
      <span>✏️ Beheerstand</span>
      <button type="button" id="dg-open-editor">Teksten bewerken</button>
    </div>

    <aside class="dg-editor-panel" id="dg-editor-panel" aria-label="Website teksten bewerken">
      <div class="dg-editor-head">
        <div class="dg-editor-head-top">
          <div>
            <h2 class="dg-editor-title">Teksten bewerken</h2>
            <p class="dg-editor-sub">Verander de tekst hier. Je ziet de wijziging meteen op de pagina.</p>
          </div>
          <button class="dg-icon-btn" type="button" id="dg-close-editor" aria-label="Editor sluiten">×</button>
        </div>
        <input class="dg-editor-search" id="dg-editor-search" type="search" placeholder="Zoek een tekst of onderdeel…" autocomplete="off">
      </div>
      <div class="dg-editor-body" id="dg-editor-body"></div>
      <div class="dg-editor-actions">
        <button class="dg-action" type="button" id="dg-save-draft">Concept bewaren</button>
        <button class="dg-action" type="button" id="dg-download">Backup downloaden</button>
        <button class="dg-action" type="button" id="dg-settings-button">GitHub instellen</button>
        <button class="dg-action dg-danger" type="button" id="dg-reset">Concept wissen</button>
        <button class="dg-action dg-primary" type="button" id="dg-publish">🚀 Publiceer naar GitHub</button>
      </div>
    </aside>

    <div class="dg-settings-backdrop" id="dg-settings-backdrop" aria-hidden="true">
      <div class="dg-settings" role="dialog" aria-modal="true" aria-labelledby="dg-settings-title">
        <h2 id="dg-settings-title">GitHub koppelen</h2>
        <p>Deze gegevens zijn nodig om jouw <strong>index.html</strong> rechtstreeks vanuit de website bij te werken. Alleen eigenaar, repository, branch en pad worden op dit apparaat onthouden.</p>
        <div class="dg-settings-grid">
          <label>GitHub gebruikersnaam / organisatie
            <input id="dg-gh-owner" autocomplete="off" placeholder="bijv. danielstanneveld">
          </label>
          <label>Repository
            <input id="dg-gh-repo" autocomplete="off" placeholder="bijv. de-grond-website">
          </label>
          <label>Branch
            <input id="dg-gh-branch" autocomplete="off" value="main">
          </label>
          <label>Bestandspad
            <input id="dg-gh-path" autocomplete="off" value="index.html">
          </label>
          <label class="dg-full">Fine-grained GitHub token
            <input id="dg-gh-token" type="password" autocomplete="new-password" spellcheck="false" placeholder="github_pat_…">
          </label>
        </div>
        <p class="dg-small-note">🔐 Het token wordt <strong>niet opgeslagen</strong> in localStorage of in je websitebestand. Het blijft alleen in het geheugen zolang deze pagina openstaat. Geef het token alleen toegang tot deze repository met <strong>Contents: Read and write</strong>.</p>
        <div class="dg-settings-actions">
          <button class="dg-action" type="button" id="dg-settings-cancel">Annuleren</button>
          <button class="dg-action dg-primary" type="button" id="dg-settings-save">Opslaan en doorgaan</button>
        </div>
      </div>
    </div>

    <div class="dg-toast" id="dg-toast" role="status" aria-live="polite"></div>
  `;
  document.body.appendChild(root);

  const $ = (id) => document.getElementById(id);
  const panel = $('dg-editor-panel');
  const body = $('dg-editor-body');
  const search = $('dg-editor-search');
  const backdrop = $('dg-settings-backdrop');
  const toast = $('dg-toast');

  function toastMessage(message, duration = 3200) {
    toast.textContent = message;
    toast.classList.add('dg-show');
    window.clearTimeout(toastMessage.timer);
    toastMessage.timer = window.setTimeout(() => toast.classList.remove('dg-show'), duration);
  }

  function groupEntries() {
    const groups = new Map();
    entries.forEach((entry) => {
      if (!groups.has(entry.group)) groups.set(entry.group, []);
      groups.get(entry.group).push(entry);
    });
    return groups;
  }

  function currentValue(key) {
    const first = nodesFor(key)[0];
    return first ? cleanText(first) : '';
  }

  function applyValue(key, value) {
    nodesFor(key).forEach((el) => { el.textContent = value; });
  }

  function collectValues() {
    const out = {};
    entries.forEach((entry) => { out[entry.key] = currentValue(entry.key); });
    return out;
  }

  function saveDraft(silent = false) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectValues()));
      if (!silent) toastMessage('✅ Concept bewaard op dit apparaat.');
    } catch (err) {
      if (!silent) toastMessage('Kon het concept niet lokaal bewaren.');
    }
  }

  function scheduleDraftSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveDraft(true), 450);
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      Object.entries(draft).forEach(([key, value]) => {
        if (byKey.has(key) && typeof value === 'string') applyValue(key, value);
      });
      toastMessage('📝 Je lokale concept is hersteld.', 2300);
    } catch (_) {}
  }

  function renderFields() {
    body.innerHTML = '';
    groupEntries().forEach((groupItems, groupName) => {
      const section = document.createElement('section');
      section.className = 'dg-group';
      section.dataset.group = groupName.toLowerCase();

      const h = document.createElement('h3');
      h.className = 'dg-group-title';
      h.textContent = groupName;
      section.appendChild(h);

      groupItems.forEach((entry) => {
        const wrap = document.createElement('div');
        wrap.className = 'dg-field';
        wrap.dataset.key = entry.key;
        wrap.dataset.search = `${groupName} ${entry.label} ${currentValue(entry.key)}`.toLowerCase();

        const label = document.createElement('label');
        label.htmlFor = `dg-field-${entry.key}`;
        label.textContent = entry.label;

        const textarea = document.createElement('textarea');
        textarea.id = `dg-field-${entry.key}`;
        textarea.value = currentValue(entry.key);
        textarea.rows = Math.min(6, Math.max(2, Math.ceil(textarea.value.length / 55)));
        textarea.addEventListener('input', () => {
          applyValue(entry.key, textarea.value.trim());
          wrap.dataset.search = `${groupName} ${entry.label} ${textarea.value}`.toLowerCase();
          scheduleDraftSave();
        });
        textarea.addEventListener('focus', () => highlight(entry.first));
        textarea.addEventListener('blur', () => unhighlight(entry.first));

        const jump = document.createElement('button');
        jump.type = 'button';
        jump.className = 'dg-jump';
        jump.textContent = '↗ Toon op pagina';
        jump.addEventListener('click', () => {
          panel.classList.remove('dg-open');
          window.setTimeout(() => {
            entry.first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlight(entry.first);
            window.setTimeout(() => unhighlight(entry.first), 1800);
          }, 180);
        });

        wrap.append(label, textarea, jump);
        section.appendChild(wrap);
      });
      body.appendChild(section);
    });
  }

  function highlight(el) { if (el) el.classList.add('dg-highlight'); }
  function unhighlight(el) { if (el) el.classList.remove('dg-highlight'); }

  function filterFields() {
    const q = search.value.trim().toLowerCase();
    body.querySelectorAll('.dg-field').forEach((field) => {
      field.hidden = !!q && !field.dataset.search.includes(q);
    });
    body.querySelectorAll('.dg-group').forEach((groupEl) => {
      const anyVisible = [...groupEl.querySelectorAll('.dg-field')].some((f) => !f.hidden);
      groupEl.hidden = !anyVisible;
    });
  }

  function resetRuntimeStateOnClone(clone) {
    clone.querySelector('#dg-editor-root')?.remove();
    clone.querySelectorAll('.dg-highlight').forEach((el) => el.classList.remove('dg-highlight'));
    clone.querySelectorAll('.reveal.visible').forEach((el) => el.classList.remove('visible'));
    clone.querySelectorAll('dialog[open]').forEach((el) => el.removeAttribute('open'));
    clone.querySelector('#site-menu')?.classList.remove('open');
    const menuButton = clone.querySelector('.menu-button');
    if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
    clone.querySelector('body')?.classList.remove('menu-open', 'modal-open');
    clone.querySelector('body')?.removeAttribute('style');
    const year = clone.querySelector('#year');
    if (year) year.textContent = '';
    const infoBody = clone.querySelector('#info-body');
    if (infoBody) infoBody.innerHTML = '';
    return clone;
  }

  function serializePage() {
    const clone = resetRuntimeStateOnClone(document.documentElement.cloneNode(true));
    return '<!doctype html>\n' + clone.outerHTML + '\n';
  }

  function downloadHtml() {
    saveDraft(true);
    const blob = new Blob([serializePage()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toastMessage('⬇️ Backup index.html gedownload.');
  }

  function getGithubSettings() {
    try {
      return { branch: 'main', path: 'index.html', ...JSON.parse(localStorage.getItem(GITHUB_KEY) || '{}') };
    } catch (_) {
      return { owner: '', repo: '', branch: 'main', path: 'index.html' };
    }
  }

  function openSettings(publishAfter = false) {
    publishAfterSettings = publishAfter;
    const s = getGithubSettings();
    $('dg-gh-owner').value = s.owner || '';
    $('dg-gh-repo').value = s.repo || '';
    $('dg-gh-branch').value = s.branch || 'main';
    $('dg-gh-path').value = s.path || 'index.html';
    $('dg-gh-token').value = githubToken || '';
    backdrop.classList.add('dg-open');
    backdrop.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => $('dg-gh-owner').focus(), 50);
  }

  function closeSettings() {
    backdrop.classList.remove('dg-open');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  function saveSettings() {
    const settings = {
      owner: $('dg-gh-owner').value.trim(),
      repo: $('dg-gh-repo').value.trim(),
      branch: $('dg-gh-branch').value.trim() || 'main',
      path: $('dg-gh-path').value.trim() || 'index.html'
    };
    const token = $('dg-gh-token').value.trim();
    if (!settings.owner || !settings.repo) {
      toastMessage('Vul je GitHub gebruikersnaam/organisatie en repository in.');
      return null;
    }
    if (token) githubToken = token;
    localStorage.setItem(GITHUB_KEY, JSON.stringify(settings));
    closeSettings();
    toastMessage('✅ GitHub-instellingen bewaard. Token blijft alleen in deze pagina.');
    return settings;
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function ghHeaders() {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': API_VERSION,
      'Content-Type': 'application/json'
    };
  }

  function encodePath(path) {
    return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  }

  async function publishToGithub() {
    const settings = getGithubSettings();
    if (!settings.owner || !settings.repo || !githubToken) {
      openSettings(true);
      return;
    }

    const button = $('dg-publish');
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Publiceren…';
    toastMessage('GitHub wordt bijgewerkt…', 1800);

    try {
      saveDraft(true);
      const owner = encodeURIComponent(settings.owner);
      const repo = encodeURIComponent(settings.repo);
      const path = encodePath(settings.path || 'index.html');
      const branch = settings.branch || 'main';
      const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

      const getResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
        method: 'GET', headers: ghHeaders()
      });

      if (getResponse.status === 401 || getResponse.status === 403) {
        throw new Error('GitHub weigert het token. Controleer of het token geldig is en Contents: Read and write heeft.');
      }
      if (getResponse.status === 404) {
        throw new Error('Repository, branch of index.html niet gevonden. Controleer je GitHub-instellingen.');
      }
      if (!getResponse.ok) {
        throw new Error(`GitHub kon index.html niet ophalen (HTTP ${getResponse.status}).`);
      }

      const fileInfo = await getResponse.json();
      const html = serializePage();
      const payload = {
        message: 'Website teksten bijgewerkt via DE GROND beheer',
        content: utf8ToBase64(html),
        sha: fileInfo.sha,
        branch
      };

      const putResponse = await fetch(endpoint, {
        method: 'PUT', headers: ghHeaders(), body: JSON.stringify(payload)
      });
      const result = await putResponse.json().catch(() => ({}));

      if (!putResponse.ok) {
        const detail = result?.message ? ` ${result.message}` : '';
        throw new Error(`Publiceren mislukt (HTTP ${putResponse.status}).${detail}`);
      }

      localStorage.removeItem(DRAFT_KEY);
      const commitUrl = result?.commit?.html_url;
      toastMessage('✅ GitHub bijgewerkt. Cloudflare kan nu automatisch opnieuw deployen.', 5200);
      if (commitUrl) console.info('DE GROND commit:', commitUrl);
    } catch (err) {
      console.error(err);
      toastMessage(`❌ ${err.message || 'Publiceren mislukt.'}`, 6500);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  $('dg-open-editor').addEventListener('click', () => panel.classList.add('dg-open'));
  $('dg-close-editor').addEventListener('click', () => panel.classList.remove('dg-open'));
  search.addEventListener('input', filterFields);
  $('dg-save-draft').addEventListener('click', () => saveDraft(false));
  $('dg-download').addEventListener('click', downloadHtml);
  $('dg-settings-button').addEventListener('click', () => openSettings(false));
  $('dg-publish').addEventListener('click', publishToGithub);
  $('dg-reset').addEventListener('click', () => {
    if (!window.confirm('Je lokale concept wissen en de live versie opnieuw laden?')) return;
    localStorage.removeItem(DRAFT_KEY);
    window.location.reload();
  });
  $('dg-settings-cancel').addEventListener('click', () => { publishAfterSettings = false; closeSettings(); });
  $('dg-settings-save').addEventListener('click', () => {
    const s = saveSettings();
    if (s && publishAfterSettings) {
      publishAfterSettings = false;
      window.setTimeout(publishToGithub, 80);
    }
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) { publishAfterSettings = false; closeSettings(); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (backdrop.classList.contains('dg-open')) { publishAfterSettings = false; closeSettings(); }
      else panel.classList.remove('dg-open');
    }
  });

  loadDraft();
  renderFields();
})();
