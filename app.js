/* app.js
   Lightweight editor logic:
   - simple virtual file system
   - file explorer (collapsible)
   - open/close tabs
   - editable textarea overlaying syntax-highlighted pre
   - line numbers and auto-indent
   - minimal, dependency-free
*/

/* -----------------------------
   Sample project "file system"
   ----------------------------- */
const sampleFiles = [
  {
    type: 'folder', name: 'public', expanded: true, children: [
      { type: 'file', name: 'index.html', language: 'html', content:
`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>BINA|studio demo</title>
  </head>
  <body>
    <h1>Hello from BINA|studio</h1>
    <script src="app.js"></script>
  </body>
</html>` },
      { type: 'file', name: 'style.css', language: 'css', content:
`body {
  font-family: Inter, sans-serif;
  background: linear-gradient(135deg,#071020 0%, #041223 100%);
}` },
    ]
  },
  {
    type: 'folder', name: 'src', expanded: true, children: [
      { type: 'file', name: 'app.js', language: 'js', content:
`// Tiny demo app
console.log('Welcome to BINA|studio');`},
    ]
  },
  { type: 'file', name: 'README.md', language: 'md', content: '# Sample Project\nThis is a demo.' }
];

/* -----------------------------
   DOM references and state
   ----------------------------- */
const fileTreeEl = document.getElementById('file-tree');
const tabsEl = document.getElementById('tabs');
const editorTA = document.getElementById('editor');
const highlightPre = document.getElementById('highlight-code');
const gutterEl = document.getElementById('gutter');
const statusFile = document.getElementById('status-file');
const statusPos = document.getElementById('status-position');
const statusMode = document.getElementById('status-mode');
const panels = document.querySelectorAll('.panel');
const sideIcons = document.querySelectorAll('.side-icon');
const sidebar = document.querySelector('.sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

let openTabs = []; // {id, name, language, content}
let activeTabId = null;

/* -----------------------------
   Utilities
   ----------------------------- */
const uid = (p=Date.now()) => `${p}-${Math.random().toString(36).slice(2,9)}`;

/* map filename extension to language mode */
function detectLanguage(name){
  if(!name) return 'plaintext';
  if(name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  if(name.endsWith('.css')) return 'css';
  if(name.endsWith('.js')) return 'js';
  if(name.endsWith('.md')) return 'md';
  return 'plaintext';
}

/* -----------------------------
   Render file tree (recursive)
   ----------------------------- */
function renderTree(nodes, container){
  container.innerHTML = '';
  nodes.forEach(node=>{
    if(node.type === 'folder'){
      const div = document.createElement('div');
      div.className = 'folder';
      div.setAttribute('role','treeitem');
      div.setAttribute('aria-expanded', !!node.expanded);
      div.tabIndex = 0;

      const label = document.createElement('div');
      label.className = 'folder-label';
      label.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h6l2 3h8v7H3z" fill="currentColor"/></svg><span>${node.name}</span>`;
      div.appendChild(label);

      // click toggles expansion
      label.addEventListener('click', (e)=>{
        node.expanded = !node.expanded;
        renderTree(sampleFiles, fileTreeEl);
      });
      label.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); node.expanded = !node.expanded; renderTree(sampleFiles, fileTreeEl); }
      });

      container.appendChild(div);

      if(node.expanded){
        const childWrap = document.createElement('div');
        childWrap.style.paddingLeft = '12px';
        childWrap.setAttribute('role','group');
        renderTree(node.children, childWrap);
        container.appendChild(childWrap);
      }
    } else {
      const file = document.createElement('div');
      file.className = 'file';
      file.tabIndex = 0;
      file.setAttribute('role','treeitem');
      file.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6z" fill="currentColor"/></svg><span>${node.name}</span>`;
      file.addEventListener('click', ()=> openFileTab(node));
      file.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') openFileTab(node); });
      container.appendChild(file);
    }
  });
}

/* -----------------------------
   Tabs: open/close/switch
   ----------------------------- */
function createTab(fileNode){
  const id = uid(fileNode.name);
  const tab = { id, name: fileNode.name, language: fileNode.language || detectLanguage(fileNode.name), content: fileNode.content || '' };
  openTabs.push(tab);
  activeTabId = id;
  renderTabs();
  loadTabContent(tab);
}

function openFileTab(node){
  // if file already open, switch to it
  const existing = openTabs.find(t => t.name === node.name);
  if(existing){
    activeTabId = existing.id; renderTabs(); loadTabContent(existing); return;
  }
  createTab(node);
}

function renderTabs(){
  tabsEl.innerHTML = '';
  openTabs.forEach(t => {
    const b = document.createElement('button');
    b.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    b.setAttribute('role','tab');
    b.innerText = t.name;
    b.title = t.name;
    b.addEventListener('click', ()=>{ activeTabId = t.id; loadTabContent(t); renderTabs(); });
    // close button
    const close = document.createElement('span');
    close.innerText = ' ✕';
    close.style.marginLeft = '8px';
    close.style.opacity = '0.6';
    close.addEventListener('click', (e)=>{ e.stopPropagation(); closeTab(t.id); });
    b.appendChild(close);
    tabsEl.appendChild(b);
  });
  updateStatusFile();
}

