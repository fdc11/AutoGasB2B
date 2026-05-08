// =============================================
// IMPORTS FIREBASE
// =============================================
import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  ensureUsuarioSession,
  getEmpresa,
  getRol,
  getUsuario,
} from './userSession.js';

// =============================================
// ELEMENTOS DEL DOM
// =============================================
const emailInput  = document.getElementById('email');
const passInput   = document.getElementById('password');
const btnLogin    = document.getElementById('btnLogin');
const btnText     = document.getElementById('btnText');
const btnLoader   = document.getElementById('btnLoader');
const errorMsg    = document.getElementById('errorMsg');
const togglePass  = document.getElementById('togglePass');

// =============================================
// SESIÓN (ROL / EMPRESA)
// =============================================
export { ensureUsuarioSession, getEmpresa, getRol, getUsuario };

function setLoginMessage(msg) {
  if (!errorMsg) return;
  errorMsg.textContent = msg;
  errorMsg.classList.add('show');
}

// =============================================
// MOSTRAR / OCULTAR CONTRASEÑA
// =============================================
togglePass?.addEventListener('click', () => {
  const isPassword = passInput?.type === 'password';
  if (passInput) passInput.type = isPassword ? 'text' : 'password';
});

// =============================================
// COUNTER ANIMACIÓN (stats del panel izquierdo)
// =============================================
document.querySelectorAll('.stat-num').forEach(el => {
  const target = parseInt(el.dataset.target);
  const duration = 1600;
  const step = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      el.textContent = target >= 1000
        ? (target / 1000).toFixed(0) + 'K+'
        : target + (el.dataset.suffix || '');
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(current);
    }
  }, 16);
});

// =============================================
// MOSTRAR ERROR
// =============================================
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('show');
}

function hideError() {
  errorMsg.classList.remove('show');
}

// =============================================
// ESTADO DEL BOTÓN
// =============================================
function setLoading(loading) {
  btnLogin.disabled = loading;
  btnText.classList.toggle('hidden', loading);
  btnLoader.classList.toggle('hidden', !loading);
}

// =============================================
// LOGIN
// =============================================
btnLogin?.addEventListener('click', async () => {
  hideError();

  const email    = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) {
    showError('Por favor completa todos los campos.');
    return;
  }

  setLoading(true);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const perfil = await ensureUsuarioSession(cred.user);

    window.location.href = 'pages/dashboard.html';
  } catch (error) {
    setLoading(false);
    if (error?.message === 'Cuenta desactivada') {
      setLoginMessage('Cuenta desactivada');
      return;
    }
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        showError('Correo o contraseña incorrectos.');
        break;
      case 'auth/too-many-requests':
        showError('Demasiados intentos. Intenta más tarde.');
        break;
      case 'auth/invalid-email':
        showError('El correo ingresado no es válido.');
        break;
      default:
        showError('Error al iniciar sesión. Intenta nuevamente.');
    }
  }
});

// =============================================
// SI YA ESTÁ LOGUEADO — REDIRIGE DIRECTO
// =============================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Si ya está logueado, asegura perfil y redirige según rol
    ensureUsuarioSession(user)
      .then((perfil) => {
        window.location.href = 'pages/dashboard.html';
      })
      .catch((err) => {
        // Si está desactivado o sin perfil, forzar cierre y permitir volver a intentar
        if (String(err?.message || '') === 'Cuenta desactivada') setLoginMessage('Cuenta desactivada');
        else setLoginMessage('Acceso no autorizado. Contacta a tu administrador.');
      });
  }
});

// =============================================
// ENTER PARA LOGUEAR
// =============================================
passInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin?.click();
});
