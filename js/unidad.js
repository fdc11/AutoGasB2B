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

async function loadUnidad() {
  unidadId = new URLSearchParams(window.location.search).get('id');
  if (!unidadId) return window.location.href = 'dashboard.html';
  const snap = await getDoc(doc(db, 'unidades', unidadId));
  if (!snap.exists()) return alert('Unidad no encontrada');
  currentUnidad = { id: snap.id, ...snap.data() };
  document.getElementById('topVin').textContent = currentUnidad.vin || currentUnidad.id;
  document.getElementById('snapshotView').textContent = JSON.stringify(currentUnidad, null, 2);

  const q = query(collection(db, 'servicios'), where('unidadVin', '==', unidadId), orderBy('fecha', 'desc'));
  const svc = await getDocs(q);
  const servicios = [];
  svc.forEach((d) => servicios.push(d.data()));
  renderTimeline(servicios);
  bindEvento();
}

function renderTimeline(servicios) {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  tl.innerHTML = servicios.length
    ? servicios.map((s) => `<div class="timeline-item"><strong>${s.tipo || '-'}</strong> - ${fmtDate(s.fecha)} - ${s.tecnico || '-'}<br>${s.observaciones || ''}</div>`).join('')
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

function val(id) { return document.getElementById(id)?.value || ''; }
function fmtDate(raw) {
  if (!raw) return '';
  const d = raw.toDate ? raw.toDate() : new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE');
}