// =============================================
// AUTOGAS B2B — dashboard.js (Rediseño Completo)
// =============================================
import { db, auth } from './firebase.js';
import {
  collection, onSnapshot, query, orderBy, where, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession, getEmpresa, getRol } from './userSession.js';

// =============================================
// AUTH GUARD
// =============================================
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  ensureUsuarioSession(user)
    .then((perfil) => {
      const email = perfil.email || user.email || '';
      const nameParts = (email.split('@')[0] || '').replace(/[._]/g, ' ').trim().toUpperCase();
      setText('userName', nameParts || 'USUARIO');
      setText('userAvatar', (nameParts || 'A').charAt(0));
      setText('userRole', getRoleLabel(perfil.rol));

      const rol = perfil.rol;
      if (rol === 'autoniza') {
        applyAutonizaUX();
      }
      initDashboard();
    })
    .catch((err) => {
      const msg = String(err?.message || '');
      if (msg === 'Cuenta desactivada') {
        alert('Cuenta desactivada');
      } else {
        alert('Acceso no autorizado. Contacta a tu administrador.');
      }
      signOut(auth).finally(() => { window.location.href = '../index.html'; });
    });
});

// =============================================
// RELOJ EN TIEMPO REAL
// =============================================
function startClock() {
  const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function tick() {
    const now = new Date();
    const dia = DIAS[now.getDay()];
    const diaNum = now.getDate();
    const mes = MESES[now.getMonth()];
    const anio = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const capitalized = dia.charAt(0).toUpperCase() + dia.slice(1);
    setText('clockDisplay', `${capitalized}, ${diaNum} de ${mes} de ${anio} · ${hh}:${mm}:${ss}`);
  }
  tick();
  setInterval(tick, 1000);
}

// =============================================
// ESTADO GLOBAL
// =============================================
let allUnidades = [];
let filteredList = [];
const PAGE_SIZE = 12;
let currentPage = 1;
let currentEditId = null;
let selectedEstado = null;
let isReadOnly = false;

// =============================================
// DATOS DEMO (8+ unidades realistas)
// =============================================
function getDemoData() {
  const ts = (dateStr) => ({ toDate: () => new Date(dateStr) });
  return [
    {
      id: 'DEMO-1', vin: 'KL1MF546XHB123401', placa: '',      marca: 'CHEVROLET', modelo: 'GROOVE',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GNV',
      taller: 'Autoniza Surquillo', tecnico: 'Carlos Ríos', kilometraje: 0,
      estado: 'en_proceso', fechaIngreso: ts('2026-04-28'), fechaTermino: null, garantiaHasta: null,
    },
    {
      id: 'DEMO-2', vin: 'KL1MF546XHB123402', placa: '',      marca: 'CHEVROLET', modelo: 'ONIX',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GNV',
      taller: 'Autoniza Surquillo', tecnico: 'Pedro Salas', kilometraje: 0,
      estado: 'en_proceso', fechaIngreso: ts('2026-04-27'), fechaTermino: null, garantiaHasta: null,
    },
    {
      id: 'DEMO-3', vin: 'KL1MF546XHB123403', placa: '',      marca: 'CHEVROLET', modelo: 'TRACKER',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GLP',
      taller: 'Autoniza Callao', tecnico: 'Marco Díaz', kilometraje: 0,
      estado: 'revision', fechaIngreso: ts('2026-04-25'), fechaTermino: null, garantiaHasta: null,
    },
    {
      id: 'DEMO-4', vin: 'KL1MF546XHB123404', placa: 'A1B-234', marca: 'CHEVROLET', modelo: 'SAIL',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GNV',
      taller: 'AutoGas Central', tecnico: 'Ana Flores', kilometraje: 12000,
      estado: 'finalizado', fechaIngreso: ts('2026-03-10'), fechaTermino: ts('2026-03-25'), garantiaHasta: ts('2029-03-25'),
    },
    {
      id: 'DEMO-5', vin: 'KL1MF546XHB123405', placa: 'B3C-456', marca: 'CHEVROLET', modelo: 'CAVALIER',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GLP',
      taller: 'AutoGas Norte', tecnico: 'Luis Torres', kilometraje: 5500,
      estado: 'finalizado', fechaIngreso: ts('2026-03-15'), fechaTermino: ts('2026-03-28'), garantiaHasta: ts('2029-03-28'),
    },
    {
      id: 'DEMO-6', vin: 'KL1MF546XHB123406', placa: 'C4D-789', marca: 'CHEVROLET', modelo: 'GROOVE',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GNV',
      taller: 'Autoniza Surquillo', tecnico: 'Carlos Ríos', kilometraje: 8200,
      estado: 'finalizado', fechaIngreso: ts('2023-04-01'), fechaTermino: ts('2023-04-18'), garantiaHasta: ts('2024-04-18'),
    },
    {
      id: 'DEMO-7', vin: 'KL1MF546XHB123407', placa: '',      marca: 'CHEVROLET', modelo: 'ONIX PLUS',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GLP',
      taller: 'Autoniza Callao', tecnico: 'Marco Díaz', kilometraje: 0,
      estado: 'en_proceso', fechaIngreso: ts('2026-04-29'), fechaTermino: null, garantiaHasta: null,
    },
    {
      id: 'DEMO-8', vin: 'KL1MF546XHB123408', placa: 'E5F-321', marca: 'CHEVROLET', modelo: 'SPARK',
      cliente: 'AUTONIZA', subservicio: 'Conversión a Gas GNV',
      taller: 'AutoGas Central', tecnico: 'Pedro Salas', kilometraje: 22000,
      estado: 'finalizado', fechaIngreso: ts('2026-02-14'), fechaTermino: ts('2026-03-01'), garantiaHasta: ts('2029-03-01'),
    },
  ];
}

