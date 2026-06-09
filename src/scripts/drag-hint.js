// drag-hint.js — overlay that tells the user a canvas is grabbable.
// Shows an animated orbit glyph + "drag to rotate" label; fades out after the
// user actually drags (and re-fades in if they never interact for a while).

export function attachDragHint(container, canvas, label = 'drag to rotate') {
  const hint = document.createElement('div');
  hint.className = 'drag-hint';
  hint.innerHTML = `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="19" ry="8" fill="none" stroke="currentColor"
               stroke-width="1.6" stroke-dasharray="4 3" opacity="0.8"/>
      <circle cx="24" cy="24" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M40 18 l4 -2 l-1 4.4" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 30 l-4 2 l1 -4.4" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>${label}</span>`;
  container.appendChild(hint);

  const dismiss = () => {
    hint.classList.add('seen');
    canvas.removeEventListener('pointerdown', dismiss);
  };
  canvas.addEventListener('pointerdown', dismiss);
  return hint;
}
