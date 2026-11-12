// Read before styles are painted. Theme is a per-browser preference, separate from card data.
try {
  document.documentElement.dataset.theme = localStorage.getItem('vortex-theme') === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
