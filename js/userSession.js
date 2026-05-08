import { auth, db } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SESSION_KEY = 'autogas_usuario';

/**
 * Lee el usuario autenticado desde `sessionStorage`.
 * @returns {{uid:string,email:string,rol:string,empresa:string}|null}
 */
export function getUsuario() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Retorna el rol actual (si existe en sesión).
 * @returns {string|null}
 */
export function getRol() {
  return getUsuario()?.rol || null;
}

/**
 * Retorna la empresa del usuario (si existe en sesión).
 * @returns {string|null}
 */
export function getEmpresa() {
  return getUsuario()?.empresa || null;
}

/**
 * Limpia el usuario en sesión.
 * @returns {void}
 */
export function clearUsuarioSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Carga `usuarios/{uid}` desde Firestore y lo guarda en `sessionStorage`.
 * Si el usuario está inactivo, cierra sesión.
 *
 * @param {{uid:string,email?:string|null}} user
 * @returns {Promise<{uid:string,email:string,rol:string,empresa:string}>}
 */
export async function ensureUsuarioSession(user) {
  if (!user?.uid) throw new Error('Usuario inválido.');

  const cached = getUsuario();
  if (cached?.uid === user.uid && cached?.rol && cached?.empresa) return cached;

  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snap.exists()) throw new Error('Usuario no registrado en el sistema.');

  const data = snap.data() || {};
  if (data.activo === false) {
    clearUsuarioSession();
    try { await signOut(auth); } catch { /* noop */ }
    throw new Error('Cuenta desactivada');
  }

  const payload = {
    uid: user.uid,
    email: user.email || (data.email || ''),
    rol: data.rol || '',
    empresa: data.empresa || '',
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  return payload;
}

