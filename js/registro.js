// =============================================
// AUTOGAS B2B — registro.js (Rediseño Completo)
// =============================================
import { db, auth } from './firebase.js';
import {
  collection, getDocs, query, where, serverTimestamp, setDoc, doc
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
      initForm();
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
// INIT
// =============================================
function initForm() {
  setDefaultDate();
  bindVinDecoder();
  bindPlacaUppercase();
  bindClienteToggle();
  bindFormSubmit();
}

// =============================================
// DEFAULT DATE
// =============================================
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('inputFechaIngreso');
  if (el) el.value = today;
}

// =============================================
// VIN DECODER
// =============================================
function bindVinDecoder() {
  const input   = document.getElementById('inputVin');
  const counter = document.getElementById('vinCounter');
  const okBox   = document.getElementById('vinDecoderOk');
  const errBox  = document.getElementById('vinDecoderErr');
  const okText  = document.getElementById('vinDecoderText');

  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, '').slice(0, 17);
    input.value = val;
    const len = val.length;

    counter.textContent = `${len}/17`;
    counter.className = 'vin-counter' + (len === 17 ? ' complete' : len > 17 ? ' over' : '');

    okBox.classList.remove('show');
    errBox.classList.remove('show');

    if (len === 17) {
      const info = decodeVIN(val);
      if (info) {
        okText.textContent = info;
        okBox.classList.add('show');
      }
    }
  });
}

function decodeVIN(vin) {
  const ORIGIN = {
    '1':'USA','2':'Canadá','3':'México','4':'USA','5':'USA',
    'J':'Japón','K':'Corea del Sur','L':'China','S':'Reino Unido',
    'V':'Francia/España','W':'Alemania','Z':'Italia','Y':'Suecia/Finlandia'
  };
  const YEAR_MAP = {
    'A':2010,'B':2011,'C':2012,'D':2013,'E':2014,'F':2015,
    'G':2016,'H':2017,'J':2018,'K':2019,'L':2020,'M':2021,
    'N':2022,'P':2023,'R':2024,'S':2025,'T':2026,'V':2027,
    '1':2001,'2':2002,'3':2003,'4':2004,'5':2005,'6':2006,
    '7':2007,'8':2008,'9':2009
  };
  const origin = ORIGIN[vin[0].toUpperCase()] || 'Internacional';
  const year = YEAR_MAP[vin[9].toUpperCase()] || 'Año desconocido';
  return `VIN válido · Origen: ${origin} · Año modelo: ${year}`;
}

// =============================================
// PLACA UPPERCASE
// =============================================
function bindPlacaUppercase() {
  document.getElementById('inputPlaca')?.addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });
}

// =============================================
// CLIENTE LIBRE
// =============================================
function bindClienteToggle() {
  const sel   = document.getElementById('inputCliente');
  const group = document.getElementById('clienteLibreGroup');
  if (!sel || !group) return;

  sel.addEventListener('change', () => {
    if (sel.value === 'OTRO') {
      group.classList.remove('hidden');
      document.getElementById('inputClienteLibre')?.setAttribute('required', 'true');
    } else {
      group.classList.add('hidden');
      document.getElementById('inputClienteLibre')?.removeAttribute('required');
    }
  });
}

// =============================================
// FORM SUBMIT
// =============================================
function bindFormSubmit() {
  const form = document.getElementById('registroForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const vin         = (document.getElementById('inputVin')?.value || '').trim().toUpperCase();
    const placa       = (document.getElementById('inputPlaca')?.value || '').trim().toUpperCase();
    const marca       = (document.getElementById('inputMarca')?.value || '').trim();
    const modelo      = (document.getElementById('inputModelo')?.value || '').trim();
    const clienteSel  = document.getElementById('inputCliente')?.value || '';
    const clienteLibre = (document.getElementById('inputClienteLibre')?.value || '').trim();
    const cliente     = clienteSel === 'OTRO' ? clienteLibre : clienteSel;
    const subservicio = document.getElementById('inputSubservicio')?.value || '';
    const taller      = document.getElementById('inputTaller')?.value || '';
    const tecnico     = (document.getElementById('inputTecnico')?.value || '').trim();
    const km          = parseInt(document.getElementById('inputKm')?.value) || 0;
    const fechaStr    = document.getElementById('inputFechaIngreso')?.value || '';
    const comentario  = (document.getElementById('inputComentario')?.value || '').trim();

    // Validaciones
    let hasError = false;
    if (!vin || vin.length !== 17) {
      showError('El VIN debe tener exactamente 17 caracteres.');
      hasError = true;
    }
    if (!marca) { showError('La marca del vehículo es obligatoria.'); hasError = true; }
    if (!modelo) { showError('El modelo del vehículo es obligatorio.'); hasError = true; }
    if (!cliente) { showError('El cliente / concesionario es obligatorio.'); hasError = true; }
    if (!subservicio) { showError('Selecciona el tipo de conversión.'); hasError = true; }
    if (!taller) { showError('Selecciona el taller asignado.'); hasError = true; }
    if (!fechaStr) { showError('La fecha de ingreso es obligatoria.'); hasError = true; }
    if (hasError) return;

    setLoading(true);

    try {
      // Verificar unicidad del VIN
      const vinQuery = query(collection(db, 'unidades'), where('vin', '==', vin));
      const existing = await getDocs(vinQuery);
      if (!existing.empty) {
        showError(`Ya existe una unidad registrada con el VIN ${vin}.`);
        setLoading(false);
        return;
      }

      const fechaIngreso = new Date(fechaStr + 'T00:00:00');

      await setDoc(doc(db, 'unidades', vin), {
        vin,
        placa: placa || '',
        marca,
        modelo,
        cliente,
        subservicio,
        taller,
        tecnico: tecnico || '',
        kilometraje: km,
        estado: 'en_proceso',
        fechaIngreso,
        fechaTermino: null,
        garantiaHasta: null,
        comentario: comentario || '',
        creadoAt: serverTimestamp(),
        actualizadoAt: serverTimestamp(),
      });

      showSuccess();
      setTimeout(() => { window.location.href = `unidad.html?id=${vin}`; }, 1800);

    } catch (err) {
      console.error('Error al registrar unidad:', err);
      showError('Error al guardar en la base de datos. Verifica tu conexión e intenta de nuevo.');
      setLoading(false);
    }
  });
}

// =============================================
// UI HELPERS
// =============================================
function setLoading(on) {
  const btn     = document.getElementById('btnSubmit');
  const spinner = document.getElementById('submitSpinner');
  const text    = document.getElementById('btnSubmitText');
  if (btn) btn.disabled = on;
  if (spinner) spinner.classList.toggle('show', on);
  if (text) text.textContent = on ? 'Registrando...' : 'Registrar Unidad';
}

function showError(msg) {
  const errEl  = document.getElementById('formError');
  const textEl = document.getElementById('formErrorText');
  if (textEl) textEl.textContent = msg;
  errEl?.classList.add('show');
  errEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setLoading(false);
}

function showSuccess() {
  setLoading(false);
  document.getElementById('formError')?.classList.remove('show');
  document.getElementById('formSuccess')?.classList.add('show');
}

function clearErrors() {
  document.getElementById('formError')?.classList.remove('show');
  document.getElementById('formSuccess')?.classList.remove('show');
}