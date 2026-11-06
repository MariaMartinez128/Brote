// Aplica el tema guardado (o el del sistema) antes de pintar la página para evitar el parpadeo
try {
  var t = localStorage.getItem('brote_theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
} catch (e) { /* sin almacenamiento */ }
