// =============================================
// AUTOGAS B2B — facturacion.js (Rediseño Completo)
// =============================================
import { db, auth } from './firebase.js';
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession } from './userSession.js';

// =============================================
// AUTH GUARD
// =============================================
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  ensureUsuarioSession(user)
    .then((perfil) => {
      initFac(perfil);
    })
    .catch((err) => {
      alert(String(err?.message || 'Acceso no autorizado.'));
      signOut(auth).finally(() => { window.location.href = '../index.html'; });
    });
});

// =============================================
// LOGOUT
// =============================================
document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});

// =============================================
// PRECIOS (S/ por conversión)
// =============================================
const PRECIO_GNV = 2800;
const PRECIO_GLP = 2200;

// =============================================
// DEMO DATA (8 unidades realistas — Chevrolet)
// =============================================
function getDemoUnidades() {
  const ts = (s) => ({ toDate: () => new Date(s) });
  return [
    { id:'DEMO-1', vin:'KL1MF546XHB123401', placa:'',        marca:'CHEVROLET', modelo:'GROOVE',    cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV', taller:'Autoniza Surquillo', tecnico:'Carlos Ríos',   kilometraje:0,     estado:'en_proceso', fechaIngreso:ts('2026-04-28'), fechaTermino:null },
    { id:'DEMO-2', vin:'KL1MF546XHB123402', placa:'',        marca:'CHEVROLET', modelo:'ONIX',      cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV', taller:'Autoniza Surquillo', tecnico:'Pedro Salas',   kilometraje:0,     estado:'en_proceso', fechaIngreso:ts('2026-04-27'), fechaTermino:null },
    { id:'DEMO-3', vin:'KL1MF546XHB123403', placa:'',        marca:'CHEVROLET', modelo:'TRACKER',   cliente:'AUTONIZA', subservicio:'Conversión a Gas GLP', taller:'Autoniza Callao',    tecnico:'Marco Díaz',    kilometraje:0,     estado:'revision',   fechaIngreso:ts('2026-04-25'), fechaTermino:null },
    { id:'DEMO-4', vin:'KL1MF546XHB123404', placa:'A1B-234', marca:'CHEVROLET', modelo:'SAIL',      cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV', taller:'AutoGas Central',    tecnico:'Ana Flores',    kilometraje:12000, estado:'finalizado', fechaIngreso:ts('2026-04-10'), fechaTermino:ts('2026-04-25') },
    { id:'DEMO-5', vin:'KL1MF546XHB123405', placa:'B3C-456', marca:'CHEVROLET', modelo:'CAVALIER',  cliente:'AUTONIZA', subservicio:'Conversión a Gas GLP', taller:'AutoGas Norte',      tecnico:'Luis Torres',   kilometraje:5500,  estado:'finalizado', fechaIngreso:ts('2026-04-15'), fechaTermino:ts('2026-04-28') },
    { id:'DEMO-6', vin:'KL1MF546XHB123406', placa:'C4D-789', marca:'CHEVROLET', modelo:'GROOVE',    cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV', taller:'Autoniza Surquillo', tecnico:'Carlos Ríos',   kilometraje:8200,  estado:'finalizado', fechaIngreso:ts('2026-03-01'), fechaTermino:ts('2026-03-18') },
    { id:'DEMO-7', vin:'KL1MF546XHB123407', placa:'',        marca:'CHEVROLET', modelo:'ONIX PLUS', cliente:'AUTONIZA', subservicio:'Conversión a Gas GLP', taller:'Autoniza Callao',    tecnico:'Marco Díaz',    kilometraje:0,     estado:'en_proceso', fechaIngreso:ts('2026-04-29'), fechaTermino:null },
    { id:'DEMO-8', vin:'KL1MF546XHB123408', placa:'E5F-321', marca:'CHEVROLET', modelo:'SPARK',     cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV', taller:'AutoGas Central',    tecnico:'Pedro Salas',   kilometraje:22000, estado:'finalizado', fechaIngreso:ts('2026-04-02'), fechaTermino:ts('2026-04-20') },
  ];
}

// =============================================
// GLOBAL STATE
// =============================================
let allMesUnidades = [];
let currentMesVal  = '';
let facturasCache  = [];
let currentFacturaId = null;
let currentPerfil = null;

// =============================================
// INIT
// =============================================
function initFac(perfil) {
  currentPerfil = perfil || null;
  populateMonthSelector();
  document.getElementById('monthSelector')?.addEventListener('change', () => loadMes(perfil));
  document.getElementById('btnExcelFac')?.addEventListener('click', exportExcel);
  if (perfil?.rol === 'autoniza') {
    // Autoniza: puede ver facturación, pero no emitir facturas.
    document.getElementById('btnNuevaFactura')?.classList.add('hidden');
  } else {
    document.getElementById('btnNuevaFactura')?.addEventListener('click', openNuevaFactura);
  }
  bindFacturaModal();
  bindDetalleModal();
  loadMes(perfil);
}

// =============================================
// SELECTOR DE MES (últimos 12)
// =============================================
function populateMonthSelector() {
  const sel = document.getElementById('monthSelector');
  if (!sel) return;
  sel.innerHTML = '';
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es-PE', {month:'long', year:'numeric'});
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

// =============================================
// CARGAR MES
// =============================================
async function loadMes(perfil) {
  const mesVal = document.getElementById('monthSelector')?.value;
  if (!mesVal) return;
  currentMesVal = mesVal;

  const [year, month] = mesVal.split('-').map(Number);
  const inicio = new Date(year, month - 1, 1);
  const fin    = new Date(year, month, 0, 23, 59, 59);

  let unidades = [];

  try {
    const q = query(collection(db, 'unidades'), orderBy('fechaIngreso', 'desc'));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      const f = toDate(data.fechaIngreso);
      if (f && f >= inicio && f <= fin) unidades.push(data);
    });
    if (unidades.length === 0) throw new Error('vacio');
  } catch {
    unidades = getDemoUnidades().filter(u => {
      const f = toDate(u.fechaIngreso);
      return f && f >= inicio && f <= fin;
    });
  }

  allMesUnidades = unidades;

  updateKPIs(unidades);
  renderTabla(unidades, mesVal);
  await loadFacturas(mesVal, perfil);
}

// =============================================
// KPIs
// =============================================
function updateKPIs(unidades) {
  const gnv = unidades.filter(u => (u.subservicio||'').toLowerCase().includes('gnv')).length;
  const glp = unidades.filter(u => (u.subservicio||'').toLowerCase().includes('glp')).length;
  const monto = gnv * PRECIO_GNV + glp * PRECIO_GLP;

  setText('kpiMonto', `S/ ${monto.toLocaleString('es-PE')}`);
  setText('kpiGNV', gnv.toString());
  setText('kpiGLP', glp.toString());

  const mesLabel = document.getElementById('monthSelector')?.selectedOptions[0]?.text || '';
  setText('facSubtitle', `${unidades.length} unidades registradas en ${mesLabel}`);
  setText('tableTitle', `Unidades — ${mesLabel}`);
  setText('facTableCount', `${unidades.length} unidad${unidades.length !== 1 ? 'es' : ''}`);
}

// =============================================
// TABLA DETALLADA
// =============================================
function renderTabla(unidades, mesVal) {
  const tbody = document.getElementById('facTableBody');
  if (!tbody) return;

  if (unidades.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;padding:48px;color:var(--muted);">
          No hay unidades registradas en este período.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = unidades.map((u, i) => {
    const fi = toDate(u.fechaIngreso);
    const ft = toDate(u.fechaTermino);
    const subLow = (u.subservicio || '').toLowerCase();
    const subCls = subLow.includes('gnv') ? 'badge-gnv' : 'badge-glp';
    const subLabel = subLow.includes('gnv') ? 'GNV' : 'GLP';
    const estadoCls = {en_proceso:'badge-en_proceso', revision:'badge-revision', finalizado:'badge-finalizado', entregado:'badge-finalizado'}[u.estado] || '';
    const estadoLabel = getEstadoLabel(u.estado);

    const placaHtml = u.placa
      ? `<span class="placa-tag">${u.placa}</span>`
      : `<span class="no-placa">SIN PLACA</span>`;

    return `
      <tr>
        <td style="color:var(--muted);font-size:0.8rem;text-align:center;">${i+1}</td>
        <td><span class="vin-monospace">${u.vin || '—'}</span></td>
        <td>${placaHtml}</td>
        <td>
          <div style="font-weight:600;font-size:0.875rem;">${u.marca || ''} ${u.modelo || '—'}</div>
          ${u.kilometraje ? `<div style="font-size:0.72rem;color:var(--muted);">${Number(u.kilometraje).toLocaleString()} km</div>` : ''}
        </td>
        <td style="font-weight:500;">${u.cliente || '—'}</td>
        <td><span class="badge ${subCls}">${subLabel}</span></td>
        <td style="font-size:0.8rem;color:var(--muted);white-space:nowrap;">${fmtDate(fi)}</td>
        <td style="font-size:0.8rem;color:var(--muted);white-space:nowrap;">${fmtDate(ft) || '—'}</td>
        <td><span class="badge ${estadoCls}">${estadoLabel}</span></td>
        <td style="font-size:0.8rem;text-align:right;">${u.kilometraje ? Number(u.kilometraje).toLocaleString() : '—'}</td>
        <td style="font-size:0.82rem;color:var(--text-2);">${u.tecnico || '—'}</td>
      </tr>
    `;
  }).join('');
}

// =============================================
// CARGAR FACTURAS
// =============================================
async function loadFacturas(mesVal, perfil) {
  const [year, month] = mesVal.split('-').map(Number);
  let facturas = [];

  try {
    const filters = [
      where('mes', '==', month),
      where('anio', '==', year),
    ];
    // Para autoniza, la query debe filtrar por cliente para cumplir rules.
    if (perfil?.rol === 'autoniza' && perfil?.empresa) {
      filters.push(where('cliente', '==', perfil.empresa));
    }

    const q = query(collection(db, 'facturas'), ...filters);
    const snap = await getDocs(q);
    snap.forEach(d => facturas.push({ id: d.id, ...d.data() }));
  } catch {
    facturas = [];
  }

  facturasCache = facturas;
  renderFacturas(facturas, mesVal);
}

function renderFacturas(facturas, mesVal) {
  const list = document.getElementById('facturasList');
  if (!list) return;

  const mesLabel = document.getElementById('monthSelector')?.selectedOptions[0]?.text || mesVal;
  setText('facturasSubtitle', mesLabel);

  if (facturas.length === 0) {
    list.innerHTML = `
      <div class="facturas-empty">
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="opacity:0.25;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
        No hay facturas emitidas para este período. Usa "Nueva Factura" para crear una.
      </div>
    `;
    return;
  }

  list.innerHTML = facturas.map(f => {
    const fe = toDate(f.fechaEmision);
    const estadoCls = f.estado === 'cobrada' ? 'badge-cobrada' : 'badge-pendiente';
    const estadoLabel = f.estado === 'cobrada' ? 'Cobrada' : 'Pendiente';
    return `
      <div class="factura-item" data-id="${f.id}" style="cursor:pointer;">
        <div class="factura-numero">${f.numero || '—'}</div>
        <div class="factura-info">
          <div class="factura-cliente">${f.cliente || '—'}</div>
          <div class="factura-meta">${fe ? 'Emitida: ' + fmtDate(fe) : ''}${f.notas ? ' · ' + f.notas : ''}</div>
        </div>
        <div class="factura-total">S/ ${Number(f.total || 0).toLocaleString('es-PE')}</div>
        <span class="badge ${estadoCls}">${estadoLabel}</span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.factura-item').forEach(item => {
    item.addEventListener('click', () => openDetalleFactura(item.dataset.id));
  });
}

// =============================================
// MODAL NUEVA FACTURA
// =============================================
function openNuevaFactura() {
  const modal   = document.getElementById('modalFactura');
  const errEl   = document.getElementById('modalFacturaError');
  const [year, month] = currentMesVal.split('-').map(Number);
  const mesLabel = document.getElementById('monthSelector')?.selectedOptions[0]?.text || currentMesVal;

  // Auto número correlativo
  const seq = String(facturasCache.length + 1).padStart(3, '0');
  const num = `FAC-${year}-${seq}`;

  setVal('facNumero', num);
  setVal('facCliente', 'AUTONIZA');
  setVal('facFechaEmision', new Date().toISOString().split('T')[0]);
  setVal('facFechaCobro', '');
  setVal('facMonto', '');
  setVal('facEstado', 'pendiente');
  setVal('facNotas', '');
  errEl?.classList.remove('show');
  setText('modalFacturaSub', `Período: ${mesLabel}`);
  modal?.classList.remove('hidden');
}

function bindFacturaModal() {
  const modal    = document.getElementById('modalFactura');
  const closeBtn = document.getElementById('modalFacturaClose');
  const cancelBtn = document.getElementById('modalFacturaCancel');
  const saveBtn  = document.getElementById('btnGuardarFactura');
  const errEl    = document.getElementById('modalFacturaError');

  const close = () => modal?.classList.add('hidden');
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modal?.addEventListener('click', e => { if (e.target === modal) close(); });

  saveBtn?.addEventListener('click', async () => {
    errEl?.classList.remove('show');
    const cliente = (getVal('facCliente') || '').trim();
    const monto   = parseFloat(getVal('facMonto')) || 0;
    const numero  = getVal('facNumero') || '';
    const feStr   = getVal('facFechaEmision') || '';
    const fcStr   = getVal('facFechaCobro') || '';
    const estado  = getVal('facEstado') || 'pendiente';
    const notas   = (getVal('facNotas') || '').trim();

    if (!cliente) {
      if (errEl) { errEl.textContent = 'El cliente es obligatorio.'; errEl.classList.add('show'); }
      return;
    }
    if (monto <= 0) {
      if (errEl) { errEl.textContent = 'El monto debe ser mayor a 0.'; errEl.classList.add('show'); }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';

    const [year, month] = currentMesVal.split('-').map(Number);

    const unidadesVins = allMesUnidades.map(u => u.vin || u.id).filter(Boolean);
    const gnv = allMesUnidades.filter(u => (u.subservicio||'').toLowerCase().includes('gnv')).length;
    const glp = allMesUnidades.filter(u => (u.subservicio||'').toLowerCase().includes('glp')).length;

    const payload = {
      numero, cliente, mes: month, anio: year,
      unidades: unidadesVins,
      subtotalGNV: gnv * PRECIO_GNV,
      subtotalGLP: glp * PRECIO_GLP,
      total: monto,
      estado,
      notas,
      fechaEmision: feStr ? new Date(feStr + 'T00:00:00') : serverTimestamp(),
      fechaCobro: fcStr ? new Date(fcStr + 'T00:00:00') : null,
    };

    try {
      await addDoc(collection(db, 'facturas'), payload);
      close();
      await loadFacturas(currentMesVal, currentPerfil);
    } catch (err) {
      if (errEl) { errEl.textContent = 'Error al guardar: ' + err.message; errEl.classList.add('show'); }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Crear Factura';
    }
  });
}

// =============================================
// MODAL DETALLE FACTURA
// =============================================
function openDetalleFactura(id) {
  const factura = facturasCache.find(f => f.id === id);
  if (!factura) return;
  currentFacturaId = id;

  const modal   = document.getElementById('modalDetalleFactura');
  const tituloEl = document.getElementById('detFacturaTitulo');
  const subEl   = document.getElementById('detFacturaSub');
  const bodyEl  = document.getElementById('detFacturaBody');
  const marcarBtn = document.getElementById('btnMarcarCobrada');

  if (tituloEl) tituloEl.textContent = factura.numero || '—';
  if (subEl) subEl.textContent = `${factura.cliente} · ${factura.estado === 'cobrada' ? 'Cobrada' : 'Pendiente de cobro'}`;

  const fe = toDate(factura.fechaEmision);
  const fc = toDate(factura.fechaCobro);

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Cliente</div>
          <div style="font-weight:600;">${factura.cliente || '—'}</div>
        </div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Estado</div>
          <span class="badge ${factura.estado === 'cobrada' ? 'badge-cobrada' : 'badge-pendiente'}">${factura.estado === 'cobrada' ? 'Cobrada' : 'Pendiente'}</span>
        </div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Fecha Emisión</div>
          <div>${fmtDate(fe) || '—'}</div>
        </div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Fecha Cobro</div>
          <div>${fmtDate(fc) || '—'}</div>
        </div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Subtotal GNV</div>
          <div class="mono">S/ ${Number(factura.subtotalGNV || 0).toLocaleString('es-PE')}</div>
        </div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Subtotal GLP</div>
          <div class="mono">S/ ${Number(factura.subtotalGLP || 0).toLocaleString('es-PE')}</div>
        </div>
        <div style="grid-column:1/-1;padding-top:12px;border-top:1px solid var(--border);">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Total</div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.8rem;font-weight:700;color:var(--brand);">S/ ${Number(factura.total||0).toLocaleString('es-PE')}</div>
        </div>
        ${factura.notas ? `<div style="grid-column:1/-1;"><div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:3px;">Notas</div><div style="font-size:0.85rem;color:var(--text-2);">${factura.notas}</div></div>` : ''}
      </div>
    `;
  }

  if (marcarBtn) {
    marcarBtn.style.display = factura.estado === 'cobrada' ? 'none' : '';
  }

  modal?.classList.remove('hidden');
}

function bindDetalleModal() {
  const modal   = document.getElementById('modalDetalleFactura');
  const closeBtn = document.getElementById('modalDetalleClose');
  const cancelBtn = document.getElementById('modalDetalleCancel');
  const marcarBtn = document.getElementById('btnMarcarCobrada');

  const close = () => { modal?.classList.add('hidden'); currentFacturaId = null; };
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modal?.addEventListener('click', e => { if (e.target === modal) close(); });

  marcarBtn?.addEventListener('click', async () => {
    if (!currentFacturaId) return;
    marcarBtn.disabled = true;
    marcarBtn.textContent = 'Guardando…';
    try {
      await updateDoc(doc(db, 'facturas', currentFacturaId), {
        estado: 'cobrada',
        fechaCobro: new Date(),
      });
      close();
      await loadFacturas(currentMesVal, currentPerfil);
    } catch {
      // En demo: actualizar local
      const idx = facturasCache.findIndex(f => f.id === currentFacturaId);
      if (idx !== -1) facturasCache[idx].estado = 'cobrada';
      renderFacturas(facturasCache, currentMesVal);
      close();
    } finally {
      marcarBtn.disabled = false;
      marcarBtn.textContent = 'Marcar como Cobrada';
    }
  });
}

// =============================================
// EXPORTAR EXCEL (SheetJS)
// =============================================
function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería de Excel no está disponible. Verifica tu conexión.');
    return;
  }
  if (allMesUnidades.length === 0) {
    alert('No hay datos para exportar en el período seleccionado.');
    return;
  }

  const mesLabel = document.getElementById('monthSelector')?.selectedOptions[0]?.text || currentMesVal;

  const rows = allMesUnidades.map((u, i) => {
    const subLow = (u.subservicio || '').toLowerCase();
    const precio = subLow.includes('gnv') ? PRECIO_GNV : PRECIO_GLP;
    return {
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
      'Fecha Término': fmtDate(toDate(u.fechaTermino)) || '',
      'Precio (S/)': precio,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    {wch:4},{wch:18},{wch:10},{wch:12},{wch:14},{wch:14},
    {wch:24},{wch:22},{wch:18},{wch:11},{wch:13},{wch:13},{wch:13},{wch:11},
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturación');

  const fname = `autogas_facturacion_${currentMesVal}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// =============================================
// HELPERS
// =============================================
function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

function fmtDate(d) {
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit', year:'numeric'});
}

function getEstadoLabel(e) {
  return {en_proceso:'EN PROCESO', revision:'EN REVISIÓN', finalizado:'FINALIZADO', entregado:'FINALIZADO'}[e] || (e||'').toUpperCase();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getVal(id) {
  return document.getElementById(id)?.value || '';
}