// =============================================
// INIT
// =============================================
function initDashboard() {
  startClock();
  bindFilters();
  bindModal();
  bindLogout();

  document.getElementById('btnExcel')?.addEventListener('click', exportExcel);

  try {
    const rol = getRol();
    const empresa = getEmpresa();

    let q = query(collection(db, 'unidades'), orderBy('fechaIngreso', 'desc'));
    if (rol === 'autoniza') {
      isReadOnly = true;
      // Intento 1: filtrar server-side por cliente (requiere índice si se combina con orderBy)
      q = query(collection(db, 'unidades'), where('cliente', '==', empresa), orderBy('fechaIngreso', 'desc'));
    }

    onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      // Si no hay datos y es Autoniza, evita mostrar demo (porque no corresponde al cliente real).
      allUnidades = data.length > 0 ? data : (getRol() === 'autoniza' ? [] : getDemoData());
      updateKPIs();
      applyFilters();
    }, () => {
      // Fallback: si falla (índices), para Autoniza probamos query simple sin orderBy.
      if (getRol() === 'autoniza') {
        const empresa2 = getEmpresa();
        const q2 = query(collection(db, 'unidades'), where('cliente', '==', empresa2));
        onSnapshot(q2, (snap2) => {
          const data2 = [];
          snap2.forEach(d => data2.push({ id: d.id, ...d.data() }));
          allUnidades = data2;
          updateKPIs();
          applyFilters();
        }, () => {
          allUnidades = [];
          updateKPIs();
          applyFilters();
        });
        return;
      }
      allUnidades = getDemoData();
      updateKPIs();
      applyFilters();
    });
  } catch {
    allUnidades = getRol() === 'autoniza' ? [] : getDemoData();
    updateKPIs();
    applyFilters();
  }
}

// =============================================
// LOGOUT
// =============================================
function bindLogout() {
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
  });
}

// =============================================
// KPIs
// =============================================
function updateKPIs() {
  const total = allUnidades.length;
  const enProceso = allUnidades.filter(u => u.estado === 'en_proceso' || u.estado === 'revision').length;
  const conGarantia = allUnidades.filter(u => {
    if (!u.garantiaHasta) return false;
    const f = u.garantiaHasta.toDate ? u.garantiaHasta.toDate() : new Date(u.garantiaHasta);
    return f > new Date();
  }).length;
  const sinGarantia = allUnidades.filter(u => {
    if (!u.garantiaHasta) return u.estado === 'finalizado';
    const f = u.garantiaHasta.toDate ? u.garantiaHasta.toDate() : new Date(u.garantiaHasta);
    return f <= new Date();
  }).length;

  setText('kpiTotal', total.toString());
  setText('kpiGarantia', conGarantia.toString());
  setText('kpiProceso', enProceso.toString());
  setText('kpiSinGarantia', sinGarantia.toString());
}

