import { db, auth } from './firebase.js';
import {
  collection, query, getDocs, addDoc, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession } from './userSession.js';

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  ensureUsuarioSession(user).then(initFac).catch(() => signOut(auth).finally(() => { window.location.href = '../index.html'; }));
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});

let facturas = [];

function initFac() {
  bindModal();
  document.getElementById('btnNuevaFactura')?.addEventListener('click', () => showModal(true));
  loadFacturas();
}

async function loadFacturas() {
  facturas = [];
  const snap = await getDocs(query(collection(db, 'facturas')));
  snap.forEach((d) => facturas.push({ id: d.id, ...d.data() }));
  renderTable();
  renderKpis();
}

function renderTable() {
  const tbody = document.getElementById('facTableBody');
  if (!tbody) return;
  const pendientes = facturas.filter((f) => String(f.estado || '').toUpperCase() !== 'PAGADO');
  tbody.innerHTML = pendientes.map((f) => `
    <tr>
      <td>${f.numeroFactura || ''}</td>
      <td>${f.receptor || ''}</td>
      <td>${Number(f.importeTotal || 0).toLocaleString('es-PE')}</td>
      <td>${fmtDate(f.fechaEmision)}</td>
      <td>${f.estado || ''}</td>
      <td>${Array.isArray(f.unidades) ? f.unidades.join(', ') : ''}</td>
      <td><button class="btn-secondary btn-pagar" data-id="${f.id}">Marcar pagado</button></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('.btn-pagar').forEach((btn) => btn.addEventListener('click', async () => {
    await updateDoc(doc(db, 'facturas', btn.dataset.id), { estado: 'PAGADO' });
    loadFacturas();
  }));
}

function renderKpis() {
  const pendientes = facturas.filter((f) => String(f.estado || '').toUpperCase() !== 'PAGADO');
  const pagadas = facturas.filter((f) => String(f.estado || '').toUpperCase() === 'PAGADO');
  const montoPend = pendientes.reduce((acc, f) => acc + Number(f.importeTotal || 0), 0);
  setText('kpiPendMonto', montoPend.toLocaleString('es-PE'));
  setText('kpiPendCant', pendientes.length);
  setText('kpiPagadas', pagadas.length);
}

function bindModal() {
  document.getElementById('modalFacturaClose')?.addEventListener('click', () => showModal(false));
  document.getElementById('btnGuardarFactura')?.addEventListener('click', async () => {
    const payload = {
      numeroFactura: val('facNumero'),
      receptor: val('facReceptor'),
      importeTotal: Number(val('facImporte') || 0),
      fechaEmision: val('facFechaEmision') ? new Date(`${val('facFechaEmision')}T00:00:00`) : serverTimestamp(),
      estado: val('facEstado') || 'PENDIENTE',
      unidades: val('facUnidades').split(',').map((v) => v.trim()).filter(Boolean),
    };
    await addDoc(collection(db, 'facturas'), payload);
    showModal(false);
    loadFacturas();
  });
}

function showModal(show) {
  document.getElementById('modalFactura')?.classList.toggle('hidden', !show);
}

function val(id) { return document.getElementById(id)?.value || ''; }
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}
function fmtDate(raw) {
  if (!raw) return '';
  const d = raw.toDate ? raw.toDate() : new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE');
}