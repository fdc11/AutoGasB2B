// =============================================
// AUTOGAS B2B — unidad.js (Rediseño Completo)
// =============================================
import { db, auth } from './firebase.js';
import {
  doc, getDoc, updateDoc, collection, query, where,
  getDocs, addDoc, orderBy, serverTimestamp
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
      if (perfil.rol === 'autoniza') {
        // Autoniza: ocultar acciones de escritura (solo UX; las rules bloquean server-side).
        document.getElementById('btnAddService')?.classList.add('hidden');
        document.getElementById('btnEditarDatos')?.classList.add('hidden');
        disableWriteUX = true;
      }
      loadUnidad();
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
// DEMO DATA (para IDs DEMO-x)
// =============================================
const DEMO = {
  'DEMO-1': {
    vin:'KL1MF546XHB123401', placa:'', marca:'CHEVROLET', modelo:'GROOVE',
    cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV',
    taller:'Autoniza Surquillo', tecnico:'Carlos Ríos', kilometraje:0,
    estado:'en_proceso', fechaIngreso:new Date('2026-04-28'),
    fechaTermino:null, garantiaHasta:null, comentario:'Unidad nueva sin placa.',
    servicios:[ {tipo:'Conversión GNV',fecha:new Date('2026-04-28'),tecnico:'Carlos Ríos',descripcion:'Inicio de instalación kit GNV 4ta gen. En proceso.',estado:'en_proceso'} ]
  },
  'DEMO-4': {
    vin:'KL1MF546XHB123404', placa:'A1B-234', marca:'CHEVROLET', modelo:'SAIL',
    cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV',
    taller:'AutoGas Central', tecnico:'Ana Flores', kilometraje:12000,
    estado:'finalizado', fechaIngreso:new Date('2026-03-10'),
    fechaTermino:new Date('2026-03-25'), garantiaHasta:new Date('2029-03-25'), comentario:'',
    servicios:[
      {tipo:'Conversión GNV',fecha:new Date('2026-03-10'),tecnico:'Ana Flores',descripcion:'Instalación completa kit GNV. Prueba de hermeticidad aprobada.',estado:'completado'},
      {tipo:'Entrega',fecha:new Date('2026-03-25'),tecnico:'Ana Flores',descripcion:'Vehículo entregado al cliente. Certificado OSINERGMIN generado.',estado:'completado'},
    ]
  },
  'DEMO-6': {
    vin:'KL1MF546XHB123406', placa:'C4D-789', marca:'CHEVROLET', modelo:'GROOVE',
    cliente:'AUTONIZA', subservicio:'Conversión a Gas GNV',
    taller:'Autoniza Surquillo', tecnico:'Carlos Ríos', kilometraje:8200,
    estado:'finalizado', fechaIngreso:new Date('2023-04-01'),
    fechaTermino:new Date('2023-04-18'), garantiaHasta:new Date('2024-04-18'), comentario:'Garantía vencida.',
    servicios:[ {tipo:'Conversión GNV',fecha:new Date('2023-04-01'),tecnico:'Carlos Ríos',descripcion:'Instalación completada.',estado:'completado'} ]
  },
};

// Estado global
let currentUnidad = null;
let disableWriteUX = false;

// =============================================
// LOAD UNIDAD
// =============================================
async function loadUnidad() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { window.location.href = 'dashboard.html'; return; }

  document.getElementById('topbarVin').textContent = id;

  let unidad = null;
  let servicios = [];

  try {
    const snap = await getDoc(doc(db, 'unidades', id));
    if (snap.exists()) {
      unidad = { id: snap.id, ...snap.data() };
      try {
        const q = query(collection(db, 'servicios'), where('unidadId', '==', id), orderBy('fecha', 'desc'));
        const svcSnap = await getDocs(q);
        svcSnap.forEach(s => servicios.push({ id: s.id, ...s.data() }));
      } catch { /* sin índice, sin servicios */ }
    } else {
      throw new Error('not found');
    }
  } catch {
    const demo = DEMO[id] || DEMO['DEMO-1'];
    if (demo) {
      unidad = { id, ...demo };
      servicios = demo.servicios || [];
    }
  }

  if (!unidad) {
    document.getElementById('pageLoader').innerHTML = `
      <p style="color:var(--muted);">No se encontró la unidad con ID <strong>${id}</strong>.</p>
      <a href="dashboard.html" class="btn-secondary" style="margin-top:12px;text-decoration:none;">← Volver al Dashboard</a>
    `;
    return;
  }

  currentUnidad = unidad;
  renderUnidad(unidad, servicios);
  if (!disableWriteUX) {
    bindEditar(unidad);
    bindServicio(unidad.id || id);
  }
}

