import { db, auth } from './firebase.js';
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession } from './userSession.js';
import { getAjustes } from './ajustes.js';

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  ensureUsuarioSession(user).then(initDashboard).catch(() => signOut(auth).finally(() => window.location.href = '../index.html'));
});

let allUnidades = [];
let filteredList = [];
let ajustes = null;

async function initDashboard() {
  ajustes = await getAjustes();
  bindLogout();
  bindFilters();
  hydrateFilters();
  document.getElementById('btnExcel')?.addEventListener('click', exportExcel);

  const q = query(collection(db, 'unidades'), orderBy('actualizadoAt', 'desc'));
  onSnapshot(q, (snap) => {
    allUnidades = [];
    snap.forEach((d) => allUnidades.push({ id: d.id, ...d.data() }));
    applyFilters();
  });
}

function bindLogout() {
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
  });
}

function hydrateFilters() {
  fillFilter('filterSede', ajustes.sedes);
  fillFilter('filterEstado', ajustes.estadoServicio);
  fillFilter('filterTipo', ajustes.tipoConversion);
}

function fillFilter(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    el.appendChild(opt);
  });
}

function bindFilters() {
  ['searchInput', 'filterSede', 'filterEstado', 'filterTipo', 'filterMes', 'filterAnio']
    .forEach((id) => {
      document.getElementById(id)?.addEventListener('input', applyFilters);
      document.getElementById(id)?.addEventListener('change', applyFilters);
    });
}

function applyFilters() {
  const search = textVal('searchInput').toLowerCase();
  const sede = val('filterSede');
  const estado = val('filterEstado');
  const tipo = val('filterTipo');
  const mes = val('filterMes');
  const anio = val('filterAnio');

  const anios = new Set();
  const meses = new Set();
  allUnidades.forEach((u) => {
    if (u.anio) anios.add(String(u.anio));
    if (u.mes) meses.add(String(u.mes));
  });
  refillSimple('filterAnio', Array.from(anios).sort(), anio);
  refillSimple('filterMes', Array.from(meses).sort((a, b) => Number(a) - Number(b)), mes);

  filteredList = allUnidades.filter((u) => {
    const hit = !search || [u.vin, u.placa, u.folio, u.concesionaria].some((x) => String(x || '').toLowerCase().includes(search));
    return hit &&
      (sede === 'all' || u.sede === sede) &&
      (estado === 'all' || u.estado === estado) &&
      (tipo === 'all' || u.tipoConversion === tipo) &&
      (mes === 'all' || String(u.mes) === mes) &&
      (anio === 'all' || String(u.anio) === anio);
  });
  renderTable();
}

function refillSimple(id, values, current) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<option value="all">Todos</option>';
  values.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
  el.value = values.includes(current) ? current : 'all';
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = filteredList.map((u) => `
    <tr data-id="${u.id}">
      <td>${u.item || ''}</td><td>${u.folio || ''}</td><td>${u.anio || ''}</td><td>${u.mes || ''}</td><td>${u.bloque || ''}</td>
      <td>${u.sede || ''}</td><td>${u.tipoConversion || ''}</td><td>${u.concesionaria || ''}</td><td>${u.estado || ''}</td>
      <td>${u.vin || u.id}</td><td>${u.placa || ''}</td><td>${u.marca || ''}</td><td>${u.modelo || ''}</td><td>${u.tecnico || ''}</td>
      <td>${u.costo || ''}</td><td>${u.facturaNumero || ''}</td><td>${u.estadoPago || ''}</td><td>${fmtDate(u.fechaEntrega)}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => window.location.href = `unidad.html?id=${tr.dataset.id}`));
}

function exportExcel() {
  if (typeof XLSX === 'undefined') return;
  const rows = filteredList.map((u) => ({
    ITEM: u.item, FOLIO: u.folio, ANIO: u.anio, MES: u.mes, BLOQUE: u.bloque, SEDE: u.sede,
    TIPO_CONVERSION: u.tipoConversion, CONCESIONARIA: u.concesionaria, ESTADO: u.estado, VIN: u.vin || u.id,
    PLACA: u.placa, MARCA: u.marca, MODELO: u.modelo, TECNICO: u.tecnico, COSTO: u.costo, FACTURA: u.facturaNumero,
    ESTADO_PAGO: u.estadoPago, FECHA_ENTREGA: fmtDate(u.fechaEntrega),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CONTROL DE CONVERSIONES');
  XLSX.writeFile(wb, `autogas_control_conversiones.xlsx`);
}

function val(id) { return document.getElementById(id)?.value || 'all'; }
function textVal(id) { return document.getElementById(id)?.value || ''; }
function fmtDate(raw) {
  if (!raw) return '';
  const d = raw.toDate ? raw.toDate() : new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE');
}