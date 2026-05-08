import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ensureUsuarioSession } from './userSession.js';
import { getAjustes } from './ajustes.js';

onAuthStateChanged(auth, (user) => {
  if (!user) return window.location.href = '../index.html';
  ensureUsuarioSession(user).then(async () => {
    const ajustes = await getAjustes();
    document.getElementById('ajustesJson').textContent = JSON.stringify(ajustes, null, 2);
  }).catch(async () => {
    await signOut(auth);
    window.location.href = '../index.html';
  });
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});
