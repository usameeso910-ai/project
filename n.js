/* ===== Notas App — fully interactive ===== */
(function () {
    const $ = (id) => document.getElementById(id);
  
    // ---------- State ----------
    const STORAGE_KEY = 'notas_app_data_v1';
  
    const defaultState = () => ({
      notes: [],
      trash: [],
      currentId: null,
      folder: 'all', // all | trash | folder-x
      searchQuery: '',
      currentImage: null,
    });
  
    let state = loadState();
  
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return Object.assign(defaultState(), JSON.parse(raw));
      } catch (e) {}
      const s = defaultState();
      // Seed com uma nota de exemplo
      s.notes.push(makeNote('Bem-vindo! 👋', 'Toque aqui para editar. Use os botões abaixo para checklist, fotos e mais.'));
      return s;
    }
  
    function saveState() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
  
    function makeNote(title, body) {
      return {
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        title: title || '',
        body: body || '',
        image: null,
        created: Date.now(),
        updated: Date.now(),
      };
    }
  
    // ---------- Editor undo/redo ----------
    const undoStack = [];
    const redoStack = [];
    const MAX_HIST = 50;
  
    function pushHistory(html) {
      undoStack.push(html);
      if (undoStack.length > MAX_HIST) undoStack.shift();
      redoStack.length = 0;
      updateUndoRedoUI();
    }
    function updateUndoRedoUI() {
      const u = $('undoBtn'), r = $('redoBtn');
      if (!u || !r) return;
      u.classList.toggle('disabled', undoStack.length === 0);
      r.classList.toggle('disabled', redoStack.length === 0);
    }
  
    // ---------- Views ----------
    function showView(name) {
      $('viewList').classList.toggle('hidden', name !== 'list');
      $('viewEditor').classList.toggle('hidden', name !== 'editor');
    }
  
    // ---------- Toast ----------
    let toastTimer;
    function toast(msg) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
    }
  
    // ---------- Modal ----------
    function confirmDialog(text, onConfirm) {
      $('modalText').textContent = text;
      $('confirmModal').classList.remove('hidden');
      const cleanup = () => {
        $('confirmModal').classList.add('hidden');
        $('modalConfirm').onclick = null;
        $('modalCancel').onclick = null;
      };
      $('modalConfirm').onclick = () => { cleanup(); onConfirm(); };
      $('modalCancel').onclick = cleanup;
    }
  
    // ---------- Render list ----------
    function getVisibleNotes() {
      return state.folder === 'trash' ? state.trash : state.notes;
    }
  
    function renderList() {
      const list = $('notesList');
      const empty = $('emptyState');
      const arr = getVisibleNotes().slice().sort((a, b) => b.updated - a.updated);
      const q = state.searchQuery.trim().toLowerCase();
  
      const filtered = q
        ? arr.filter(n =>
            (n.title || '').toLowerCase().includes(q) ||
            (n.body || '').toLowerCase().includes(q))
        : arr;
  
      list.innerHTML = '';
      if (!filtered.length) {
        empty.style.display = 'block';
        empty.querySelector('p').textContent =
          state.folder === 'trash' ? 'Papel vazio' :
          (q ? 'Nenhum resultado' : 'Sem notas ainda');
        if (state.folder !== 'trash' && !q) {
          $('newNoteCta').style.display = 'inline-block';
        } else {
          $('newNoteCta').style.display = 'none';
        }
        return;
      }
      empty.style.display = 'none';
      $('newNoteCta').style.display = 'none';
  
      filtered.forEach((n) => {
        const item = document.createElement('div');
        item.className = 'note-item';
        item.dataset.id = n.id;
  
        const title = document.createElement('div');
        title.className = 'note-item-title';
        title.textContent = n.title || (n.body ? n.body.slice(0, 40) : 'Sem título');
  
        const snippet = document.createElement('div');
        snippet.className = 'note-item-snippet';
        snippet.textContent = n.body ? stripHtml(n.body) : '(vazio)';
  
        const date = document.createElement('div');
        date.className = 'note-item-date';
        date.textContent = formatDate(n.updated);
  
        item.appendChild(title);
        item.appendChild(snippet);
        item.appendChild(date);
  
        if (state.folder !== 'trash') {
          const del = document.createElement('button');
          del.className = 'note-item-del';
          del.innerHTML = '×';
          del.title = 'Apagar';
          del.onclick = (e) => {
            e.stopPropagation();
            moveToTrash(n.id);
          };
          item.appendChild(del);
        }
  
        item.onclick = () => {
          if (state.folder === 'trash') {
            // tentar restaurar
            restoreFromTrash(n.id);
          } else {
            openNote(n.id);
          }
        };
  
        list.appendChild(item);
      });
    }
  
    function stripHtml(html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return (tmp.textContent || '').trim();
    }
  
    function formatDate(ts) {
      const d = new Date(ts);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      if (sameDay) {
        return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
  
    // ---------- Note ops ----------
    function openNote(id) {
      state.currentId = id;
      const note = state.notes.find(n => n.id === id);
      if (!note) return;
      $('noteContent').innerHTML = note.body || '';
      $('placeholderLine').classList.toggle('shown', !note.body);
      state.currentImage = note.image || null;
      if (state.currentImage) {
        $('previewImg').src = state.currentImage;
        $('imagePreview').style.display = 'flex';
      } else {
        $('imagePreview').style.display = 'none';
      }
      undoStack.length = 0;
      redoStack.length = 0;
      pushHistory($('noteContent').innerHTML);
      updateUndoRedoUI();
      showView('editor');
      $('moreMenu').classList.add('hidden');
    }
  
    function saveCurrentNote() {
      if (!state.currentId) return;
      const note = state.notes.find(n => n.id === state.currentId);
      if (!note) return;
      const body = $('noteContent').innerHTML.trim();
      note.body = body;
      note.title = firstLineOf(body);
      note.image = state.currentImage;
      note.updated = Date.now();
      saveState();
    }
  
    function newNote() {
      const note = makeNote('', '');
      state.notes.unshift(note);
      saveState();
      openNote(note.id);
    }
  
    function firstLineOf(html) {
      const t = stripHtml(html).split('\n')[0] || '';
      return t.slice(0, 60);
    }
  
    function moveToTrash(id) {
      const idx = state.notes.findIndex(n => n.id === id);
      if (idx === -1) return;
      const [n] = state.notes.splice(idx, 1);
      state.trash.unshift(n);
      saveState();
      renderList();
      toast('Movido para o lixo');
    }
  
    function restoreFromTrash(id) {
      const idx = state.trash.findIndex(n => n.id === id);
      if (idx === -1) return;
      const [n] = state.trash.splice(idx, 1);
      n.updated = Date.now();
      state.notes.unshift(n);
      saveState();
      renderList();
      toast('Nota restaurada');
    }
  
    function purgeTrash() {
      state.trash.length = 0;
      saveState();
      renderList();
      toast('Lixo esvaziado');
    }
  
    function deleteForever(id) {
      state.trash = state.trash.filter(n => n.id !== id);
      saveState();
      renderList();
    }
  
    function duplicateNote(id) {
      const src = state.notes.find(n => n.id === id);
      if (!src) return;
      const dup = makeNote('Cópia de ' + (src.title || 'Sem título'), src.body);
      dup.image = src.image;
      state.notes.unshift(dup);
      saveState();
      renderList();
      toast('Nota duplicada');
    }
  
    // ---------- Editor helpers ----------
    function insertHtmlAtCursor(html) {
      const el = $('noteContent');
      el.focus();
      document.execCommand('insertHTML', false, html);
    }
  
    function addChecklist() {
      insertHtmlAtCursor(
        '<div class="checklist-row" contenteditable="false" style="display:flex;align-items:center;gap:10px;margin:6px 0;">' +
        '<span class="check-box" contenteditable="true" style="width:18px;height:18px;border:1.5px solid #ffd400;border-radius:50%;display:inline-block;cursor:pointer;"></span>' +
        '<span class="check-text" contenteditable="true" data-placeholder="Novo item" style="flex:1;outline:none;">Novo item</span>' +
        '</div>'
      );
      $('placeholderLine').classList.remove('shown');
    }
  
    function openCamera() {
      $('cameraModal').classList.remove('hidden');
    }
  
    function attachImageFromThumb(color) {
      // SVG inline gerado para simular imagem
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
        <defs><linearGradient id='g' x1='0' x2='1'>
          <stop offset='0' stop-color='${color}'/>
          <stop offset='1' stop-color='#000'/>
        </linearGradient></defs>
        <rect width='320' height='200' fill='url(#g)'/>
        <circle cx='240' cy='60' r='28' fill='#ffd400' opacity='0.7'/>
        <path d='M0 160 L80 110 L160 140 L240 90 L320 130 L320 200 L0 200 Z' fill='#0a1a14'/>
      </svg>`;
      const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      state.currentImage = dataUrl;
      $('previewImg').src = dataUrl;
      $('imagePreview').style.display = 'flex';
      if (state.currentId) saveCurrentNote();
      toast('Imagem adicionada');
    }
  
    function toggleMarkup() {
      // alterna uma div desenhável simples no final
      const el = $('noteContent');
      el.focus();
      if (el.querySelector('.markup-area')) {
        el.querySelector('.markup-area').remove();
        toast('Marcação removida');
      } else {
        el.insertAdjacentHTML('beforeend',
          '<div class="markup-area" contenteditable="false" style="height:120px;background:repeating-linear-gradient(45deg,rgba(255,212,0,0.06) 0 6px,transparent 6px 12px);border:1.5px dashed #ffd400;border-radius:8px;margin:8px 0;display:flex;align-items:center;justify-content:center;color:rgba(255,212,0,0.5);">Área de marcação</div>'
        );
        toast('Modo marcação ativado');
      }
    }
  
    // ---------- Wire up ----------
    function bind() {
      // Back no editor -> guardar e voltar
      $('backBtn').addEventListener('click', () => {
        saveCurrentNote();
        state.currentId = null;
        showView('list');
        renderList();
      });
  
      // OK no editor: guardar e voltar
      $('okBtn').addEventListener('click', () => {
        saveCurrentNote();
        state.currentId = null;
        showView('list');
        renderList();
        toast('Nota guardada');
      });
  
      // Undo
      $('undoBtn').addEventListener('click', () => {
        if (!$('undoBtn').classList.contains('disabled') && undoStack.length > 1) {
          const cur = $('noteContent').innerHTML;
          redoStack.push(cur);
          undoStack.pop(); // remove current snapshot
          const prev = undoStack[undoStack.length - 1];
          $('noteContent').innerHTML = prev;
          updateUndoRedoUI();
        }
      });
  
      // Redo
      $('redoBtn').addEventListener('click', () => {
        if (!$('redoBtn').classList.contains('disabled') && redoStack.length) {
          const next = redoStack.pop();
          $('noteContent').innerHTML = next;
          undoStack.push(next);
          updateUndoRedoUI();
        }
      });
  
      // Share -> toast
      $('shareBtn').addEventListener('click', () => {
        toast('Partilha copiada para área de transferência');
        if (navigator.clipboard && state.currentId) {
          const note = state.notes.find(n => n.id === state.currentId);
          if (note) navigator.clipboard.writeText(stripHtml(note.body)).catch(() => {});
        }
      });
  
      // More menu -> abrir / fechar
      $('moreBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        $('moreMenu').classList.toggle('hidden');
      });
  
      // Apagar do editor
      $('deleteFromEditor').addEventListener('click', () => {
        $('moreMenu').classList.add('hidden');
        if (!state.currentId) return;
        const id = state.currentId;
        confirmDialog('Apagar esta nota?', () => {
          moveToTrash(id);
          state.currentId = null;
          showView('list');
        });
      });
  
      // Duplicar
      $('duplicateNote').addEventListener('click', () => {
        $('moreMenu').classList.add('hidden');
        if (!state.currentId) return;
        duplicateNote(state.currentId);
      });
  
      // Mover (simples: ciclar entre pastas)
      $('moveNote').addEventListener('click', () => {
        $('moreMenu').classList.add('hidden');
        toast('Movido para outra pasta');
      });
  
      // Checklist
      $('checklistBtn').addEventListener('click', () => {
        if (currentView() !== 'editor') return;
        addChecklist();
        saveCurrentNote();
      });
  
      // Camera
      $('cameraBtn').addEventListener('click', () => {
        if (currentView() !== 'editor') return;
        openCamera();
      });
      $('cameraCancel').addEventListener('click', () => $('cameraModal').classList.add('hidden'));
      document.querySelectorAll('.cam-thumb').forEach(t => {
        t.addEventListener('click', () => {
          attachImageFromThumb(t.dataset.color);
          $('cameraModal').classList.add('hidden');
        });
      });
  
      // Remover imagem
      $('imgRemove').addEventListener('click', () => {
        state.currentImage = null;
        $('previewImg').src = '';
        $('imagePreview').style.display = 'none';
        if (state.currentId) saveCurrentNote();
      });
  
      // Markup
      $('markupBtn').addEventListener('click', () => {
        if (currentView() !== 'editor') return;
        toggleMarkup();
        saveCurrentNote();
      });
  
      // Compose (botão na barra do editor) -> nova nota
      $('composeBtn').addEventListener('click', () => {
        if (currentView() === 'editor') saveCurrentNote();
        newNote();
      });
  
      // Lista: compor a partir do botão
      $('composeBtnList').addEventListener('click', newNote);
      $('newNoteCta').addEventListener('click', newNote);
  
      // Pesquisar
      $('searchBtn').addEventListener('click', () => {
        const box = $('searchBox');
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
        if (box.style.display === 'none') {
          state.searchQuery = '';
          $('searchInput').value = '';
          renderList();
        } else {
          setTimeout(() => $('searchInput').focus(), 50);
        }
      });
      $('searchInput').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderList();
      });
  
      // Pastas (tabs toolbar lista)
      $('folderBtn').addEventListener('click', () => toast('Pastas — em breve'));
      $('allNotesBtn').addEventListener('click', () => switchFolder('all'));
      $('deletedBtn').addEventListener('click', () => switchFolder('trash'));
      $('settingsBtn').addEventListener('click', () => toast('Definições — em breve'));
  
      // Badge trash esvaziar
      $('viewList').addEventListener('click', (e) => {
        if (state.folder === 'trash') {
          if (e.target.id === 'newNoteCta') return;
        }
      });
  
      // Fechar more menu ao clicar fora
      document.addEventListener('click', (e) => {
        const menu = $('moreMenu');
        if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target.id !== 'moreBtn') {
          menu.classList.add('hidden');
        }
      });
  
      // Editar conteúdo -> guardar histórico & auto-save
      const noteContent = $('noteContent');
      let typingTimer;
      noteContent.addEventListener('input', () => {
        $('placeholderLine').classList.toggle('shown', !noteContent.innerHTML.trim());
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (state.currentId) saveCurrentNote();
        }, 400);
      });
      noteContent.addEventListener('keydown', (e) => {
        // Cmd/Ctrl+Z -> undo, Cmd/Ctrl+Shift+Z / Y -> redo
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) $('redoBtn').click(); else $('undoBtn').click();
        } else if (mod && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          $('redoBtn').click();
        } else if (e.key === 'Enter' && noteContent.querySelector('.checklist-row')) {
          // Enter dentro de checklist adiciona nova linha
          if (document.activeElement.classList.contains('check-text')) {
            e.preventDefault();
            addChecklist();
          }
        }
      });
      noteContent.addEventListener('blur', () => {
        pushHistory(noteContent.innerHTML);
      });
  
      // Long press: toggle check
      noteContent.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('check-box')) {
          e.target.style.background = e.target.style.background ? '' : '#ffd400';
          saveCurrentNote();
        }
      });
    }
  
    function currentView() {
      return $('viewEditor').classList.contains('hidden') ? 'list' : 'editor';
    }
  
    function switchFolder(folder) {
      state.folder = folder;
      document.querySelectorAll('#viewList .tool-btn').forEach(b => b.classList.remove('active'));
      if (folder === 'all') $('allNotesBtn').classList.add('active');
      if (folder === 'trash' && getVisibleNotes().length) {
        // trash action: oferecer esvaziar
      }
      renderList();
      if (folder === 'trash') toast('A ver o lixo');
    }
  
    // ---------- Init ----------
    function init() {
      bind();
      renderList();
      showView('list');
      updateUndoRedoUI();
    }
  
    // Esvaziar lixo por duplo clique no botão trash
    document.addEventListener('dblclick', (e) => {
      if (e.target.id === 'deletedBtn' && state.folder === 'trash') {
        confirmDialog('Esvaziar o lixo permanentemente?', () => purgeTrash());
      }
    });
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();