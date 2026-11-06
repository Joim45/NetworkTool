/* HomeLab Topology – edytor topologii sieci home lab (vanilla JS, bez zależności). */
(function () {
  'use strict';

  const { DEVICE_TYPES, CATEGORIES, LINK_TYPES, SPEEDS, SPEED_WIDTH, STATUSES } = HL;

  const GRID = 20;
  const STORE_KEY = 'homelab-topology:v1';
  const SETTINGS_KEY = 'homelab-topology:settings';
  const EXPORT_BG = '#0b1120';

  /* Style SVG – osadzone w samym <svg>, dzięki czemu eksport PNG/SVG wygląda identycznie. */
  const SVG_CSS = `
    text { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .node { cursor: move; }
    .node-tile { stroke-width: 2; }
    .node-icon { pointer-events: none; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .node-icon .f { fill: currentColor; stroke: none; }
    .node-name { fill: #e2e8f0; font-size: 12px; font-weight: 600; text-anchor: middle; paint-order: stroke; stroke: #0b1120; stroke-width: 4px; stroke-linejoin: round; }
    .node-ip { fill: #94a3b8; font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-anchor: middle; paint-order: stroke; stroke: #0b1120; stroke-width: 4px; stroke-linejoin: round; }
    .node-ip.conflict { fill: #f87171; }
    .node-status { stroke: #0b1120; stroke-width: 2.5; }
    .node-sel { fill: none; stroke: none; }
    .node.selected .node-sel { stroke: #f8fafc; stroke-width: 1.5; stroke-dasharray: 4 3; }
    .node.connect-src .node-sel, .node.link-target .node-sel { stroke: #22d3ee; stroke-width: 2.5; stroke-dasharray: none; }
    .handle { fill: #0b1120; stroke: #22d3ee; stroke-width: 2; opacity: 0; cursor: crosshair; transition: opacity .1s; }
    .node:hover .handle, .node.selected .handle { opacity: 1; }
    .link-hit { fill: none; stroke: transparent; stroke-width: 14; cursor: pointer; }
    .link-line { fill: none; stroke-linecap: round; pointer-events: none; }
    .link.selected .link-glow { stroke: #f8fafc; stroke-opacity: .35; fill: none; pointer-events: none; }
    .link-label { pointer-events: none; }
    .link-label rect { fill: #0f172a; stroke: #334155; }
    .link-label text { fill: #cbd5e1; font-size: 10px; text-anchor: middle; dominant-baseline: central; }
    .port-label { fill: #7c8aa3; font-size: 9.5px; text-anchor: middle; dominant-baseline: central; paint-order: stroke; stroke: #0b1120; stroke-width: 3px; pointer-events: none; }
    .zone-body { stroke-width: 1.5; stroke-dasharray: 7 5; pointer-events: none; }
    .zone.selected .zone-body { stroke-dasharray: none; stroke-width: 2; }
    .zone-header { fill: transparent; cursor: move; }
    .zone-title { font-size: 13px; font-weight: 700; pointer-events: none; }
    .zone-desc { font-weight: 400; fill-opacity: .7; }
    .zone-resize { fill: transparent; cursor: nwse-resize; }
    .zone.selected .zone-resize { fill: currentColor; fill-opacity: .6; }
    .sel-box { fill: rgba(59,130,246,.08); stroke: #3b82f6; stroke-dasharray: 4 3; }
    .temp-link { stroke: #22d3ee; stroke-dasharray: 6 4; fill: none; }
  `;

  /* ---------- Narzędzia ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const typeInfo = (t) => DEVICE_TYPES[t] || DEVICE_TYPES.generic;
  const linkInfo = (t) => LINK_TYPES[t] || LINK_TYPES.ethernet;
  const ipBase = (ip) => String(ip || '').trim().split('/')[0];
  const slug = (s) => (String(s || 'topologia').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topologia');

  function isValidIP(ip) {
    const v = String(ip || '').trim();
    if (!v) return true;
    const [addr, cidr] = v.split('/');
    if (cidr !== undefined && !/^\d{1,3}$/.test(cidr)) return false;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(addr)) return addr.split('.').every((o) => +o <= 255) && (cidr === undefined || +cidr <= 32);
    return /^[0-9a-f:]+$/i.test(addr) && addr.includes(':'); // uproszczona walidacja IPv6
  }

  function ipSortKey(ip) {
    const a = ipBase(ip);
    if (!a) return '~';
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(a)) return a.split('.').map((o) => o.padStart(3, '0')).join('.');
    return 'z' + a;
  }

  /* ---------- Elementy DOM ---------- */
  const svg = $('#canvas');
  const viewport = $('#viewport');
  const zonesLayer = $('#zonesLayer');
  const linksLayer = $('#linksLayer');
  const nodesLayer = $('#nodesLayer');
  const overlay = $('#overlayLayer');
  const wrap = $('#canvasWrap');
  const propsPanel = $('#propsPanel');
  $('#svgStyle').textContent = SVG_CSS;

  /* ---------- Stan ---------- */
  let state = blankState();
  const view = { x: 0, y: 0, k: 1 };
  const sel = { nodes: new Set(), links: new Set(), zones: new Set() };
  const settings = { snap: true };
  let connectMode = false;
  let connectFrom = null;
  let drag = null;
  let spaceDown = false;
  let clipboard = null;
  let activeTab = 'props';
  const inv = { key: 'ip', dir: 1, filter: '' };
  const history = { stack: [], index: -1 };

  function blankState() {
    return { version: 1, name: 'Mój home lab', nodes: [], links: [], zones: [] };
  }
  function nodeDefaults() {
    return { name: '', type: 'generic', status: 'online', ip: '', mac: '', vlan: '', model: '', os: '', specs: '', services: '', location: '', color: '', notes: '' };
  }
  function linkDefaults() {
    return { type: 'ethernet', speed: '1G', fromPort: '', toPort: '', vlan: '', label: '', notes: '' };
  }
  function zoneDefaults() {
    return { name: 'Strefa', desc: '', color: '#38bdf8' };
  }

  function normalize(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.nodes)) throw new Error('To nie jest plik topologii (brak listy „nodes”).');
    const s = blankState();
    if (typeof data.name === 'string') s.name = data.name;
    const str = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' || typeof v === 'string' ? v : v == null ? '' : String(v)]));
    s.nodes = data.nodes.filter((n) => n && n.id).map((n) => ({
      ...nodeDefaults(), ...str(n), id: String(n.id), x: +n.x || 0, y: +n.y || 0,
      type: DEVICE_TYPES[n.type] ? n.type : 'generic', status: STATUSES[n.status] ? n.status : 'online'
    }));
    const ids = new Set(s.nodes.map((n) => n.id));
    s.links = (Array.isArray(data.links) ? data.links : [])
      .filter((l) => l && l.id && ids.has(String(l.from)) && ids.has(String(l.to)) && l.from !== l.to)
      .map((l) => ({ ...linkDefaults(), ...str(l), id: String(l.id), from: String(l.from), to: String(l.to), type: LINK_TYPES[l.type] ? l.type : 'ethernet' }));
    s.zones = (Array.isArray(data.zones) ? data.zones : []).filter((z) => z && z.id).map((z) => ({
      ...zoneDefaults(), ...str(z), id: String(z.id), x: +z.x || 0, y: +z.y || 0, w: Math.max(120, +z.w || 300), h: Math.max(80, +z.h || 200)
    }));
    return s;
  }

  const nodeById = (id) => state.nodes.find((n) => n.id === id);
  const linkById = (id) => state.links.find((l) => l.id === id);
  const zoneById = (id) => state.zones.find((z) => z.id === id);
  const findObj = (kind, id) => (kind === 'node' ? nodeById(id) : kind === 'link' ? linkById(id) : kind === 'zone' ? zoneById(id) : null);
  const selCount = () => sel.nodes.size + sel.links.size + sel.zones.size;

  function clearSel() { sel.nodes.clear(); sel.links.clear(); sel.zones.clear(); }
  function selectOnly(kind, id) { clearSel(); sel[kind].add(id); }
  function pruneSel() {
    for (const id of [...sel.nodes]) if (!nodeById(id)) sel.nodes.delete(id);
    for (const id of [...sel.links]) if (!linkById(id)) sel.links.delete(id);
    for (const id of [...sel.zones]) if (!zoneById(id)) sel.zones.delete(id);
    if (connectFrom && !nodeById(connectFrom)) connectFrom = null;
  }

  function duplicateIPs() {
    const count = {};
    state.nodes.forEach((n) => { const ip = ipBase(n.ip); if (ip) count[ip] = (count[ip] || 0) + 1; });
    return new Set(Object.keys(count).filter((k) => count[k] > 1));
  }

  /* ---------- Historia i zapis ---------- */
  function commit() {
    const snap = JSON.stringify(state);
    if (snap === history.stack[history.index]) return;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snap);
    if (history.stack.length > 200) history.stack.shift();
    history.index = history.stack.length - 1;
    persist();
    updateToolbar();
  }
  function restore(idx) {
    history.index = idx;
    state = JSON.parse(history.stack[idx]);
    pruneSel();
    persist();
    renderAll();
  }
  const undo = () => { if (history.index > 0) restore(history.index - 1); };
  const redo = () => { if (history.index < history.stack.length - 1) restore(history.index + 1); };

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* brak miejsca / tryb prywatny */ }
  }
  function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignoruj */ }
  }

  function loadState(newState, { fit = true, msg } = {}) {
    state = newState;
    clearSel();
    connectFrom = null;
    commit();
    renderAll();
    if (fit) fitView();
    if (msg) toast(msg);
  }

  /* ---------- Widok (pan / zoom) ---------- */
  function applyView() {
    viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    const g = GRID * view.k;
    wrap.style.backgroundSize = `${g}px ${g}px`;
    wrap.style.backgroundPosition = `${view.x - g / 2}px ${view.y - g / 2}px`;
    wrap.classList.toggle('no-grid', !settings.snap || view.k < 0.35);
    $('#zoomLabel').textContent = Math.round(view.k * 100) + '%';
  }
  function toWorld(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k };
  }
  function zoomAt(clientX, clientY, factor) {
    const r = svg.getBoundingClientRect();
    const sx = clientX - r.left, sy = clientY - r.top;
    const k = clamp(view.k * factor, 0.15, 3);
    const wx = (sx - view.x) / view.k, wy = (sy - view.y) / view.k;
    view.k = k;
    view.x = sx - wx * k;
    view.y = sy - wy * k;
    applyView();
  }
  function zoomCenter(factor) {
    const r = svg.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }
  function viewCenterWorld() {
    const r = svg.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  function contentBBox() {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    state.nodes.forEach((n) => { x1 = Math.min(x1, n.x - 55); y1 = Math.min(y1, n.y - 40); x2 = Math.max(x2, n.x + 55); y2 = Math.max(y2, n.y + 70); });
    state.zones.forEach((z) => { x1 = Math.min(x1, z.x); y1 = Math.min(y1, z.y); x2 = Math.max(x2, z.x + z.w); y2 = Math.max(y2, z.y + z.h); });
    return isFinite(x1) ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
  }
  function fitView() {
    const bb = contentBBox();
    const r = svg.getBoundingClientRect();
    if (!bb || !r.width) { view.x = r.width / 2 || 0; view.y = r.height / 2 || 0; view.k = 1; applyView(); return; }
    const pad = 50;
    view.k = clamp(Math.min((r.width - pad * 2) / bb.w, (r.height - pad * 2) / bb.h), 0.15, 1.5);
    view.x = r.width / 2 - (bb.x + bb.w / 2) * view.k;
    view.y = r.height / 2 - (bb.y + bb.h / 2) * view.k;
    applyView();
  }
  function centerOn(n) {
    const r = svg.getBoundingClientRect();
    view.x = r.width / 2 - n.x * view.k;
    view.y = r.height / 2 - n.y * view.k;
    applyView();
  }

  /* ---------- Rysowanie ---------- */
  function renderAll() {
    render();
    renderPanel();
    renderInventory();
  }

  function render() {
    renderZones();
    renderLinks();
    renderNodes();
    applyView();
    updateToolbar();
    $('#emptyHint').hidden = state.nodes.length > 0 || state.zones.length > 0;
    $('#statusbar').textContent = `Urządzenia: ${state.nodes.length} · Połączenia: ${state.links.length} · Strefy: ${state.zones.length}` +
      (selCount() ? ` · Zaznaczono: ${selCount()}` : '');
  }

  function nodeTooltip(n) {
    const t = typeInfo(n.type);
    return [n.name, t.label, n.ip && 'IP: ' + n.ip, n.vlan && 'VLAN: ' + n.vlan, n.os && 'System: ' + n.os, n.services && 'Usługi: ' + n.services]
      .filter(Boolean).join('\n');
  }

  function renderNodes() {
    const dups = duplicateIPs();
    nodesLayer.innerHTML = state.nodes.map((n) => {
      const t = typeInfo(n.type);
      const color = n.color || t.color;
      const cls = ['node', sel.nodes.has(n.id) && 'selected', connectFrom === n.id && 'connect-src'].filter(Boolean).join(' ');
      const st = STATUSES[n.status];
      const conflict = n.ip && dups.has(ipBase(n.ip));
      return `<g class="${cls}" data-id="${esc(n.id)}" transform="translate(${n.x} ${n.y})"${n.status === 'planned' ? ' opacity="0.6"' : ''}>
        <title>${esc(nodeTooltip(n))}</title>
        <rect class="node-sel" x="-37" y="-37" width="74" height="74" rx="17"/>
        <rect class="node-tile" x="-30" y="-30" width="60" height="60" rx="14" fill="${esc(color)}" fill-opacity="0.15" stroke="${esc(color)}"/>
        <g class="node-icon" style="color:${esc(color)}" transform="translate(-16 -16) scale(1.3333)">${t.icon}</g>
        ${st ? `<circle class="node-status" cx="27" cy="-27" r="6" fill="${st.color}"/>` : ''}
        <text class="node-name" y="49">${esc(n.name || t.label)}</text>
        ${n.ip ? `<text class="node-ip${conflict ? ' conflict' : ''}" y="64">${esc(n.ip)}${conflict ? ' ⚠' : ''}</text>` : ''}
        <circle class="handle" data-handle="${esc(n.id)}" cx="31" cy="0" r="7"/>
      </g>`;
    }).join('');
  }

  function linkGeometry() {
    // Równoległe połączenia między tą samą parą urządzeń są wyginane, żeby się nie nakładały.
    const groups = {};
    state.links.forEach((l) => { const k = [l.from, l.to].sort().join('|'); (groups[k] = groups[k] || []).push(l); });
    const geo = {};
    Object.entries(groups).forEach(([key, list]) => {
      const [k0, k1] = key.split('|');
      const A = nodeById(k0), B = nodeById(k1);
      if (!A || !B) return;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      list.forEach((l, i) => {
        const off = (i - (list.length - 1) / 2) * 26;
        const a = nodeById(l.from), b = nodeById(l.to);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const cx = mx + nx * off * 2, cy = my + ny * off * 2;
        const d = off ? `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x} ${b.y}`;
        // Odległość od środka urządzenia, w której linia wychodzi poza kafelek z podpisem.
        const boxExit = (ux, uy, hx, top, bottom) => Math.min(
          ux ? hx / Math.abs(ux) : Infinity,
          uy > 0 ? bottom / uy : uy < 0 ? top / -uy : Infinity);
        const exitDist = (p, ux, uy) => {
          // najpierw sam kafelek; jeśli linia wychodzi dołem w obszar podpisu – szerszy prostokąt podpisu
          const t = boxExit(ux, uy, 38, 36, 34);
          return uy * t > 32 ? boxExit(ux, uy, 58, 36, 72) : t;
        };
        const dirTo = (p) => { const ux = cx - p.x, uy = cy - p.y, ul = Math.hypot(ux, uy) || 1; return [ux / ul, uy / ul]; };
        const portPos = (p) => {
          const [ux, uy] = dirTo(p);
          const dist = exitDist(p, ux, uy) + 12;
          return { x: p.x + ux * dist, y: p.y + uy * dist, dist };
        };
        const pa = portPos(a), pb = portPos(b);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        let lx = mx + nx * off, ly = my + ny * off;
        if (!off) {
          // etykietę na środku widocznego odcinka, a nie na geometrycznym środku
          const t0 = (pa.dist - 12) / len, t1 = 1 - (pb.dist - 12) / len;
          if (t1 > t0) { const t = (t0 + t1) / 2; lx = a.x + (b.x - a.x) * t; ly = a.y + (b.y - a.y) * t; }
        }
        geo[l.id] = { d, lx, ly, pa, pb, len, room: len - pa.dist - pb.dist };
      });
    });
    return geo;
  }

  function linkText(l) {
    return [l.label, l.speed, l.vlan && 'VLAN ' + l.vlan].filter(Boolean).join(' · ');
  }

  function renderLinks() {
    const geo = linkGeometry();
    linksLayer.innerHTML = state.links.map((l) => {
      const g = geo[l.id];
      if (!g) return '';
      const t = linkInfo(l.type);
      const w = SPEED_WIDTH[l.speed] ?? 2;
      const selected = sel.links.has(l.id);
      const text = linkText(l);
      const tw = text.length * 5.6 + 12;
      const showPorts = g.room > (text ? tw + 10 : 0);
      return `<g class="link${selected ? ' selected' : ''}" data-id="${esc(l.id)}">
        <title>${esc([linkInfo(l.type).label, text, l.notes].filter(Boolean).join('\n'))}</title>
        ${selected ? `<path class="link-glow" d="${g.d}" stroke-width="${w + 7}" stroke-linecap="round"/>` : ''}
        <path class="link-hit" d="${g.d}"/>
        <path class="link-line" d="${g.d}" stroke="${t.color}" stroke-width="${w}"${t.dash ? ` stroke-dasharray="${t.dash}"` : ''}/>
        ${text ? `<g class="link-label" transform="translate(${g.lx} ${g.ly})"><rect x="${-tw / 2}" y="-9" width="${tw}" height="18" rx="9"/><text>${esc(text)}</text></g>` : ''}
        ${showPorts && l.fromPort ? `<text class="port-label" x="${g.pa.x}" y="${g.pa.y}">${esc(l.fromPort)}</text>` : ''}
        ${showPorts && l.toPort ? `<text class="port-label" x="${g.pb.x}" y="${g.pb.y}">${esc(l.toPort)}</text>` : ''}
      </g>`;
    }).join('');
  }

  function renderZones() {
    // Większe strefy pod spodem, mniejsze (zagnieżdżone) na wierzchu.
    const zones = [...state.zones].sort((a, b) => b.w * b.h - a.w * a.h);
    zonesLayer.innerHTML = zones.map((z) => `
      <g class="zone${sel.zones.has(z.id) ? ' selected' : ''}" data-id="${esc(z.id)}" transform="translate(${z.x} ${z.y})" style="color:${esc(z.color)}">
        <rect class="zone-body" width="${z.w}" height="${z.h}" rx="14" fill="${esc(z.color)}" fill-opacity="0.06" stroke="${esc(z.color)}"/>
        <rect class="zone-header" width="${z.w}" height="32" rx="14"/>
        <text class="zone-title" x="14" y="21" fill="${esc(z.color)}">${esc(z.name)}${z.desc ? `<tspan class="zone-desc" dx="8">${esc(z.desc)}</tspan>` : ''}</text>
        <rect class="zone-resize" data-resize="${esc(z.id)}" x="${z.w - 14}" y="${z.h - 14}" width="14" height="14" rx="3"/>
      </g>`).join('');
  }

  /* ---------- Operacje na modelu ---------- */
  function addNode(type, x, y) {
    const t = typeInfo(type);
    const count = state.nodes.filter((n) => n.type === type).length;
    const n = { ...nodeDefaults(), id: uid('n'), type, name: count ? `${t.label} ${count + 1}` : t.label, x: snap(x), y: snap(y) };
    state.nodes.push(n);
    selectOnly('nodes', n.id);
    commit();
    renderAll();
    return n;
  }

  function guessLinkType(a, b) {
    const types = [a.type, b.type];
    const wireless = ['laptop', 'phone', 'iot', 'tv', 'camera', 'printer'];
    if (types.includes('ups') || types.includes('pdu')) return { type: 'power', speed: '' };
    if (types.some((t) => t === 'vm' || t === 'container')) return { type: 'virtual', speed: '' };
    if (types.includes('ap') && types.some((t) => wireless.includes(t))) return { type: 'wifi', speed: '' };
    if (types.includes('internet') || types.includes('cloud')) return { type: 'ethernet', speed: '1G' };
    return { type: 'ethernet', speed: '1G' };
  }

  function addLink(from, to) {
    if (from === to) return;
    const a = nodeById(from), b = nodeById(to);
    if (!a || !b) return;
    const l = { ...linkDefaults(), ...guessLinkType(a, b), id: uid('l'), from, to };
    state.links.push(l);
    selectOnly('links', l.id);
    commit();
    renderAll();
    toast(`Połączono: ${a.name} ⟷ ${b.name}`);
  }

  function addZone() {
    let z;
    const pal = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb7185', '#94a3b8'];
    const color = pal[state.zones.length % pal.length];
    const selNodes = [...sel.nodes].map(nodeById).filter(Boolean);
    if (selNodes.length) {
      const xs = selNodes.map((n) => n.x), ys = selNodes.map((n) => n.y);
      const x = snap(Math.min(...xs) - 70), y = snap(Math.min(...ys) - 80);
      z = { ...zoneDefaults(), id: uid('z'), x, y, w: snap(Math.max(...xs) + 70 - x + 10), h: snap(Math.max(...ys) + 90 - y + 10), color };
    } else {
      const c = viewCenterWorld();
      z = { ...zoneDefaults(), id: uid('z'), x: snap(c.x - 180), y: snap(c.y - 120), w: 360, h: 240, color };
    }
    z.name = `Strefa ${state.zones.length + 1}`;
    state.zones.push(z);
    selectOnly('zones', z.id);
    commit();
    renderAll();
    focusField('name');
  }

  function deleteSelection() {
    if (!selCount()) return;
    const nodes = sel.nodes;
    state.nodes = state.nodes.filter((n) => !nodes.has(n.id));
    state.links = state.links.filter((l) => !sel.links.has(l.id) && !nodes.has(l.from) && !nodes.has(l.to));
    state.zones = state.zones.filter((z) => !sel.zones.has(z.id));
    clearSel();
    pruneSel();
    commit();
    renderAll();
  }

  function copySelection() {
    const nodes = state.nodes.filter((n) => sel.nodes.has(n.id));
    if (!nodes.length) return false;
    const ids = new Set(nodes.map((n) => n.id));
    clipboard = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      links: JSON.parse(JSON.stringify(state.links.filter((l) => ids.has(l.from) && ids.has(l.to))))
    };
    return true;
  }

  function paste(offset = 40) {
    if (!clipboard) return;
    const map = {};
    clearSel();
    clipboard.nodes.forEach((n) => {
      const copy = { ...n, id: uid('n'), x: n.x + offset, y: n.y + offset, name: n.name + ' (kopia)', ip: '' };
      map[n.id] = copy.id;
      state.nodes.push(copy);
      sel.nodes.add(copy.id);
    });
    clipboard.links.forEach((l) => state.links.push({ ...l, id: uid('l'), from: map[l.from], to: map[l.to] }));
    // przesuwaj kolejne wklejenia dalej
    clipboard.nodes.forEach((n) => { n.x += offset; n.y += offset; });
    commit();
    renderAll();
  }

  function duplicateSelection() {
    if (copySelection()) paste();
  }

  function align(mode) {
    const nodes = [...sel.nodes].map(nodeById).filter(Boolean);
    if (nodes.length < 2) return;
    if (mode === 'h') { const y = snap(nodes.reduce((s, n) => s + n.y, 0) / nodes.length); nodes.forEach((n) => (n.y = y)); }
    if (mode === 'v') { const x = snap(nodes.reduce((s, n) => s + n.x, 0) / nodes.length); nodes.forEach((n) => (n.x = x)); }
    if (mode === 'dh' || mode === 'dv') {
      const k = mode === 'dh' ? 'x' : 'y';
      nodes.sort((a, b) => a[k] - b[k]);
      const first = nodes[0][k], step = (nodes[nodes.length - 1][k] - first) / (nodes.length - 1);
      nodes.forEach((n, i) => (n[k] = Math.round(first + step * i)));
    }
    commit();
    renderAll();
  }

  const snap = (v) => (settings.snap ? Math.round(v / GRID) * GRID : Math.round(v));

  function setConnectMode(on) {
    connectMode = on;
    connectFrom = null;
    wrap.classList.toggle('connecting', on);
    updateModeHint();
    render();
  }
  function updateModeHint() {
    const h = $('#modeHint');
    if (!connectMode) { h.classList.remove('show'); return; }
    const from = connectFrom && nodeById(connectFrom);
    h.textContent = from ? `Wybierz drugie urządzenie dla „${from.name}” · Esc – anuluj` : 'Tryb łączenia: kliknij pierwsze urządzenie · Esc – zakończ';
    h.classList.add('show');
  }

  /* ---------- Obsługa myszy na płótnie ---------- */
  function insideZone(n, z) { return n.x >= z.x && n.x <= z.x + z.w && n.y >= z.y && n.y <= z.y + z.h; }
  function zoneInZone(a, b) { return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h; }

  function collectMoveItems() {
    const nodeIds = new Set(sel.nodes), zoneIds = new Set(sel.zones);
    for (const zid of sel.zones) {
      const z = zoneById(zid);
      if (!z) continue;
      state.nodes.forEach((n) => { if (insideZone(n, z)) nodeIds.add(n.id); });
      state.zones.forEach((z2) => { if (z2 !== z && zoneInZone(z2, z)) zoneIds.add(z2.id); });
    }
    return [...[...nodeIds].map(nodeById), ...[...zoneIds].map(zoneById)].filter(Boolean).map((o) => ({ o, x0: o.x, y0: o.y }));
  }

  svg.addEventListener('pointerdown', (e) => {
    if (drag) return;
    const p = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, silent: true };
      svg.setPointerCapture(e.pointerId);
      wrap.classList.add('dragging');
      return;
    }
    if (e.button !== 0) return;
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const handle = e.target.closest('[data-handle]');
    const resize = e.target.closest('[data-resize]');
    const nodeEl = e.target.closest('.node');
    const linkEl = e.target.closest('.link');
    const zoneEl = e.target.closest('.zone');
    svg.setPointerCapture(e.pointerId);

    if (handle && !connectMode) {
      drag = { mode: 'link', from: handle.dataset.handle, target: null };
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (connectMode) {
        if (!connectFrom) { connectFrom = id; updateModeHint(); render(); }
        else if (connectFrom !== id) { const from = connectFrom; connectFrom = null; addLink(from, id); updateModeHint(); }
        return;
      }
      const wasSelected = sel.nodes.has(id);
      if (multi) { wasSelected ? sel.nodes.delete(id) : sel.nodes.add(id); }
      else if (!wasSelected) selectOnly('nodes', id);
      drag = { mode: 'move', start: p, items: collectMoveItems(), moved: false, clickId: id, multi, wasSelected };
      renderAll();
      return;
    }
    if (resize) {
      const z = zoneById(resize.dataset.resize);
      selectOnly('zones', z.id);
      drag = { mode: 'resize', z, start: p, w0: z.w, h0: z.h, moved: false };
      renderAll();
      return;
    }
    if (zoneEl && e.target.classList.contains('zone-header')) {
      const id = zoneEl.dataset.id;
      const wasSelected = sel.zones.has(id);
      if (multi) { wasSelected ? sel.zones.delete(id) : sel.zones.add(id); }
      else if (!wasSelected) selectOnly('zones', id);
      drag = { mode: 'move', start: p, items: collectMoveItems(), moved: false, clickZone: id, multi, wasSelected };
      renderAll();
      return;
    }
    if (linkEl) {
      const id = linkEl.dataset.id;
      if (multi) { sel.links.has(id) ? sel.links.delete(id) : sel.links.add(id); }
      else selectOnly('links', id);
      renderAll();
      return;
    }
    if (connectMode && connectFrom) { connectFrom = null; updateModeHint(); render(); return; }
    if (e.shiftKey) {
      drag = { mode: 'box', start: p, cur: p, add: true };
      return;
    }
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    wrap.classList.add('panning', 'dragging');
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toWorld(e.clientX, e.clientY);
    switch (drag.mode) {
      case 'pan': {
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        view.x = drag.vx + dx;
        view.y = drag.vy + dy;
        applyView();
        break;
      }
      case 'move': {
        let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) * view.k < 3) return;
        drag.moved = true;
        if (settings.snap) { dx = Math.round(dx / GRID) * GRID; dy = Math.round(dy / GRID) * GRID; }
        drag.items.forEach((it) => { it.o.x = it.x0 + dx; it.o.y = it.y0 + dy; });
        render();
        break;
      }
      case 'resize': {
        drag.moved = true;
        drag.z.w = Math.max(120, snap(drag.w0 + p.x - drag.start.x));
        drag.z.h = Math.max(80, snap(drag.h0 + p.y - drag.start.y));
        renderZones();
        break;
      }
      case 'link': {
        const from = nodeById(drag.from);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetEl = el && el.closest && el.closest('.node');
        const target = targetEl && targetEl.dataset.id !== drag.from ? targetEl.dataset.id : null;
        $$('.node.link-target', nodesLayer).forEach((n) => n.classList.remove('link-target'));
        if (target) targetEl.classList.add('link-target');
        drag.target = target;
        const end = target ? nodeById(target) : p;
        overlay.innerHTML = `<line class="temp-link" x1="${from.x}" y1="${from.y}" x2="${end.x}" y2="${end.y}" stroke-width="${2 / view.k}"/>`;
        break;
      }
      case 'box': {
        drag.cur = p;
        const x = Math.min(drag.start.x, p.x), y = Math.min(drag.start.y, p.y);
        overlay.innerHTML = `<rect class="sel-box" x="${x}" y="${y}" width="${Math.abs(p.x - drag.start.x)}" height="${Math.abs(p.y - drag.start.y)}" stroke-width="${1 / view.k}"/>`;
        break;
      }
    }
  });

  function endDrag(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    wrap.classList.remove('dragging');
    if (!spaceDown) wrap.classList.remove('panning');
    try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignoruj */ }
    overlay.innerHTML = '';
    switch (d.mode) {
      case 'pan':
        if (!d.moved && !d.silent && selCount()) { clearSel(); renderAll(); }
        break;
      case 'move':
        if (d.moved) { commit(); renderAll(); }
        else if (!d.multi && selCount() > 1) {
          if (d.clickId) selectOnly('nodes', d.clickId);
          if (d.clickZone) selectOnly('zones', d.clickZone);
          renderAll();
        }
        break;
      case 'resize':
        if (d.moved) commit();
        renderAll();
        break;
      case 'link':
        if (d.target) addLink(d.from, d.target);
        else render();
        break;
      case 'box': {
        const x1 = Math.min(d.start.x, d.cur.x), x2 = Math.max(d.start.x, d.cur.x);
        const y1 = Math.min(d.start.y, d.cur.y), y2 = Math.max(d.start.y, d.cur.y);
        state.nodes.forEach((n) => { if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) sel.nodes.add(n.id); });
        state.zones.forEach((z) => { if (z.x >= x1 && z.y >= y1 && z.x + z.w <= x2 && z.y + z.h <= y2) sel.zones.add(z.id); });
        renderAll();
        break;
      }
    }
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  svg.addEventListener('dblclick', (e) => {
    const nodeEl = e.target.closest('.node');
    const zoneEl = e.target.closest('.zone');
    const linkEl = e.target.closest('.link');
    if (nodeEl || linkEl || zoneEl) { switchTab('props'); focusField(linkEl && !nodeEl ? 'label' : 'name'); }
  });

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX, e.clientY, Math.exp(-delta * 0.0015));
  }, { passive: false });

  /* Przeciąganie z palety */
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!DEVICE_TYPES[type]) return;
    const p = toWorld(e.clientX, e.clientY);
    addNode(type, p.x, p.y);
  });

  /* ---------- Paleta ---------- */
  function iconSVG(type, cls = 'pal-icon') {
    return `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${typeInfo(type).icon}</svg>`;
  }

  function renderPalette() {
    const q = $('#paletteSearch').value.trim().toLowerCase();
    $('#paletteList').innerHTML = CATEGORIES.map((c) => {
      const items = Object.entries(DEVICE_TYPES).filter(([k, t]) => t.cat === c.id && (!q || t.label.toLowerCase().includes(q) || k.includes(q)));
      if (!items.length) return '';
      return `<div class="pal-cat">${esc(c.label)}</div><div class="pal-grid">${items.map(([k, t]) => `
        <div class="pal-item" draggable="true" data-type="${k}" style="--c:${t.color}" title="Przeciągnij na płótno lub kliknij">
          ${iconSVG(k)}<span>${esc(t.label)}</span>
        </div>`).join('')}</div>`;
    }).join('') || '<div class="muted">Brak wyników</div>';
  }
  $('#paletteSearch').addEventListener('input', renderPalette);
  $('#paletteList').addEventListener('dragstart', (e) => {
    const item = e.target.closest('.pal-item');
    if (!item) return;
    e.dataTransfer.setData('text/plain', item.dataset.type);
    e.dataTransfer.effectAllowed = 'copy';
  });
  $('#paletteList').addEventListener('click', (e) => {
    const item = e.target.closest('.pal-item');
    if (!item) return;
    const c = viewCenterWorld();
    const jitter = (state.nodes.length % 5) * GRID;
    addNode(item.dataset.type, c.x + jitter, c.y + jitter);
  });

  function renderLegend() {
    $('#linkLegend').innerHTML = Object.values(LINK_TYPES).map((t) => `
      <div class="legend-row"><svg viewBox="0 0 36 10"><line x1="2" y1="5" x2="34" y2="5" stroke="${t.color}" stroke-width="2.5" stroke-linecap="round"${t.dash ? ` stroke-dasharray="${t.dash}"` : ''}/></svg>${esc(t.label)}</div>`).join('');
  }

  /* ---------- Panel właściwości ---------- */
  const attrs = (kind, id, field) => `data-kind="${kind}" data-id="${esc(id)}" data-field="${field}"`;
  const fInput = (kind, o, field, label, ph = '', cls = '') =>
    `<label class="field"><span>${label}</span><input type="text" class="${cls}" ${attrs(kind, o.id, field)} value="${esc(o[field])}" placeholder="${esc(ph)}" spellcheck="false"></label>`;
  const fText = (kind, o, field, label, ph = '') =>
    `<label class="field"><span>${label}</span><textarea ${attrs(kind, o.id, field)} placeholder="${esc(ph)}" rows="3">${esc(o[field])}</textarea></label>`;
  const fSelect = (kind, o, field, label, optionsHTML) =>
    `<label class="field"><span>${label}</span><select ${attrs(kind, o.id, field)}>${optionsHTML}</select></label>`;
  const opts = (pairs, cur) => pairs.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');

  function typeOptions(cur) {
    return CATEGORIES.map((c) => `<optgroup label="${esc(c.label)}">${opts(Object.entries(DEVICE_TYPES).filter(([, t]) => t.cat === c.id).map(([k, t]) => [k, t.label]), cur)}</optgroup>`).join('');
  }

  function colorField(kind, o, fallback) {
    return `<label class="field"><span>Kolor</span><div class="color-row">
      <input type="color" ${attrs(kind, o.id, 'color')} value="${esc(o.color || fallback)}">
      ${kind === 'node' ? `<button class="btn" data-action="reset-color" data-id="${esc(o.id)}">Domyślny</button>` : ''}
    </div></label>`;
  }

  function nodeWarnings(n) {
    const out = [];
    if (n.ip && !isValidIP(n.ip)) out.push('Nieprawidłowy format adresu IP.');
    const ip = ipBase(n.ip);
    if (ip) {
      const others = state.nodes.filter((o) => o !== n && ipBase(o.ip) === ip).map((o) => o.name);
      if (others.length) out.push(`Konflikt IP z: ${others.join(', ')}`);
    }
    return out.map(esc).join('<br>');
  }

  function renderPanel() {
    if (activeTab !== 'props') return;
    const total = selCount();
    let html;
    if (total === 0) html = projectPanel();
    else if (total > 1) html = multiPanel();
    else if (sel.nodes.size) html = nodePanel(nodeById([...sel.nodes][0]));
    else if (sel.links.size) html = linkPanel(linkById([...sel.links][0]));
    else html = zonePanel(zoneById([...sel.zones][0]));
    propsPanel.innerHTML = html;
  }

  function projectPanel() {
    const byCat = CATEGORIES.map((c) => [c.label, state.nodes.filter((n) => typeInfo(n.type).cat === c.id).length]).filter(([, v]) => v);
    return `
      <div class="panel-head"><div><div class="ph-title">${esc(state.name)}</div><div class="ph-sub">Nic nie zaznaczono – kliknij element, aby go edytować.</div></div></div>
      <div class="stats">
        <div class="stat"><b>${state.nodes.length}</b><span>urządzeń</span></div>
        <div class="stat"><b>${state.links.length}</b><span>połączeń</span></div>
        <div class="stat"><b>${state.zones.length}</b><span>stref</span></div>
      </div>
      ${byCat.length ? `<div class="conn-list">${byCat.map(([l, v]) => `<div class="conn-item" style="cursor:default">${esc(l)}<span class="meta">${v}</span></div>`).join('')}</div>` : ''}
      <div class="section-title">Jak używać</div>
      <div class="kbd-list">
        <span><kbd>Przeciągnij</kbd></span><span>urządzenie z palety na płótno</span>
        <span><kbd>●</kbd> uchwyt</span><span>przeciągnij z uchwytu na inne urządzenie, by je połączyć</span>
        <span><kbd>L</kbd></span><span>tryb łączenia (klik A → klik B)</span>
        <span><kbd>Shift</kbd>+przeciąganie</span><span>zaznaczanie obszarem</span>
        <span><kbd>Spacja</kbd>/środkowy</span><span>przesuwanie widoku (lub przeciąganie tła)</span>
        <span><kbd>Kółko</kbd></span><span>powiększanie</span>
        <span><kbd>Del</kbd></span><span>usuń zaznaczenie</span>
        <span><kbd>Ctrl</kbd>+<kbd>D</kbd></span><span>duplikuj (także <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd>)</span>
        <span><kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd></span><span>cofnij / ponów</span>
        <span><kbd>Strzałki</kbd></span><span>przesuń zaznaczone (z <kbd>Shift</kbd> o kratkę)</span>
        <span><kbd>F</kbd></span><span>dopasuj widok</span>
      </div>
      <p class="muted" style="margin-top:14px">Projekt zapisuje się automatycznie w przeglądarce. Użyj „Zapisz”, aby pobrać kopię w pliku JSON.</p>`;
  }

  function multiPanel() {
    return `
      <div class="panel-head"><div><div class="ph-title">Zaznaczono ${selCount()} elementów</div>
      <div class="ph-sub">${sel.nodes.size} urządzeń · ${sel.links.size} połączeń · ${sel.zones.size} stref</div></div></div>
      ${sel.nodes.size > 1 ? `<div class="section-title">Wyrównanie</div>
      <div class="actions" style="margin-top:0">
        <button class="btn" data-action="align" data-mode="h">Wyrównaj w poziomie</button>
        <button class="btn" data-action="align" data-mode="v">Wyrównaj w pionie</button>
        ${sel.nodes.size > 2 ? `<button class="btn" data-action="align" data-mode="dh">Rozłóż poziomo</button>
        <button class="btn" data-action="align" data-mode="dv">Rozłóż pionowo</button>` : ''}
      </div>` : ''}
      <div class="actions">
        ${sel.nodes.size ? '<button class="btn" data-action="zone">Utwórz strefę wokół</button><button class="btn" data-action="duplicate">Duplikuj</button>' : ''}
        <button class="btn danger" data-action="delete">Usuń zaznaczone</button>
      </div>`;
  }

  function nodePanel(n) {
    const t = typeInfo(n.type);
    const color = n.color || t.color;
    const links = state.links.filter((l) => l.from === n.id || l.to === n.id);
    return `
      <div class="panel-head">
        <div class="ph-icon" style="color:${esc(color)};background:${esc(color)}22">${iconSVG(n.type, '')}</div>
        <div><div class="ph-title" id="phTitle">${esc(n.name)}</div><div class="ph-sub">${esc(t.label)}</div></div>
      </div>
      ${fInput('node', n, 'name', 'Nazwa / hostname', 'np. pve-01')}
      <div class="grid-2">
        ${fSelect('node', n, 'type', 'Typ', typeOptions(n.type))}
        ${fSelect('node', n, 'status', 'Status', opts(Object.entries(STATUSES).map(([k, s]) => [k, s.label]), n.status))}
      </div>
      <div class="section-title">Sieć</div>
      <div class="grid-2">
        ${fInput('node', n, 'ip', 'Adres IP', '192.168.1.10/24', 'mono')}
        ${fInput('node', n, 'vlan', 'VLAN', 'np. 10')}
      </div>
      <div class="warn" id="nodeWarn">${nodeWarnings(n)}</div>
      ${fInput('node', n, 'mac', 'Adres MAC', 'aa:bb:cc:dd:ee:ff', 'mono')}
      <div class="section-title">Sprzęt i system</div>
      ${fInput('node', n, 'model', 'Model', 'np. Dell OptiPlex 7060 Micro')}
      ${fInput('node', n, 'os', 'System / firmware', 'np. Proxmox VE 8.2')}
      ${fInput('node', n, 'specs', 'Specyfikacja', 'CPU · RAM · dyski')}
      ${fInput('node', n, 'location', 'Lokalizacja', 'np. Rack U4, piwnica')}
      ${fText('node', n, 'services', 'Usługi / aplikacje', 'np. Plex, Nextcloud, Pi-hole')}
      ${colorField('node', n, t.color)}
      ${fText('node', n, 'notes', 'Notatki', '')}
      <div class="section-title">Połączenia (${links.length})</div>
      <div class="conn-list">${links.map((l) => {
        const other = nodeById(l.from === n.id ? l.to : l.from);
        const port = l.from === n.id ? l.fromPort : l.toPort;
        return `<div class="conn-item" data-action="select-link" data-id="${esc(l.id)}">
          <span class="sw" style="background:${linkInfo(l.type).color}"></span>
          <span>${port ? esc(port) + ' → ' : ''}${esc(other ? other.name : '?')}</span>
          <span class="meta">${esc([l.speed, linkInfo(l.type).label.split(' ')[0]].filter(Boolean).join(' '))}</span></div>`;
      }).join('') || '<div class="muted">Brak połączeń. Przeciągnij z niebieskiego uchwytu na inne urządzenie.</div>'}</div>
      <div class="actions">
        <button class="btn primary" data-action="connect-from" data-id="${esc(n.id)}">Połącz z…</button>
        <button class="btn" data-action="duplicate">Duplikuj</button>
        <button class="btn danger" data-action="delete">Usuń</button>
      </div>`;
  }

  function linkPanel(l) {
    const a = nodeById(l.from), b = nodeById(l.to);
    const nodeOpts = (cur) => opts([...state.nodes].sort((x, y) => x.name.localeCompare(y.name, 'pl')).map((n) => [n.id, n.name]), cur);
    return `
      <div class="panel-head">
        <div class="ph-icon" style="color:${linkInfo(l.type).color}"><svg viewBox="0 0 24 24"><path d="M4 12h16"${linkInfo(l.type).dash ? ` stroke-dasharray="${linkInfo(l.type).dash}"` : ''}/></svg></div>
        <div><div class="ph-title">${esc(a?.name)} ⟷ ${esc(b?.name)}</div><div class="ph-sub">${esc(linkInfo(l.type).label)}</div></div>
      </div>
      <div class="grid-2">
        ${fSelect('link', l, 'from', 'Od', nodeOpts(l.from))}
        ${fInput('link', l, 'fromPort', 'Port', 'np. eth0, P1')}
        ${fSelect('link', l, 'to', 'Do', nodeOpts(l.to))}
        ${fInput('link', l, 'toPort', 'Port', 'np. SFP+ 1')}
      </div>
      <div class="grid-2">
        ${fSelect('link', l, 'type', 'Medium', opts(Object.entries(LINK_TYPES).map(([k, t]) => [k, t.label]), l.type))}
        ${fSelect('link', l, 'speed', 'Prędkość', opts(SPEEDS.map((s) => [s, s || '—']), l.speed))}
      </div>
      ${fInput('link', l, 'vlan', 'VLAN-y', 'np. 10 lub 1,10,20 (trunk)')}
      ${fInput('link', l, 'label', 'Etykieta', 'np. LAG, PoE+, WireGuard')}
      ${fText('link', l, 'notes', 'Notatki', 'np. kabel Cat6A 3 m')}
      <div class="actions">
        <button class="btn" data-action="reverse">Odwróć kierunek</button>
        <button class="btn danger" data-action="delete">Usuń połączenie</button>
      </div>`;
  }

  function zonePanel(z) {
    const inside = state.nodes.filter((n) => insideZone(n, z));
    return `
      <div class="panel-head">
        <div class="ph-icon" style="color:${esc(z.color)}"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" stroke-dasharray="3 2"/></svg></div>
        <div><div class="ph-title" id="phTitle">${esc(z.name)}</div><div class="ph-sub">Strefa · ${inside.length} urządzeń wewnątrz</div></div>
      </div>
      ${fInput('zone', z, 'name', 'Nazwa', 'np. VLAN 10 – Serwery')}
      ${fInput('zone', z, 'desc', 'Opis / podsieć', 'np. 192.168.10.0/24')}
      ${colorField('zone', z, '#38bdf8')}
      <p class="muted">Przeciągnij nagłówek strefy, aby przesunąć ją razem z urządzeniami. Rozmiar zmienisz uchwytem w prawym dolnym rogu.</p>
      <div class="actions"><button class="btn danger" data-action="delete">Usuń strefę</button></div>`;
  }

  function focusField(field) {
    const el = propsPanel.querySelector(`[data-field="${field}"]`);
    if (el) { el.focus(); if (el.select) el.select(); }
  }

  propsPanel.addEventListener('input', (e) => {
    const el = e.target;
    const field = el.dataset.field;
    if (!field) return;
    const obj = findObj(el.dataset.kind, el.dataset.id);
    if (!obj) return;
    if (el.dataset.kind === 'link' && (field === 'from' || field === 'to')) {
      const other = field === 'from' ? obj.to : obj.from;
      if (el.value === other) { toast('Połączenie nie może łączyć urządzenia z samym sobą'); el.value = obj[field]; return; }
    }
    obj[field] = el.value;
    render();
    renderInventory();
    if (field === 'name' && $('#phTitle')) $('#phTitle').textContent = el.value;
    if (el.dataset.kind === 'node' && field === 'ip') {
      const w = $('#nodeWarn');
      if (w) w.innerHTML = nodeWarnings(obj);
    }
  });
  propsPanel.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset.field) return;
    commit();
    if (el.tagName === 'SELECT' || el.type === 'color') renderPanel();
  });

  /* ---------- Inwentarz ---------- */
  const INV_COLS = [
    ['name', 'Nazwa'],
    ['type', 'Typ'],
    ['ip', 'IP'],
    ['vlan', 'VLAN']
  ];

  function renderInventory() {
    if (activeTab !== 'inventory') return;
    const dups = duplicateIPs();
    const f = inv.filter.trim().toLowerCase();
    let rows = state.nodes.filter((n) => !f || [n.name, n.ip, typeInfo(n.type).label, n.vlan, n.model, n.os, n.services, n.mac, n.location, n.notes]
      .join(' ').toLowerCase().includes(f));
    const key = (n) => {
      if (inv.key === 'ip') return ipSortKey(n.ip);
      if (inv.key === 'type') return typeInfo(n.type).label;
      if (inv.key === 'vlan') return String(n.vlan || '~').padStart(6, '0');
      return String(n[inv.key] || '');
    };
    rows.sort((a, b) => key(a).localeCompare(key(b), 'pl', { numeric: true }) * inv.dir);

    const offline = state.nodes.filter((n) => n.status === 'offline').length;
    const invalid = state.nodes.filter((n) => n.ip && !isValidIP(n.ip)).length;
    const vlans = new Set(state.nodes.map((n) => String(n.vlan).trim()).filter(Boolean));
    $('#invSummary').innerHTML = [
      `<span class="chip">${state.nodes.length} urządzeń</span>`,
      `<span class="chip">${state.nodes.filter((n) => n.ip).length} z adresem IP</span>`,
      vlans.size ? `<span class="chip">VLAN: ${esc([...vlans].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true })).join(', '))}</span>` : '',
      dups.size ? `<span class="chip bad">⚠ Konflikty IP: ${esc([...dups].join(', '))}</span>` : '',
      invalid ? `<span class="chip bad">⚠ Błędne IP: ${invalid}</span>` : '',
      offline ? `<span class="chip bad">Offline: ${offline}</span>` : ''
    ].join('');

    $('#invTable').innerHTML = rows.length ? `<table class="inv-table">
      <thead><tr>${INV_COLS.map(([k, l]) => `<th data-sort="${k}">${l}${inv.key === k ? (inv.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((n) => {
        const st = STATUSES[n.status];
        return `<tr class="row${sel.nodes.has(n.id) ? ' sel' : ''}" data-id="${esc(n.id)}" title="${esc(nodeTooltip(n))}">
          <td><span class="dot" style="background:${st ? st.color : '#64748b'}"></span>${esc(n.name)}</td>
          <td class="muted">${esc(typeInfo(n.type).label)}</td>
          <td class="ip${n.ip && dups.has(ipBase(n.ip)) ? ' dup' : ''}">${esc(n.ip) || '<span class="muted">—</span>'}</td>
          <td>${esc(n.vlan)}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="muted">Brak urządzeń do wyświetlenia.</p>';
  }

  $('#invFilter').addEventListener('input', (e) => { inv.filter = e.target.value; renderInventory(); });
  $('#invTable').addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (th) {
      const k = th.dataset.sort;
      inv.dir = inv.key === k ? -inv.dir : 1;
      inv.key = k;
      renderInventory();
      return;
    }
    const tr = e.target.closest('tr.row');
    if (!tr) return;
    const n = nodeById(tr.dataset.id);
    if (!n) return;
    selectOnly('nodes', n.id);
    centerOn(n);
    switchTab('props');
    render();
  });

  function switchTab(tab) {
    activeTab = tab;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $('#propsPanel').hidden = tab !== 'props';
    $('#inventoryPanel').hidden = tab !== 'inventory';
    renderPanel();
    renderInventory();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  /* ---------- Import / eksport ---------- */
  function download(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function saveJSON() {
    download(slug(state.name) + '.json', JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2), 'application/json');
    toast('Zapisano plik JSON');
  }

  function openJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadState(normalize(JSON.parse(reader.result)), { msg: `Wczytano „${file.name}”` });
      } catch (err) {
        toast('Nie udało się wczytać pliku: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function buildExportSVG() {
    const bb = contentBBox();
    if (!bb) return null;
    const pad = 40, titleH = 44;
    const x = bb.x - pad, y = bb.y - pad - titleH, w = bb.w + pad * 2, h = bb.h + pad * 2 + titleH;
    const clone = svg.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    const vp = clone.querySelector('#viewport');
    vp.removeAttribute('transform');
    clone.querySelector('#overlayLayer').remove();
    clone.querySelectorAll('.handle, .link-hit, .link-glow, .zone-resize').forEach((el) => el.remove());
    clone.querySelectorAll('.selected, .connect-src, .link-target').forEach((el) => el.classList.remove('selected', 'connect-src', 'link-target'));
    const ns = 'http://www.w3.org/2000/svg';
    const bg = document.createElementNS(ns, 'rect');
    Object.entries({ x, y, width: w, height: h, fill: EXPORT_BG }).forEach(([k, v]) => bg.setAttribute(k, v));
    vp.insertBefore(bg, vp.firstChild);
    const title = document.createElementNS(ns, 'text');
    Object.entries({ x: x + pad, y: y + pad + 6, fill: '#e2e8f0', 'font-size': 20, 'font-weight': 700 }).forEach(([k, v]) => title.setAttribute(k, v));
    title.textContent = state.name;
    const date = document.createElementNS(ns, 'tspan');
    Object.entries({ dx: 12, fill: '#64748b', 'font-size': 12, 'font-weight': 400 }).forEach(([k, v]) => date.setAttribute(k, v));
    date.textContent = new Date().toLocaleDateString('pl-PL');
    title.appendChild(date);
    vp.appendChild(title);
    return { str: '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone), w, h };
  }

  function exportSVG() {
    const out = buildExportSVG();
    if (!out) return toast('Topologia jest pusta');
    download(slug(state.name) + '.svg', out.str, 'image/svg+xml');
  }

  function exportPNG() {
    const out = buildExportSVG();
    if (!out) return toast('Topologia jest pusta');
    const scale = Math.min(2, 8000 / Math.max(out.w, out.h));
    const img = new Image();
    const url = URL.createObjectURL(new Blob([out.str], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(out.w * scale);
      canvas.height = Math.round(out.h * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, out.w, out.h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => { download(slug(state.name) + '.png', blob); toast('Wyeksportowano PNG'); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Eksport PNG nie powiódł się – spróbuj SVG'); };
    img.src = url;
  }

  function exportCSV() {
    if (!state.nodes.length) return toast('Brak urządzeń do eksportu');
    const cols = [['name', 'Nazwa'], ['type', 'Typ'], ['status', 'Status'], ['ip', 'IP'], ['vlan', 'VLAN'], ['mac', 'MAC'], ['model', 'Model'],
      ['os', 'System'], ['specs', 'Specyfikacja'], ['location', 'Lokalizacja'], ['services', 'Usługi'], ['notes', 'Notatki']];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [...state.nodes].sort((a, b) => ipSortKey(a.ip).localeCompare(ipSortKey(b.ip), 'pl', { numeric: true })).map((n) => cols.map(([k]) => {
      if (k === 'type') return cell(typeInfo(n.type).label);
      if (k === 'status') return cell(STATUSES[n.status]?.label);
      return cell(n[k]);
    }).join(';'));
    // BOM + średnik – poprawne otwieranie w polskim Excelu
    download(slug(state.name) + '-inwentarz.csv', '﻿' + [cols.map(([, l]) => cell(l)).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
    toast('Wyeksportowano inwentarz CSV');
  }

  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) openJSON(f);
    e.target.value = '';
  });

  /* ---------- Akcje (przyciski) ---------- */
  const actions = {
    new: () => {
      if (state.nodes.length && !confirm('Utworzyć nową, pustą topologię? Bieżąca zostanie zastąpiona (możesz ją przywrócić przez Cofnij).')) return;
      loadState(blankState());
    },
    open: () => $('#fileInput').click(),
    save: saveJSON,
    sample: () => {
      if (state.nodes.length && !confirm('Wczytać przykładowy home lab? Bieżąca topologia zostanie zastąpiona (możesz ją przywrócić przez Cofnij).')) return;
      loadState(sampleState(), { msg: 'Wczytano przykładowy home lab' });
    },
    undo, redo,
    connect: () => setConnectMode(!connectMode),
    'connect-from': (el) => { setConnectMode(true); connectFrom = el.dataset.id; updateModeHint(); render(); },
    zone: addZone,
    snap: () => { settings.snap = !settings.snap; persistSettings(); updateToolbar(); applyView(); },
    'zoom-in': () => zoomCenter(1.2),
    'zoom-out': () => zoomCenter(1 / 1.2),
    fit: fitView,
    'export-png': exportPNG,
    'export-svg': exportSVG,
    'export-csv': exportCSV,
    delete: deleteSelection,
    duplicate: duplicateSelection,
    align: (el) => align(el.dataset.mode),
    reverse: () => {
      const l = linkById([...sel.links][0]);
      if (!l) return;
      [l.from, l.to, l.fromPort, l.toPort] = [l.to, l.from, l.toPort, l.fromPort];
      commit();
      renderAll();
    },
    'reset-color': (el) => { const n = nodeById(el.dataset.id); if (n) { n.color = ''; commit(); renderAll(); } },
    'select-link': (el) => { selectOnly('links', el.dataset.id); renderAll(); }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    e.preventDefault();
    actions[el.dataset.action](el);
  });

  function updateToolbar() {
    $('#btnUndo').disabled = history.index <= 0;
    $('#btnRedo').disabled = history.index >= history.stack.length - 1;
    $('#btnConnect').classList.toggle('on', connectMode);
    $('#btnSnap').classList.toggle('on', settings.snap);
    const pn = $('#projectName');
    if (document.activeElement !== pn) pn.value = state.name;
  }

  $('#projectName').addEventListener('input', (e) => { state.name = e.target.value; if (!selCount()) renderPanel(); });
  $('#projectName').addEventListener('change', commit);
  $('#projectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  /* ---------- Klawiatura ---------- */
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
    if (typing) {
      if (e.key === 'Escape') t.blur();
      if (e.key === 'Enter' && t.tagName === 'INPUT') t.blur();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 's') { e.preventDefault(); saveJSON(); return; }
    if (mod && k === 'a') {
      e.preventDefault();
      state.nodes.forEach((n) => sel.nodes.add(n.id));
      state.links.forEach((l) => sel.links.add(l.id));
      state.zones.forEach((z) => sel.zones.add(z.id));
      renderAll();
      return;
    }
    if (mod && k === 'c') { if (copySelection()) toast(`Skopiowano ${clipboard.nodes.length} urządzeń`); return; }
    if (mod && k === 'v') { paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key === 'Escape') {
      if (connectMode) setConnectMode(false);
      else if (selCount()) { clearSel(); renderAll(); }
      return;
    }
    if (k === 'l') { setConnectMode(!connectMode); return; }
    if (k === 'f') { fitView(); return; }
    if (e.key === '+' || e.key === '=') { zoomCenter(1.2); return; }
    if (e.key === '-') { zoomCenter(1 / 1.2); return; }
    if (e.key === ' ') {
      e.preventDefault();
      if (!spaceDown) { spaceDown = true; wrap.classList.add('panning'); }
      return;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && (sel.nodes.size || sel.zones.size)) {
      e.preventDefault();
      const step = e.shiftKey ? GRID : 1;
      collectMoveItems().forEach((it) => { it.o.x += arrows[e.key][0] * step; it.o.y += arrows[e.key][1] * step; });
      render();
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(commit, 400);
    }
  });
  let nudgeTimer = null;
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') { spaceDown = false; if (!drag) wrap.classList.remove('panning'); }
  });
  window.addEventListener('blur', () => { spaceDown = false; wrap.classList.remove('panning'); });
  window.addEventListener('resize', applyView);

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Przykładowa topologia ---------- */
  function sampleState() {
    const s = blankState();
    s.name = 'Przykładowy home lab';
    const N = (id, type, x, y, name, extra = {}) => { s.nodes.push({ ...nodeDefaults(), id, type, x, y, name, ...extra }); };
    const L = (from, to, extra = {}) => { s.links.push({ ...linkDefaults(), id: uid('l'), from, to, ...extra }); };
    const Z = (x, y, w, h, name, desc, color) => { s.zones.push({ id: uid('z'), x, y, w, h, name, desc, color }); };

    Z(200, 260, 440, 300, 'Szafa rack 12U', 'piwnica', '#a8a29e');
    Z(80, 580, 540, 300, 'VLAN 10 – Serwery', '192.168.10.0/24', '#34d399');
    Z(740, 580, 500, 160, 'VLAN 20 – Wi-Fi / IoT', '192.168.20.0/24', '#fbbf24');

    N('inet', 'internet', 520, 60, 'Internet', { status: 'online', notes: 'Światłowód 1 Gb/s, publiczne IP' });
    N('ont', 'modem', 520, 180, 'ONT operatora', { ip: '192.168.100.1', notes: 'Tryb bridge' });
    N('vpnphone', 'phone', 820, 180, 'Telefon (zdalnie)', { ip: '10.10.0.2', notes: 'Dostęp przez WireGuard' });
    N('fw', 'firewall', 520, 320, 'opnsense', { ip: '192.168.1.1', vlan: '1', model: 'Mini PC N100, 4× 2.5GbE', os: 'OPNsense 24.7', services: 'DHCP, Unbound DNS, WireGuard, IDS', location: 'Rack U8' });
    N('ups', 'ups', 300, 320, 'UPS 1500VA', { ip: '192.168.1.5', vlan: '1', services: 'NUT (monitoring)', location: 'Rack U1-2' });
    N('sw', 'switch', 520, 480, 'switch-core', { ip: '192.168.1.2', vlan: '1', model: '8× 2.5GbE + 2× SFP+', os: 'Zarządzalny L2', location: 'Rack U6' });
    N('ap', 'ap', 820, 480, 'ap-salon', { ip: '192.168.1.3', vlan: '1', model: 'Wi-Fi 6 AP', notes: 'SSID: dom (VLAN 1), iot (VLAN 20)' });
    N('pc', 'pc', 680, 640, 'desktop', { ip: '192.168.1.50', vlan: '1', os: 'Windows 11' });
    N('pve', 'hypervisor', 260, 640, 'pve-01', { ip: '192.168.10.10', vlan: '10', os: 'Proxmox VE 8', specs: 'Ryzen 5 5600G · 64 GB RAM · 2 TB NVMe', location: 'Rack U3' });
    N('nas', 'nas', 400, 640, 'nas-01', { ip: '192.168.10.20', vlan: '10', os: 'TrueNAS SCALE', specs: '4× 8 TB RAIDZ1', services: 'SMB, NFS, snapshoty' });
    N('rpi', 'sbc', 540, 640, 'rpi-monitor', { ip: '192.168.10.30', vlan: '10', os: 'Raspberry Pi OS', services: 'Uptime Kuma, Grafana' });
    N('pihole', 'container', 140, 800, 'pihole', { ip: '192.168.10.53', vlan: '10', os: 'LXC Debian 12', services: 'Pi-hole DNS' });
    N('ha', 'vm', 260, 800, 'homeassistant', { ip: '192.168.10.40', vlan: '10', os: 'Home Assistant OS' });
    N('docker', 'vm', 380, 800, 'docker-01', { ip: '192.168.10.41', vlan: '10', os: 'Ubuntu 24.04', services: 'Jellyfin, Nextcloud, Traefik' });
    N('laptop', 'laptop', 820, 650, 'laptop', { ip: '192.168.20.51', vlan: '20' });
    N('tv', 'tv', 940, 650, 'smart-tv', { ip: '192.168.20.60', vlan: '20' });
    N('plug', 'iot', 1060, 650, 'gniazdka-smart', { ip: '192.168.20.70', vlan: '20', notes: '4× gniazdko Wi-Fi' });
    N('cam', 'camera', 1180, 650, 'kamera-wejscie', { ip: '192.168.20.80', vlan: '20', status: 'planned' });

    L('inet', 'ont', { type: 'fiber', speed: '1G', label: 'GPON' });
    L('ont', 'fw', { speed: '1G', fromPort: 'LAN1', toPort: 'WAN' });
    L('fw', 'vpnphone', { type: 'vpn', speed: '', label: 'WireGuard' });
    L('ups', 'fw', { type: 'power', speed: '' });
    L('fw', 'sw', { speed: '2.5G', fromPort: 'LAN', toPort: 'P1', vlan: '1,10,20' });
    L('sw', 'ap', { speed: '2.5G', fromPort: 'P8', label: 'PoE+', vlan: '1,20' });
    L('sw', 'pve', { type: 'fiber', speed: '10G', fromPort: 'SFP+1' });
    L('sw', 'nas', { type: 'fiber', speed: '10G', fromPort: 'SFP+2' });
    L('sw', 'rpi', { speed: '1G', fromPort: 'P5' });
    L('sw', 'pc', { speed: '2.5G', fromPort: 'P6' });
    L('pve', 'pihole', { type: 'virtual', speed: '' });
    L('pve', 'ha', { type: 'virtual', speed: '' });
    L('pve', 'docker', { type: 'virtual', speed: '' });
    ['laptop', 'tv', 'plug', 'cam'].forEach((id) => L('ap', id, { type: 'wifi', speed: '' }));
    return s;
  }

  /* ---------- Start ---------- */
  function init() {
    try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* ignoruj */ }
    let loaded = null;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) loaded = normalize(JSON.parse(raw));
    } catch (e) { loaded = null; }
    state = loaded || sampleState();
    commit();
    renderPalette();
    renderLegend();
    renderAll();
    requestAnimationFrame(fitView);
  }

  init();
})();
