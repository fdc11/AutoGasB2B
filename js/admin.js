import { auth, db } from './firebase.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getUsuario } from './userSession.js';

const SESSION_KEY = 'autogas_usuario';

/**
 * Redirige a una ruta relativa desde `/pages/`.
 * @param {string} href
 * @returns {void}
 */
function go(href) {
  window.location.href = href;
}

/**
 * Auth guard basado en `sessionStorage`.
 * - Sin sesión: vuelve al login.
 * - Rol distinto a admin: vuelve al dashboard.
 *
 * @returns {{uid:string,email:string,rol:string,empresa:string}}
 */
function requireAdminSession() {
  const usuario = getUsuario();
  if (!usuario) go('../index.html');
  if (usuario?.rol !== 'admin') go('dashboard.html');
  return usuario;
}

/**
 * Setea textos del header del usuario.
 * @param {{email?:string}} perfil
 * @returns {void}
 */
function hydrateHeader(perfil) {
  const email = String(perfil?.email || '');
  const nameParts = (email.split('@')[0] || '').replace(/[._]/g, ' ').trim().toUpperCase();
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  if (userName) userName.textContent = nameParts || 'ADMIN';
  if (userAvatar) userAvatar.textContent = (nameParts || 'A').charAt(0);
}

/**
 * Renderiza el badge de estado.
 * @param {boolean} isActive
 * @returns {string}
 */
function renderEstadoBadge(isActive) {
  return isActive
    ? `<span class="admin-badge admin-badge-ok">Activo</span>`
    : `<span class="admin-badge admin-badge-bad">Inactivo</span>`;
}

/**
 * Escapa HTML mínimo para strings.
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Carga y renderiza la tabla de usuarios.
 * @returns {Promise<void>}
 */
async function loadUsuarios() {
  const tbody = document.getElementById('usersTbody');
  const empty = document.getElementById('usersEmpty');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="admin-loading">Cargando…</td></tr>`;
  empty?.classList.add('hidden');

  const snap = await getDocs(collection(db, 'usuarios'));
  const rows = [];

  snap.forEach((d) => {
    const data = d.data() || {};
    const email = data.email || '';
    const rol = data.rol || '';
    const empresa = data.empresa || '';
    const activo = data.activo !== false;
    rows.push({
      id: d.id,
      email,
      rol,
      empresa,
      activo,
    });
  });

  rows.sort((a, b) => String(a.email).localeCompare(String(b.email)));

  if (rows.length === 0) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }

  tbody.innerHTML = rows.map((u) => {
    const btnToggle = u.activo
      ? `<button class="admin-btn admin-btn-secondary admin-btn-sm" data-action="deactivate" data-id="${esc(u.id)}">Desactivar</button>`
      : `<button class="admin-btn admin-btn-primary admin-btn-sm" data-action="activate" data-id="${esc(u.id)}">Activar</button>`;

    return `
      <tr>
        <td class="mono">${esc(u.email)}</td>
        <td class="admin-rol">${esc(u.rol)}</td>
        <td>${esc(u.empresa)}</td>
        <td>${renderEstadoBadge(u.activo)}</td>
        <td class="text-right admin-actions-cell">
          ${btnToggle}
          <button class="admin-btn admin-btn-danger admin-btn-sm" data-action="delete" data-id="${esc(u.id)}">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Actualiza el campo `activo` de un usuario y refresca tabla.
 * @param {string} uid
 * @param {boolean} activo
 * @returns {Promise<void>}
 */
async function setUsuarioActivo(uid, activo) {
  await updateDoc(doc(db, 'usuarios', uid), { activo: Boolean(activo) });
  await loadUsuarios();
}

/**
 * Elimina un usuario de Firestore y refresca tabla.
 * @param {string} uid
 * @returns {Promise<void>}
 */
async function deleteUsuario(uid) {
  const ok = window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.');
  if (!ok) return;
  await deleteDoc(doc(db, 'usuarios', uid));
  await loadUsuarios();
}

/**
 * Muestra un mensaje debajo del formulario.
 * @param {string} text
 * @param {'ok'|'err'|'warn'} kind
 * @returns {void}
 */
function setCreateMsg(text, kind) {
  const el = document.getElementById('createMsg');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('ok', 'err', 'warn', 'show');
  el.classList.add(kind, 'show');
}

/**
 * Maneja el alta de usuario.
 * Nota: `createUserWithEmailAndPassword` reemplaza la sesión actual.
 * En esta versión, luego de crear el usuario se cierra sesión y se solicita
 * al admin volver a iniciar sesión (flujo simple y honesto).
 *
 * @param {SubmitEvent} e
 * @returns {Promise<void>}
 */
async function onCreateUser(e) {
  e.preventDefault();
  setCreateMsg('', 'ok');

  const email = String(document.getElementById('newEmail')?.value || '').trim();
  const password = String(document.getElementById('newPassword')?.value || '');
  const rol = String(document.getElementById('newRol')?.value || '').trim();
  const empresa = String(document.getElementById('newEmpresa')?.value || '').trim();

  if (!email || !password || password.length < 6 || !rol || !empresa) {
    setCreateMsg('Completa todos los campos (contraseña mínimo 6 caracteres).', 'err');
    return;
  }

  const btn = document.getElementById('btnCreateUser');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creando…';
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user?.uid;
    if (!uid) throw new Error('No se obtuvo UID del usuario creado.');

    await setDoc(doc(db, 'usuarios', uid), {
      email,
      rol,
      empresa,
      activo: true,
      createdAt: serverTimestamp(),
    });

    // Limpieza visual
    document.getElementById('createUserForm')?.reset();
    await loadUsuarios();

    setCreateMsg('Usuario creado. Por seguridad se cerrará tu sesión: vuelve a iniciar sesión.', 'warn');

    // Cierra sesión (quedó logueado el usuario nuevo)
    try { await signOut(auth); } catch { /* noop */ }
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }

    // Da un momento para leer el mensaje y vuelve al login
    window.setTimeout(() => go('../index.html'), 900);
  } catch (err) {
    const msg = String(err?.message || '');
    setCreateMsg(msg || 'Error al crear el usuario.', 'err');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Crear usuario';
    }
  }
}

/**
 * Bindea eventos de la tabla (delegación).
 * @returns {void}
 */
function bindTableActions() {
  const table = document.getElementById('usersTable');
  if (!table) return;

  table.addEventListener('click', async (e) => {
    const btn = e.target?.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const uid = btn.getAttribute('data-id');
    if (!action || !uid) return;

    btn.disabled = true;
    try {
      if (action === 'deactivate') await setUsuarioActivo(uid, false);
      if (action === 'activate') await setUsuarioActivo(uid, true);
      if (action === 'delete') await deleteUsuario(uid);
    } catch (err) {
      alert('Error: ' + String(err?.message || err));
    } finally {
      btn.disabled = false;
    }
  });
}

/**
 * Bindea logout.
 * @returns {void}
 */
function bindLogout() {
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    try { await signOut(auth); } catch { /* noop */ }
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
    go('../index.html');
  });
}

// ===========================
// BOOT
// ===========================
const perfil = requireAdminSession();
hydrateHeader(perfil);
bindLogout();
bindTableActions();
document.getElementById('createUserForm')?.addEventListener('submit', onCreateUser);
document.getElementById('btnRefreshUsers')?.addEventListener('click', loadUsuarios);
loadUsuarios();