// =============================================
// RENDER
// =============================================
function renderUnidad(u, servicios) {
  document.getElementById('pageLoader')?.classList.add('hidden');
  const content = document.getElementById('unidadContent');
  if (content) content.classList.remove('hidden');
  if (!disableWriteUX) {
    document.getElementById('btnEditarDatos')?.classList.remove('hidden');
  }

  const vin = u.vin || u.id;
  document.getElementById('topbarVin').textContent = `VIN: ${vin}${u.placa ? '  ·  ' + u.placa : ''}`;

  // WARRANTY BANNER
  const banner = document.getElementById('warrantyBanner');
  const fi = toDate(u.garantiaHasta);
  const days = fi ? Math.ceil((fi - new Date()) / 86400000) : null;

  banner.className = 'warranty-banner';
  if (u.estado === 'en_proceso' || u.estado === 'revision') {
    banner.classList.add('en-proceso');
    setText('warrantyTitle', u.estado === 'revision' ? '🔍 En Revisión Técnica' : '🔧 En Proceso de Conversión');
    setText('warrantyDesc', 'La garantía de 3 años se activará al marcar la unidad como Finalizada.');
  } else if (fi && days > 30) {
    banner.classList.add('garantia-activa');
    setText('warrantyTitle', '✓ Garantía Activa');
    setText('warrantyDesc', `Vence el ${fi.toLocaleDateString('es-PE', {day:'2-digit',month:'long',year:'numeric'})} · Quedan ${days} días`);
  } else if (fi && days >= 0) {
    banner.classList.add('por-vencer');
    setText('warrantyTitle', '⚠ Garantía Por Vencer');
    setText('warrantyDesc', `Vence en ${days} días — ${fi.toLocaleDateString('es-PE', {day:'2-digit',month:'long',year:'numeric'})}`);
  } else {
    banner.classList.add('garantia-vencida');
    setText('warrantyTitle', '✗ Sin Garantía Vigente');
    setText('warrantyDesc', fi ? `Venció el ${fi.toLocaleDateString('es-PE')}` : 'Garantía no registrada.');
  }

  // Badges
  const subLow = (u.subservicio || '').toLowerCase();
  const subCls = subLow.includes('gnv') ? 'badge-gnv' : 'badge-glp';
  const subLabel = subLow.includes('gnv') ? 'GNV' : subLow.includes('glp') ? 'GLP' : (u.subservicio || '—');
  const badgeSub = document.getElementById('badgeSub');
  if (badgeSub) { badgeSub.textContent = subLabel; badgeSub.className = `badge ${subCls}`; }

  const estadoCls = { en_proceso:'badge-en_proceso', revision:'badge-revision', finalizado:'badge-finalizado', entregado:'badge-finalizado' }[u.estado] || '';
  const badgeEstado = document.getElementById('badgeEstado');
  if (badgeEstado) { badgeEstado.textContent = getEstadoLabel(u.estado); badgeEstado.className = `badge ${estadoCls}`; }

  // DATOS
  const valPlaca = document.getElementById('valPlaca');
  if (valPlaca) {
    if (u.placa) {
      valPlaca.textContent = u.placa;
    } else {
      valPlaca.innerHTML = '<span class="badge badge-sin-placa">SIN PLACA</span>';
    }
  }

  setText('valVin', u.vin || '—');
  setText('valMarca', u.marca || '—');
  setText('valModelo', u.modelo || '—');
  setText('valCliente', u.cliente || '—');
  setText('valSubservicio', u.subservicio || '—');
  setText('valTaller', u.taller || '—');
  setText('valTecnico', u.tecnico || '—');
  setText('valKm', u.kilometraje ? `${Number(u.kilometraje).toLocaleString('es-PE')} km` : '0 km');
  setText('valFechaIngreso', fmtDateLong(toDate(u.fechaIngreso)));
  setText('valFechaTermino', fmtDateLong(toDate(u.fechaTermino)) || '—');
  setText('valGarantia', fi ? `Hasta ${fmtDateLong(fi)}${days !== null && days >= 0 ? ` (${days}d)` : ' — VENCIDA'}` : '—');

  if (u.comentario) {
    setText('valComentario', u.comentario);
    const row = document.getElementById('rowComentario');
    if (row) row.style.display = 'flex';
  }

  // TIMELINE
  renderTimeline(servicios);
}

