import { auth } from './firebase.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const SESSION_KEY = 'autogas_usuario';

/**
 * Lee el usuario autenticado desde `sessionStorage`.
 * @returns {{uid:string,email:string}|null}
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
 * Limpia el usuario en sesión.
 * @returns {void}
 */
export function clearUsuarioSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Guarda la sesión mínima del usuario autenticado.
 * No depende de `usuarios/{uid}` ni roles/empresa.
 *
 * @param {{uid:string,email?:string|null}} user
 * @returns {Promise<{uid:string,email:string}>}
 */
export async function ensureUsuarioSession(user) {
  if (!user?.uid) throw new Error('Usuario inválido.');

  const cached = getUsuario();
  if (cached?.uid === user.uid) return cached;

  const payload = {
    uid: user.uid,
    email: user.email || '',
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  return payload;
}

export async function forceCloseSession() {
  clearUsuarioSession();
  try { await signOut(auth); } catch { /* noop */ }
}

