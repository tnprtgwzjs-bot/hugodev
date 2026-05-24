const API = location.origin;
const qs = s => document.querySelector(s);

async function post(path, body){
  const res = await fetch(API + path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  return res.json();
}

function showMessage(message, error=false){
  const msg = qs('#login-msg');
  if(msg){
    msg.textContent = message;
    msg.style.color = error ? '#ff8b8b' : '#a8d0ff';
  }
}

async function handleLogin(e){
  e.preventDefault();
  const user = qs('#login-username').value.trim();
  const pass = qs('#login-password').value;
  if(!user || !pass){
    showMessage('Introduce usuario y contraseña', true);
    return;
  }
  showMessage('Conectando...');
  const remember = qs('#remember-me').checked;
  const r = await post('/api/login',{username:user,password:pass});
  if(r.token){
    if(remember) localStorage.setItem('auth_token', r.token);
    else sessionStorage.setItem('auth_token', r.token);
    if(r.mustChangePassword){
      const np = prompt('Es tu primer acceso. Introduce nueva contraseña (mín 6 caracteres):');
      if(np && np.length >= 6){
        const change = await post('/api/change-password',{password:np});
        if(change.ok){
          showMessage('Contraseña cambiada. Redirigiendo...');
          window.location.href = 'app.html';
          return;
        }
        showMessage(change.error || 'Error al cambiar contraseña', true);
      } else {
        showMessage('La contraseña debe tener al menos 6 caracteres', true);
      }
    } else {
      window.location.href = 'app.html';
    }
  } else {
    showMessage(r.error || 'Error de autenticación', true);
  }
}

window.addEventListener('load',()=>{
  const form = qs('#login-form');
  if(form) form.addEventListener('submit', handleLogin);
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if(token){
    window.location.href = 'app.html';
  }
});