// =============================================
// FILTROS
// =============================================
function bindFilters() {
  ['searchInput','filterEstado','filterSubservicio','filterCliente','filterGarantia'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyFilters);
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const estado = document.getElementById('filterEstado')?.value || 'all';
  const sub    = document.getElementById('filterSubservicio')?.value || 'all';
  const cliente = document.getElementById('filterCliente')?.value || 'all';
  const garantia = document.getElementById('filterGarantia')?.value || 'all';

  filteredList = allUnidades.filter(u => {
    const matchSearch = !search ||
      (u.vin || '').toLowerCase().includes(search) ||
      (u.placa || '').toLowerCase().includes(search) ||
      (u.cliente || '').toLowerCase().includes(search) ||
      (u.modelo || '').toLowerCase().includes(search) ||
      (u.marca || '').toLowerCase().includes(search);

    const matchEstado = estado === 'all' || u.estado === estado;

    const subLow = (u.subservicio || '').toLowerCase();
    const matchSub = sub === 'all' ||
      (sub === 'gnv' && subLow.includes('gnv')) ||
      (sub === 'glp' && subLow.includes('glp'));

    const matchCliente = cliente === 'all' ||
      (u.cliente || '').toUpperCase() === cliente.toUpperCase();

    const matchGarantia = garantia === 'all' || checkGarantiaFilter(u, garantia);

    return matchSearch && matchEstado && matchSub && matchCliente && matchGarantia;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
  updateCount();
}

function checkGarantiaFilter(u, filter) {
  if (!u.garantiaHasta) {
    return filter === 'sin';
  }
  const f = u.garantiaHasta.toDate ? u.garantiaHasta.toDate() : new Date(u.garantiaHasta);
  const activa = f > new Date();
  return filter === 'activa' ? activa : !activa;
}

// =============================================
// RENDER TABLA
// =============================================
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredList.slice(start, start + PAGE_SIZE);

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  tbody.innerHTML = page.map(u => {
    const fecha = toDate(u.fechaIngreso);
    const fechaStr = fecha ? fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const garantia = getGarantiaInfo(u.garantiaHasta);

    const subLow = (u.subservicio || '').toLowerCase();
    const subCls = subLow.includes('gnv') ? 'gnv' : subLow.includes('glp') ? 'glp' : '';
    const subLabel = subLow.includes('gnv') ? 'GNV' : subLow.includes('glp') ? 'GLP' : (u.subservicio || '—');

    const placaHtml = u.placa
      ? `<span class="mono" style="font-weight:700;font-size:0.85rem;">${u.placa}</span>`
      : `<span class="badge badge-sin-placa">SIN PLACA</span>`;

    const accionesHtml = isReadOnly
      ? `
          <button class="btn-icon btn-ver" data-id="${u.id}" title="Ver ficha">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
        `
      : `
          <button class="btn-icon btn-ver" data-id="${u.id}" title="Ver ficha">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="btn-icon btn-edit" data-id="${u.id}" title="Cambiar estado">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        `;

    return `
      <tr data-id="${u.id}">
        <td><span class="vin-cell mono">${u.vin || '—'}</span></td>
        <td>${placaHtml}</td>
        <td>
          <div class="modelo-cell">
            ${u.marca || ''} ${u.modelo || '—'}
            ${u.kilometraje ? `<small>${Number(u.kilometraje).toLocaleString()} km</small>` : ''}
          </div>
        </td>
        <td>${u.cliente || '—'}</td>
        <td><span class="badge badge-${subCls}">${subLabel}</span></td>
        <td><span class="badge badge-${u.estado || ''}">${getEstadoLabel(u.estado)}</span></td>
        <td><span class="garantia-badge ${garantia.cls}">${garantia.label}</span></td>
        <td style="white-space:nowrap;color:var(--muted);font-size:0.82rem;">${fechaStr}</td>
        <td class="text-right acciones-cell">
          ${accionesHtml}
        </td>
      </tr>
    `;
  }).join('');

  // Eventos
  tbody.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.location.href = `unidad.html?id=${btn.dataset.id}`;
    });
  });
  tbody.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('.btn-edit') || e.target.closest('.btn-ver')) return;
      window.location.href = `unidad.html?id=${tr.dataset.id}`;
    });
  });
  if (!isReadOnly) {
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openEstadoModal(btn.dataset.id);
      });
    });
  }
}

