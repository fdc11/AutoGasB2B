import { db, auth } from './firebase.js';
import {
  collection, getDocs, query, where, serverTimestamp, setDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession } from './userSession.js';
import { getAjustes, fillSelect } from './ajustes.js';

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  ensureUsuarioSession(user).then(initForm).catch(() => signOut(auth).finally(() => { window.location.href = '../index.html'; }));
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});

async function initForm() {
  const ajustes = await getAjustes();
  fillSelect(document.getElementById('sede'), ajustes.sedes, 'SEDE');
  fillSelect(document.getElementById('tipoConversion'), ajustes.tipoConversion, 'TIPO CONVERSION');
  fillSelect(document.getElementById('concesionaria'), ajustes.concesionarias, 'CONCESIONARIA');
  fillSelect(document.getElementById('tipoTanqueGlp'), ajustes.tipoTanqueGlp, 'TIPO TANQUE GLP');
  fillSelect(document.getElementById('marcaTanque'), ajustes.marcaTanque, 'MARCA TANQUE');
  fillSelect(document.getElementById('bono'), ajustes.bono, 'BONO');

  document.getElementById('concesionaria')?.addEventListener('change', () => {
    const isOtros = val('concesionaria') === 'OTROS';
    document.getElementById('concesionariaOtro')?.classList.toggle('hidden', !isOtros);
  });
  bindFormSubmit();
}

function bindFormSubmit() {
  document.getElementById('registroForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vin = val('vin').toUpperCase().trim();
    if (vin.length !== 17) return alert('VIN debe tener 17 caracteres.');

    const existing = await getDocs(query(collection(db, 'unidades'), where('vin', '==', vin)));
    if (!existing.empty) return alert('VIN ya registrado.');

    const concesionaria = val('concesionaria') === 'OTROS' ? val('concesionariaOtro').trim() : val('concesionaria');
    if (!concesionaria) return alert('Concesionaria es obligatoria.');

    const payload = {
      vin,
      item: val('item'), folio: val('folio'), anio: num('anio'), mes: num('mes'), bloque: val('bloque'),
      sede: val('sede'), tipoConversion: val('tipoConversion'), concesionaria, estado: val('estado'),
      propietario: val('propietario'), dniRuc: val('dniRuc'), telefono: val('telefono'),
      placa: val('placa').toUpperCase(), marca: val('marca'), modelo: val('modelo'),
      anioVehiculo: num('anioVehiculo'), color: val('color'), combustible: val('combustible'),
      vinSerie: val('vinSerie'), motor: val('motor'),
      tipoTanqueGlp: val('tipoTanqueGlp'), marcaTanque: val('marcaTanque'), capacidadTanque: val('capacidadTanque'),
      numeroKit: val('numeroKit'), ecu: val('ecu'), rampa: val('rampa'), reductor: val('reductor'), multivalvula: val('multivalvula'), cilindro: val('cilindro'),
      fechaConversion: dateOrNull('fechaConversion'), certificadora: val('certificadora'), tecnico: val('tecnico'), observaciones: val('observaciones'),
      costo: num('costo'), bono: val('bono'), facturaNumero: val('facturaNumero'), fechaFactura: dateOrNull('fechaFactura'),
      pago: val('pago'), estadoPago: val('estadoPago'), entrega: val('entrega'), fechaEntrega: dateOrNull('fechaEntrega'),
      creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'unidades', vin), payload);
    window.location.href = `unidad.html?id=${vin}`;
  });
}

function val(id) { return document.getElementById(id)?.value || ''; }
function num(id) { const n = Number(val(id)); return Number.isNaN(n) ? 0 : n; }
function dateOrNull(id) { const v = val(id); return v ? new Date(`${v}T00:00:00`) : null; }