// =============================================
// TIMELINE
// =============================================
function renderTimeline(servicios) {
  const tl = document.getElementById('serviceTimeline');
  if (!tl) return;

  if (!servicios || servicios.length === 0) {
    tl.innerHTML = `<p class="timeline-empty">No hay servicios registrados aún. Usa el botón para agregar el primero.</p>`;
    return;
  }

  tl.innerHTML = servicios.map(s => {
    const fecha = toDate(s.fecha);
    const fechaStr = fecha ? fecha.toLocaleDateString('es-PE', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const dotCls = s.estado === 'completado' ? 'ok' : s.estado === 'en_proceso' ? 'process' : 'review';
    const dotIcon = s.estado === 'completado'
      ? `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`
      : `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    return `
      <div class="timeline-item">
        <div class="timeline-dot ${dotCls}">${dotIcon}</div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-tipo">${s.tipo || 'Servicio'}</span>
            <span class="timeline-fecha">${fechaStr}</span>
          </div>
          ${s.descripcion ? `<p class="timeline-desc">${s.descripcion}</p>` : ''}
          ${s.tecnico ? `<span class="timeline-tecnico">Técnico: ${s.tecnico}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// MODAL EDITAR
// =============================================
function bindEditar(u) {
  const btn = document.getElementById('btnEditarDatos');
  const modal = document.getElementById('modalEditar');
  const closeBtn = document.getElementById('modalEditarClose');
  const cancelBtn = document.getElementById('modalEditarCancel');
  const saveBtn = document.getElementById('btnGuardarEdicion');
  const errEl = document.getElementById('modalEditarError');

  btn?.addEventListener('click', () => {
    // Rellenar campos
    setVal('editPlaca', u.placa || '');
    setVal('editMarca', u.marca || '');
    setVal('editModelo', u.modelo || '');
    setVal('editCliente', u.cliente || '');
    setVal('editSubservicio', u.subservicio || 'Conversión a Gas GNV');
    setVal('editTaller', u.taller || 'Autoniza Surquillo');
    setVal('editTecnico', u.tecnico || '');
    setVal('editKm', u.kilometraje || 0);
    setVal('editEstado', u.estado || 'en_proceso');
    setVal('editFechaTermino', toDateInput(toDate(u.fechaTermino)));
    setVal('editComentario', u.comentario || '');
    setText('modalEditarSub', `VIN: ${u.vin || u.id}`);
    errEl?.classList.remove('show');
    modal?.classList.remove('hidden');
  });

  const closeModal = () => modal?.classList.add('hidden');
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  saveBtn?.addEventListener('click', async () => {
    errEl?.classList.remove('show');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';

    const placa      = (getVal('editPlaca') || '').toUpperCase().trim();
    const marca      = (getVal('editMarca') || '').trim();
    const modelo     = (getVal('editModelo') || '').trim();
    const cliente    = (getVal('editCliente') || '').trim();
    const subservicio = getVal('editSubservicio') || '';
    const taller     = getVal('editTaller') || '';
    const tecnico    = (getVal('editTecnico') || '').trim();
    const km         = parseInt(getVal('editKm')) || 0;
    const estado     = getVal('editEstado') || 'en_proceso';
    const ftStr      = getVal('editFechaTermino') || '';
    const comentario = (getVal('editComentario') || '').trim();

    const updates = {
      placa, marca, modelo, cliente, subservicio, taller, tecnico,
      kilometraje: km, estado, comentario, actualizadoAt: serverTimestamp()
    };

    if (ftStr) {
      const ft = new Date(ftStr + 'T00:00:00');
      updates.fechaTermino = ft;
      if (estado === 'finalizado') {
        updates.garantiaHasta = new Date(ft.getFullYear() + 3, ft.getMonth(), ft.getDate());
      }
    }

    try {
      if (!u.id.startsWith('DEMO-')) {
        await updateDoc(doc(db, 'unidades', u.id), updates);
      } else {
        // demo: actualizar local
        Object.assign(currentUnidad, updates);
        if (updates.fechaTermino)  currentUnidad.fechaTermino  = { toDate: () => updates.fechaTermino };
        if (updates.garantiaHasta) currentUnidad.garantiaHasta = { toDate: () => updates.garantiaHasta };
      }
      closeModal();
      // Re-render
      renderUnidad({ ...currentUnidad, ...updates }, []);
    } catch (err) {
      if (errEl) { errEl.textContent = 'Error al guardar: ' + err.message; errEl.classList.add('show'); }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Cambios';
    }
  });
}

// =============================================
// MODAL AGREGAR SERVICIO
// =============================================
function bindServicio(unidadId) {
  const btnAdd = document.getElementById('btnAddService');
  const modal  = document.getElementById('modalServicio');
  const closeBtn = document.getElementById('modalServicioClose');
  const cancelBtn = document.getElementById('modalServicioCancel');
  const saveBtn = document.getElementById('btnGuardarServicio');
  const errEl   = document.getElementById('modalServicioError');

  const closeModal = () => modal?.classList.add('hidden');

  btnAdd?.addEventListener('click', () => {
    setVal('svcTipo', '');
    setVal('svcTecnico', '');
    setVal('svcDesc', '');
    errEl?.classList.remove('show');
    modal?.classList.remove('hidden');
  });

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  saveBtn?.addEventListener('click', async () => {
    const tipo    = (getVal('svcTipo') || '').trim();
    const tecnico = (getVal('svcTecnico') || '').trim();
    const desc    = (getVal('svcDesc') || '').trim();

    if (!tipo) {
      if (errEl) { errEl.textContent = 'El tipo de servicio es obligatorio.'; errEl.classList.add('show'); }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    errEl?.classList.remove('show');

    try {
      if (!unidadId.startsWith('DEMO-')) {
        await addDoc(collection(db, 'servicios'), {
          unidadId, tipo, tecnico, descripcion: desc,
          estado: 'completado', fecha: serverTimestamp(), creadoPor: ''
        });
        closeModal();
        // Recargar
        window.location.reload();
      } else {
        // Demo: append local
        const tl = document.getElementById('serviceTimeline');
        const item = { tipo, tecnico, descripcion: desc, estado: 'completado', fecha: new Date() };
        const demos = [item, ...(currentUnidad.servicios || [])];
        currentUnidad.servicios = demos;
        renderTimeline(demos);
        closeModal();
      }
    } catch (err) {
      if (errEl) { errEl.textContent = 'Error al guardar: ' + err.message; errEl.classList.add('show'); }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Servicio';
    }
  });
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

function fmtDateLong(d) {
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function toDateInput(d) {
  if (!d || isNaN(d)) return '';
  return d.toISOString().split('T')[0];
}

function getEstadoLabel(e) {
  return { en_proceso:'EN PROCESO', revision:'EN REVISIÓN', finalizado:'FINALIZADO', entregado:'FINALIZADO' }[e] || (e||'').toUpperCase();
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