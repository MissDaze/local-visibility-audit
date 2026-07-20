// Shared header nav + auth guard for every authenticated page. Pages that
// require a login call requireAuthOrRedirect() first; it also renders the
// nav once the session check succeeds so the nav can't flash briefly for a
// user who then gets bounced to /login.html.
async function fetchMe() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  return res.json();
}

function renderNav(me, active) {
  const links = [
    { href: '/dashboard.html', label: 'Dashboard', key: 'dashboard' },
    { href: '/index.html', label: 'New Audit', key: 'audit' },
    { href: '/batch.html', label: 'Batch', key: 'batch' },
    { href: '/branding.html', label: 'Branding', key: 'branding' },
  ];

  const nav = document.createElement('header');
  nav.className = 'topnav';
  nav.innerHTML = `
    <div class="logo">📍</div>
    <div class="brand">Local Visibility Audit</div>
    <nav>
      ${links.map(l => `<a href="${l.href}"${l.key === active ? ' class="active"' : ''}>${l.label}</a>`).join('')}
    </nav>
    <div class="spacer"></div>
    <span class="nav-email">${me.email}</span>
    <button class="logout-btn" id="nav-logout-btn">Log out</button>
  `;
  document.body.prepend(nav);

  document.getElementById('nav-logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}

async function requireAuthOrRedirect(active) {
  const me = await fetchMe();
  if (!me || me.error) {
    window.location.href = '/login.html';
    return null;
  }
  renderNav(me, active);
  return me;
}
