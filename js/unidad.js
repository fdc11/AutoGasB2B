import { db, auth } from './firebase.js';
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession } from './userSession.js';

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  ensureUsuarioSession(user).then(loadUnidad).catch(() => signOut(auth).finally(() => { window.location.href = '../index.html'; }));
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});

let currentUnidad = null;
let unidadId = null;
let serviciosCache = [];
let timelineFilter = 'all';
const EDIT_FIELDS = [
  'folio', 'estado', 'sede', 'tipoConversion', 'concesionaria', 'tecnico',
  'placa', 'marca', 'modelo', 'color', 'motor', 'vinSerie',
  'costo', 'facturaNumero', 'estadoPago', 'pago', 'entrega', 'fechaEntrega',
];

async function loadUnidad() {
  unidadId = new URLSearchParams(window.location.search).get('id');
  if (!unidadId) return window.location.href = 'dashboard.html';
  const snap = await getDoc(doc(db, 'unidades', unidadId));
  if (!snap.exists()) return alert('Unidad no encontrada');
  currentUnidad = { id: snap.id, ...snap.data() };
  document.getElementById('topVin').textContent = currentUnidad.vin || currentUnidad.id;
  hydrateHero();
  hydrateSummary();
  renderSectionsAccordion();
  bindAccordions();

  const q = query(collection(db, 'servicios'), where('unidadVin', '==', unidadId), orderBy('fecha', 'desc'));
  const svc = await getDocs(q);
  serviciosCache = [];
  svc.forEach((d) => serviciosCache.push(d.data()));
  renderTimeline();
  bindEvento();
  bindTimelineFilters();
  bindEditar();
}

function hydrateHero() {
  setText('heroTitle', `${currentUnidad.marca || ''} ${currentUnidad.modelo || ''}`.trim() || 'Unidad');
  setText('heroSubtitle', `VIN ${currentUnidad.vin || currentUnidad.id} · Placa ${currentUnidad.placa || 'SIN PLACA'}`);
  paintChip('chipEstado', currentUnidad.estado || 'SIN ESTADO');
  paintChip('chipTipo', currentUnidad.tipoConversion || 'TIPO N/D');
  paintChip('chipPago', currentUnidad.estadoPago || 'PAGO N/D');
}

function hydrateSummary() {
  setText('sumFolio', currentUnidad.folio || '-');
  setText('sumSede', currentUnidad.sede || '-');
  setText('sumConcesionaria', currentUnidad.concesionaria || '-');
  setText('sumTecnico', currentUnidad.tecnico || '-');
}

function renderSectionsAccordion() {
  const wrap = document.getElementById('sectionsAccordion');
  if (!wrap) return;
  const groups = [
    { title: 'Datos del servicio', keys: ['item', 'folio', 'anio', 'mes', 'bloque', 'sede', 'tipoConversion', 'concesionaria', 'estado'] },
    { title: 'Datos personales', keys: ['propietario', 'dniRuc', 'telefono'] },
    { title: 'Datos del vehículo', keys: ['placa', 'marca', 'modelo', 'anioVehiculo', 'color', 'combustible', 'vinSerie', 'motor'] },
    { title: 'Tanque / Kit / Componentes', keys: ['tipoTanqueGlp', 'marcaTanque', 'capacidadTanque', 'numeroKit', 'ecu', 'rampa', 'reductor', 'multivalvula', 'cilindro'] },
    { title: 'Proceso', keys: ['fechaConversion', 'certificadora', 'tecnico', 'observaciones'] },
    { title: 'Finanzas / Pago / Entrega', keys: ['costo', 'bono', 'facturaNumero', 'fechaFactura', 'pago', 'estadoPago', 'entrega', 'fechaEntrega'] },
  ];
  wrap.innerHTML = groups.map((g, i) => `
    <div class="acc-item ${i === 0 ? 'open' : ''}">
      <button class="acc-head"><span class="acc-title">${g.title}</span><span>▾</span></button>
      <div class="acc-body">
        <table class="acc-table">
          <tbody>
            ${g.keys.map((k) => `<tr><td>${k}</td><td>${fmtAny(currentUnidad[k])}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function bindAccordions() {
  document.querySelectorAll('.acc-head').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.acc-item')?.classList.toggle('open'));
  });
  document.getElementById('btnExpandAll')?.addEventListener('click', () => {
    const items = Array.from(document.querySelectorAll('.acc-item'));
    const shouldOpen = items.some((el) => !el.classList.contains('open'));
    items.forEach((el) => el.classList.toggle('open', shouldOpen));
  });
}

function renderTimeline() {
  const tl = document.getElementById('timeline');
  if (!tl) return;

  const list = serviciosCache.filter((s) => {
    if (timelineFilter === 'all') return true;
    const tipo = String(s.tipo || '').toLowerCase();
    if (timelineFilter === 'estado') return tipo.includes('estado');
    if (timelineFilter === 'pago') return tipo.includes('pago') || tipo.includes('factura');
    return true;
  });

  tl.innerHTML = list.length
    ? list.map((s) => `<div class="timeline-item"><strong>${s.tipo || '-'}</strong> - ${fmtDate(s.fecha)} - ${s.tecnico || '-'}<br>${s.observaciones || ''}</div>`).join('')
    : '<p>Sin eventos registrados.</p>';
}