function closeTab(id){
  const idx = openTabs.findIndex(t => t.id === id);
  if(idx === -1) return;
  openTabs.splice(idx,1);
  if(activeTabId === id){
    // pick previous or none
    activeTabId = openTabs[idx-1] ? openTabs[idx-1].id : (openTabs[0] ? openTabs[0].id : null);
    if(activeTabId) loadTabContent(openTabs.find(t=>t.id===activeTabId));
    else { editorTA.value = ''; highlightPre.textContent = ''; updateGutter(); statusFile.textContent = 'No file'; statusMode.textContent='Plain Text'; }
  }
  renderTabs();
}

/* -----------------------------
   Load tab content into editor
   ----------------------------- */
function loadTabContent(tab){
  editorTA.value = tab.content;
  editorTA.dataset.tabId = tab.id;
  statusMode.textContent = tab.language.toUpperCase();
  statusFile.textContent = tab.name;
  // ensure container classes for wrapping
  document.querySelector('.code-wrap').classList.toggle('wrap-on', document.getElementById('toggle-linewrap')?.checked);
  // initial render of highlight and gutter
  scheduleHighlight();
  updateGutter();
  // set focus
  setTimeout(()=> editorTA.focus(), 50);
}

/* -----------------------------
   Simple syntax highlighting functions
   (lightweight regex-based; not a full parser)
   ----------------------------- */