// =============================================
// PAGINACIÓN
// =============================================
function renderPagination() {
  const ctrl = document.getElementById('pageControls');
  if (!ctrl) return;
  const totalPages = Math.ceil(filteredList.length / PAGE_SIZE);
  if (totalPages <= 1) { ctrl.innerHTML = ''; return; }

  let html = `<button class="btn-page" ${currentPage===1?'disabled':''} id="btnPrev">‹</button>`;
  const maxShow = 5;
  let start = Math.max(1, currentPage - 2);
  let end   = Math.min(totalPages, start + maxShow - 1);
  if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);

  if (start > 1) html += `<button class="btn-page" data-pg="1">1</button><span style="padding:0 4px;color:var(--muted)">…</span>`;
  for (let i = start; i <= end; i++) {
    html += `<button class="btn-page ${i===currentPage?'active':''}" data-pg="${i}">${i}</button>`;
  }
  if (end < totalPages) html += `<span style="padding:0 4px;color:var(--muted)">…</span><button class="btn-page" data-pg="${totalPages}">${totalPages}</button>`;
  html += `<button class="btn-page" ${currentPage===totalPages?'disabled':''} id="btnNext">›</button>`;

  ctrl.innerHTML = html;
  ctrl.querySelector('#btnPrev')?.addEventListener('click', () => { currentPage--; renderTable(); renderPagination(); updateCount(); });
  ctrl.querySelector('#btnNext')?.addEventListener('click', () => { currentPage++; renderTable(); renderPagination(); updateCount(); });
  ctrl.querySelectorAll('[data-pg]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.pg);
      renderTable(); renderPagination(); updateCount();
    });
  });
}

function updateCount() {
  const shown = Math.min(currentPage * PAGE_SIZE, filteredList.length) - (currentPage-1)*PAGE_SIZE;
  setText('countShown', Math.max(0, shown).toString());
  setText('countTotal', filteredList.length.toString());
}

// =============================================
// MODAL ESTADO
// =============================================
function bindModal() {
  const modal  = document.getElementById('modalEstado');
  const closeBtn = document.getElementById('modalEstadoClose');
  const cancelBtn = document.getElementById('modalEstadoCancel');
  const confirmBtn = document.getElementById('btnConfirmarEstado');
  const dateRow = document.getElementById('finalizadoDateRow');

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  modal?.querySelectorAll('.btn-estado-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.btn-estado-opt').forEach(b => b.classList.remove('active', 'en_proceso','revision','finalizado'));
      btn.classList.add('active', btn.dataset.val);
      selectedEstado = btn.dataset.val;
      if (selectedEstado === 'finalizado') {
        dateRow?.classList.add('show');
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fechaTerminoModal').value = today;
      } else {
        dateRow?.classList.remove('show');
      }
    });
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!currentEditId || !selectedEstado) return;
    const errEl = document.getElementById('modalEstadoError');
    errEl?.classList.remove('show');

    const updates = {
      estado: selectedEstado,
      actualizadoAt: serverTimestamp(),
    };

    if (selectedEstado === 'finalizado') {
      const dateVal = document.getElementById('fechaTerminoModal')?.value;
      if (!dateVal) {
        if (errEl) { errEl.textContent = 'Ingresa la fecha de término para activar la garantía.'; errEl.classList.add('show'); }
        return;
      }
      const ft = new Date(dateVal + 'T00:00:00');
      updates.fechaTermino = ft;
      updates.garantiaHasta = new Date(ft.getFullYear() + 3, ft.getMonth(), ft.getDate());
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Guardando…';

    try {
      if (!currentEditId.startsWith('DEMO-')) {
        await updateDoc(doc(db, 'unidades', currentEditId), updates);
      } else {
        const idx = allUnidades.findIndex(u => u.id === currentEditId);
        if (idx !== -1) {
          allUnidades[idx].estado = selectedEstado;
          if (updates.fechaTermino)   allUnidades[idx].fechaTermino   = { toDate: () => updates.fechaTermino };
          if (updates.garantiaHasta)  allUnidades[idx].garantiaHasta  = { toDate: () => updates.garantiaHasta };
        }
        updateKPIs();
        applyFilters();
      }
      closeModal();
    } catch (err) {
      if (errEl) { errEl.textContent = 'Error al guardar: ' + err.message; errEl.classList.add('show'); }
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmar Cambio';
    }
  });
}