function bindEvento() {
  document.getElementById('btnAgregarEvento')?.addEventListener('click', async () => {
    const tipo = val('evtTipo');
    if (!tipo) return alert('Tipo requerido');
    const tecnico = val('evtTecnico');
    const observaciones = val('evtObs');

    const changes = { tipo, tecnico, observaciones };
    await addDoc(collection(db, 'servicios'), {
      unidadVin: unidadId,
      fecha: serverTimestamp(),
      tipo,
      tecnico,
      observaciones,
      changes,
    });
    await updateDoc(doc(db, 'unidades', unidadId), { actualizadoAt: serverTimestamp() });
    window.location.reload();
  });
}

function bindTimelineFilters() {
  document.querySelectorAll('.btn-chip[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      timelineFilter = btn.dataset.filter || 'all';
      document.querySelectorAll('.btn-chip[data-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTimeline();
    });
  });
}

function bindEditar() {
  const modal = document.getElementById('modalEditarUnidad');
  const open = () => {
    EDIT_FIELDS.forEach((key) => {
      const input = document.getElementById(`ed_${key}`);
      if (!input) return;
      input.value = key.toLowerCase().includes('fecha') ? toDateInput(currentUnidad[key]) : (currentUnidad[key] ?? '');
      input.addEventListener('input', updateDiffPreview);
      input.addEventListener('change', updateDiffPreview);
    });
    updateDiffPreview();
    modal?.classList.remove('hidden');
  };
  const close = () => modal?.classList.add('hidden');
  document.getElementById('btnEditar')?.addEventListener('click', open);
  document.getElementById('btnCloseEditar')?.addEventListener('click', close);
  document.getElementById('btnCancelEditar')?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.querySelectorAll('.edit-tabs [data-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.dataset.tab;
      document.querySelectorAll('.edit-tabs .btn-secondary').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      document.querySelectorAll('.edit-panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(tab)?.classList.add('active');
    });
  });

  document.getElementById('btnGuardarEditar')?.addEventListener('click', async () => {
    const updates = {};
    const changes = {};
    EDIT_FIELDS.forEach((key) => {
      const input = document.getElementById(`ed_${key}`);
      if (!input) return;
      const next = key.toLowerCase().includes('fecha') ? dateOrNull(input.value) : normalizeValue(input.value);
      const prev = currentUnidad[key] ?? null;
      if (!isSame(prev, next)) {
        updates[key] = next;
        changes[key] = { from: fmtAny(prev), to: fmtAny(next) };
      }
    });
    if (!Object.keys(changes).length) return;
    updates.actualizadoAt = serverTimestamp();
    await updateDoc(doc(db, 'unidades', unidadId), updates);
    await addDoc(collection(db, 'servicios'), {
      unidadVin: unidadId,
      fecha: serverTimestamp(),
      tipo: 'Actualización de ficha',
      tecnico: updates.tecnico || currentUnidad.tecnico || '',
      observaciones: 'Se editaron datos de la unidad desde la ficha interactiva.',
      changes,
    });
    window.location.reload();
  });
}

function updateDiffPreview() {
  const wrap = document.getElementById('diffPreview');
  if (!wrap) return;
  const diffs = [];
  EDIT_FIELDS.forEach((key) => {
    const input = document.getElementById(`ed_${key}`);
    if (!input) return;
    const next = key.toLowerCase().includes('fecha') ? dateOrNull(input.value) : normalizeValue(input.value);
    const prev = currentUnidad[key] ?? null;
    if (!isSame(prev, next)) diffs.push(`<div><strong>${key}</strong>: <span style="color:#6b7280">${fmtAny(prev)}</span> → <span style="color:#df0415">${fmtAny(next)}</span></div>`);
  });
  wrap.innerHTML = diffs.length ? diffs.join('') : 'Sin cambios aún.';
}

function val(id) { return document.getElementById(id)?.value || ''; }
function fmtDate(raw) {
  if (!raw) return '';
  const d = raw.toDate ? raw.toDate() : new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE');
}
function toDateInput(raw) {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateOrNull(v) { return v ? new Date(`${v}T00:00:00`) : null; }
function normalizeValue(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? t : n;
}
function isSame(a, b) {
  const ta = a?.toDate ? a.toDate().getTime() : (a instanceof Date ? a.getTime() : a);
  const tb = b?.toDate ? b.toDate().getTime() : (b instanceof Date ? b.getTime() : b);
  return ta === tb;
}
function fmtAny(v) {
  if (v === null || v === undefined || v === '') return '-';
  if (v?.toDate) return fmtDate(v);
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function paintChip(id, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const l = String(label).toUpperCase();
  el.textContent = l;
  if (l.includes('PROCESO') || l.includes('REVISION')) el.className = 'badge badge-en_proceso';
  else if (l.includes('PEND')) el.className = 'badge badge-revision';
  else if (l.includes('PAGADO') || l.includes('FINAL')) el.className = 'badge badge-finalizado';
  else if (l.includes('GLP')) el.className = 'badge badge-glp';
  else if (l.includes('GNV')) el.className = 'badge badge-gnv';
  else el.className = 'badge';
}