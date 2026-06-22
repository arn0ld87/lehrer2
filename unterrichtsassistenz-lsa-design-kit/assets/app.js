
const icon = (name) => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="M9 21v-7h6v7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    wand: '<path d="m15 4 5 5M4 20l10-10M5 5l2 2M3 9l2 2M13 19l2 2M17 17l2 2"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    alert: '<path d="M10.3 2.9 1.9 17a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    sparkles: '<path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z"/><path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
};

document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));

const sidebar = document.querySelector('.sidebar');
document.querySelectorAll('[data-menu-toggle]').forEach(btn => btn.addEventListener('click', () => sidebar.classList.toggle('open')));

document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
  const group = tab.closest('.tabs');
  group?.querySelectorAll('[data-tab]').forEach(x => x.classList.remove('active'));
  tab.classList.add('active');
}));

document.querySelectorAll('[data-toast]').forEach(btn => btn.addEventListener('click', () => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = btn.dataset.toast || 'Entwurf gespeichert.';
  Object.assign(toast.style, {
    position:'fixed', right:'20px', bottom:'20px', zIndex:'999', padding:'12px 14px',
    borderRadius:'12px', background:'#12162E', color:'#fff', fontWeight:'700',
    boxShadow:'0 16px 40px rgba(25,28,52,.22)', fontSize:'12px'
  });
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2400);
}));