function openEstadoModal(id) {
  if (isReadOnly) return;
  const unidad = allUnidades.find(u => u.id === id);
  if (!unidad) return;
  currentEditId  = id;
  selectedEstado = unidad.estado;

  const modal = document.getElementById('modalEstado');
  const sub   = document.getElementById('modalEstadoSub');
  const dateRow = document.getElementById('finalizadoDateRow');
  const errEl = document.getElementById('modalEstadoError');

  if (sub) sub.textContent = `VIN: ${unidad.vin || id}${unidad.placa ? ' · ' + unidad.placa : ''}`;
  errEl?.classList.remove('show');
  dateRow?.classList.remove('show');

  modal?.querySelectorAll('.btn-estado-opt').forEach(btn => {
    btn.classList.remove('active','en_proceso','revision','finalizado');
    if (btn.dataset.val === unidad.estado) btn.classList.add('active', unidad.estado);
  });

  modal?.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalEstado')?.classList.add('hidden');
  currentEditId = null;
  selectedEstado = null;
}

// =============================================
// EXPORTAR EXCEL (SheetJS)
// =============================================
function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería de Excel no está disponible. Verifica tu conexión.');
    return;
  }

  const rows = filteredList.map((u, i) => ({
    'N°': i + 1,
    'VIN': u.vin || '',
    'Placa': u.placa || 'SIN PLACA',
    'Marca': u.marca || '',
    'Modelo': u.modelo || '',
    'Cliente': u.cliente || '',
    'Subservicio': u.subservicio || '',
    'Taller': u.taller || '',
    'Técnico': u.tecnico || '',
    'Kilometraje': u.kilometraje || 0,
    'Estado': getEstadoLabel(u.estado),
    'Fecha Ingreso': fmtDate(toDate(u.fechaIngreso)),
    'Fecha Término': fmtDate(toDate(u.fechaTermino)),
    'Garantía Hasta': fmtDate(toDate(u.garantiaHasta)),
    'Comentario': u.comentario || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 4 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 16 },
    { wch: 14 }, { wch: 26 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Unidades');

  const now = new Date();
  const fname = `autogas_unidades_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// =============================================
// HELPERS
// =============================================
function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function fmtDate(d) {
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getEstadoLabel(estado) {
  return {
    en_proceso:  'EN PROCESO',
    revision:    'EN REVISIÓN',
    finalizado:  'FINALIZADO',
    entregado:   'FINALIZADO',
  }[estado] || (estado || '').toUpperCase();
}

function getGarantiaInfo(garantiaHasta) {
  if (!garantiaHasta) return { label: 'Sin garantía', cls: 'sin' };
  const f = garantiaHasta.toDate ? garantiaHasta.toDate() : new Date(garantiaHasta);
  const days = Math.ceil((f - new Date()) / 86400000);
  if (days < 0) return { label: 'Vencida', cls: 'vencida' };
  if (days <= 90) return { label: `${days}d ⚠`, cls: 'por-vencer' };
  return { label: 'Activa ✓', cls: 'activa' };
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getRoleLabel(rol) {
  return {
    admin: 'ADMINISTRADOR',
    operario: 'OPERARIO',
    autoniza: 'AUTONIZA',
  }[rol] || 'USUARIO';
}

function applyAutonizaUX() {
  isReadOnly = true;

  // Header
  const topTitle = document.querySelector('.topbar-left h1');
  const topSub = document.querySelector('.topbar-left p');
  if (topTitle) topTitle.textContent = 'Panel de Unidades — Autoniza';
  if (topSub) topSub.textContent = 'Registro inicial y seguimiento en tiempo real';

  // Deshabilitar modal (UX)
  document.getElementById('modalEstado')?.classList.add('hidden');
}