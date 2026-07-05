/* =============================================
   auth.js — Session management & login page
   ============================================= */

const Auth = (() => {
  const SESSION_KEY = 'ss_session';

  const getSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

  const setSession = user => {
    // store only id — fetch fresh user data when needed
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id }));
  };

  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const currentUser = () => {
    const s = getSession();
    return s ? DB.Users.find(s.id) : null;
  };

  // Redirect to login if not authenticated (call on protected pages)
  const requireAuth = () => {
    if (!currentUser()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  };

  // Redirect away from login if already authenticated
  const redirectIfAuthed = () => {
    if (currentUser()) window.location.href = 'index.html';
  };

  const logout = () => {
    clearSession();
    window.location.href = 'login.html';
  };

  return { getSession, setSession, clearSession, currentUser, requireAuth, redirectIfAuthed, logout };
})();

/* ──────────────────────────────────────────────
   Login page logic (only runs on login.html)
────────────────────────────────────────────── */
if (document.getElementById('loginForm')) {
  Auth.redirectIfAuthed();

  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.auth-form[data-tab="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Password visibility toggles
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon  = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye';
      }
    });
  });

  // Login submit
  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl    = document.getElementById('loginError');
    errEl.textContent = '';

    if (!username || !password) {
      errEl.textContent = 'Please fill in all fields.';
      return;
    }
    const result = DB.Users.authenticate(username, password);
    if (result.error) {
      errEl.textContent = result.error;
      return;
    }
    Auth.setSession(result.user);
    window.location.href = 'index.html';
  });

  // Register submit
  document.getElementById('registerForm').addEventListener('submit', e => {
    e.preventDefault();
    const displayName = document.getElementById('regDisplayName').value.trim();
    const username    = document.getElementById('regUsername').value.trim();
    const email       = document.getElementById('regEmail').value.trim();
    const bio         = document.getElementById('regBio').value.trim();
    const password    = document.getElementById('regPassword').value;
    const confirm     = document.getElementById('regConfirm').value;
    const errEl       = document.getElementById('registerError');
    errEl.textContent = '';

    if (!displayName || !username || !email || !password || !confirm) {
      errEl.textContent = 'Please fill in all required fields.';
      return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Please enter a valid email address.';
      return;
    }

    const result = DB.Users.create({ username, displayName, email, password, bio });
    if (result.error) {
      errEl.textContent = result.error;
      return;
    }
    Auth.setSession(result.user);
    window.location.href = 'index.html';
  });

  // Theme toggle on login page
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const saved = localStorage.getItem('ss_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.querySelector('i').className = saved === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ss_theme', next);
      themeToggle.querySelector('i').className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    });
  }
}