function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlightJS(code){
  // basic: comments, strings, numbers, keywords
  let out = escapeHtml(code);
  // comments
  out = out.replace(/(\/\*[\s\S]*?\*\/|\/\/.*$)/gm, '<span class="token-comment">$1</span>');
  // strings
  out = out.replace(/(['"`])((?:\\.|(?!\1).)*)\1/g, '<span class="token-string">$&</span>');
  // numbers
  out = out.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  // keywords
  out = out.replace(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|new|class|extends|import|from|export|default|try|catch)\b/g, '<span class="token-keyword">$1</span>');
  return out;
}

function highlightCSS(code){
  let out = escapeHtml(code);
  // comments
  out = out.replace(/\/\*[\s\S]*?\*\/g, '<span class="token-comment">$&</span>');
  // selectors and properties basic coloring
  out = out.replace(/([.#]?[A-Za-z0-9\-_]+)(?=\s*\{)/g, '<span class="token-tag">$1</span>');
  out = out.replace(/([a-z-]+)(?=\s*:)/g, '<span class="token-attr">$1</span>');
  out = out.replace(/:\s*([^;}\n]+)/g, (m,p)=>': <span class="token-string">'+escapeHtml(p)+'</span>');
  out = out.replace(/(\d+)(px|em|rem|%)/g, '<span class="token-number">$1</span>$2');
  return out;
}

function highlightHTML(code){
  let out = escapeHtml(code);
  // tags
  out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="token-comment">$1</span>');
  out = out.replace(/(&lt;\/?[a-zA-Z0-9\-]+)([^&]*?)(&gt;)/g, (m, p1, tag, attrs, p4)=>{
    // attributes inside
    const attrsHtml = attrs.replace(/([a-zA-Z-:]+)(="[^"]*")?/g, '<span class="token-attr">$1</span>$2');
    return `${p1}<span class="token-tag">${tag}</span>${attrsHtml}${p4}`;
  });
  // inline script/style basic coloring (very small)
  out = out.replace(/(&lt;script[\s\S]*?&gt;)([\s\S]*?)(&lt;\/script&gt;)/g, (m,a,b,c)=> `${a}<span class="token-string">${escapeHtml(b)}</span>${c}`);
  return out;
}

/* choose highlighter */
function highlightByMode(code, mode){
  if(mode === 'js') return highlightJS(code);
  if(mode === 'css') return highlightCSS(code);
  if(mode === 'html') return highlightHTML(code);
  // fallback: escape html for display
  return escapeHtml(code);
}

/* -----------------------------
   Sync textarea content to highlight pre
   - We place highlighted HTML into the <code> element.
   - Keep scrolling/sizes in sync.
   - Throttle with requestAnimationFrame for smoothness.
   ----------------------------- */
let raf = null;
function scheduleHighlight(){
  if(raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(()=> {
    raf = null;
    const tab = openTabs.find(t=>t.id === activeTabId);
    const mode = tab ? tab.language : 'plaintext';
    const code = editorTA.value.replace(/\t/g,'  ');
    // update tab model content
    if(tab) tab.content = code;
    // produce highlighted HTML
    const highlighted = highlightByMode(code, mode);
    highlightPre.innerHTML = highlighted || '<span class="muted">// empty</span>';    
    // sync scroll
    highlightPre.parentElement.parentElement.scrollTop = editorTA.scrollTop;
    highlightPre.parentElement.parentElement.scrollLeft = editorTA.scrollLeft;
    // update gutter and caret status
    updateGutter();
    updateCaretStatus();
  });
}

/* -----------------------------
   Gutter: render line numbers
   ----------------------------- */
function updateGutter(){
  const lines = editorTA.value.split('\n').length || 1;
  const arr = new Array(lines).fill(0).map((_,i)=> `<div>${i+1}</div>`).join('');
  gutterEl.innerHTML = arr;
}

/* -----------------------------
   Caret position (line, column)
   ----------------------------- */
function updateCaretStatus(){
  const pos = editorTA.selectionStart;
  const upto = editorTA.value.slice(0,pos);
  const line = upto.split('\n').length;
  const col = pos - upto.lastIndexOf('\n');
  statusPos.textContent = `Ln ${line}, Col ${col}`;
}

/* -----------------------------
   Editor behavior: auto-indent, tab key, selection syncing
   ----------------------------- */
editorTA.addEventListener('keydown', (e)=>{
  if(e.key === 'Tab'){
    e.preventDefault();
    // insert two spaces (configurable)
    const start = editorTA.selectionStart;
    const end = editorTA.selectionEnd;
    const val = editorTA.value;
    editorTA.value = val.slice(0,start) + '  ' + val.slice(end);
    editorTA.selectionStart = editorTA.selectionEnd = start + 2;
    scheduleHighlight();
    return;
  }

  if(e.key === 'Enter'){
    // auto-indent: match leading whitespace of current line
    const start = editorTA.selectionStart;
    const upto = editorTA.value.slice(0,start);
    const lastLineMatch = upto.match(/(^|\n)([ \t]*)[^\n]*$/);
    const indent = lastLineMatch ? lastLineMatch[2] : '';
    // check for closing brace on next characters to do indent + dedent like editors (simple heuristic)
    setTimeout(()=>{
      const cur = editorTA.selectionStart;
      editorTA.value = editorTA.value.slice(0,cur) + indent + editorTA.value.slice(cur);
      editorTA.selectionStart = editorTA.selectionEnd = cur + indent.length;
      scheduleHighlight();
    }, 0);
  }
});

/* textarea input / scroll handlers */
editorTA.addEventListener('input', scheduleHighlight);
editorTA.addEventListener('scroll', ()=> {
  // sync scroll of highlight and gutter
  const scrollTop = editorTA.scrollTop;
  const scrollLeft = editorTA.scrollLeft;
  highlightPre.parentElement.parentElement.scrollTop = scrollTop;
  highlightPre.parentElement.parentElement.scrollLeft = scrollLeft;
  gutterEl.scrollTop = scrollTop;
});
editorTA.addEventListener('click', updateCaretStatus);
editorTA.addEventListener('keyup', updateCaretStatus);

/* -----------------------------
   Panel switching (sidebar icons)
   ----------------------------- */
sideIcons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    sideIcons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const target = 'panel-' + btn.dataset.panel;
    panels.forEach(p=>p.classList.remove('panel-active'));
    const el = document.getElementById(target);
    if(el) el.classList.add('panel-active');
  });
});

/* Toggle sidebar on mobile */
btnToggleSidebar.addEventListener('click', ()=>{
  sidebar.classList.toggle('open');
});

/* New file (small demo: adds untitled file) */
document.getElementById('new-file-btn').addEventListener('click', ()=>{
  const newNode = { type:'file', name:`untitled-${Date.now()}.js`, language:'js', content:'// new file' };
  // add to root
  sampleFiles.push(newNode);
  renderTree(sampleFiles, fileTreeEl);
});

/* Settings toggles (line wrap / gutter) */
document.getElementById('toggle-linewrap')?.addEventListener('change', (e)=>{
  document.querySelector('.code-wrap').classList.toggle('wrap-on', e.target.checked);
  document.querySelector('.code-wrap').classList.toggle('wrap-off', !e.target.checked);
});
document.getElementById('toggle-gutter')?.addEventListener('change', (e)=>{
  gutterEl.style.display = e.target.checked ? '' : 'none';
});

/* keep highlight in sync with window resize for layout changes */
window.addEventListener('resize', scheduleHighlight);

/* -----------------------------
   Initial render: tree + open a default file
   ----------------------------- */
renderTree(sampleFiles, fileTreeEl);

// open first file by default (if any)
(function openFirst(){
  // find first file in sampleFiles recursively
  function findFirstFile(nodes){
    for(const n of nodes){
      if(n.type === 'file') return n;
      if(n.type === 'folder') {
        const r = findFirstFile(n.children);
        if(r) return r;
      }
    }
    return null;
  }
  const f = findFirstFile(sampleFiles);
  if(f) openFileTab(f);
})();
