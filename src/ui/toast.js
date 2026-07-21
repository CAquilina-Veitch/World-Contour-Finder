// Minimal, dependency-free toast/banner helper for friendly prompts (e.g.
// "add a token in Settings"). Dismissable; supports an optional action link.

const root = () => document.getElementById('toast-root');

export function showToast(message, { kind = 'info', linkText, linkHref, timeout } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  if (linkText && linkHref) {
    const a = document.createElement('a');
    a.href = linkHref;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = linkText;
    el.appendChild(a);
  }

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.onclick = () => el.remove();
  el.appendChild(close);

  root().appendChild(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return () => el.remove();
}
