// Lightweight ESC handler to close modal overlays across the app.
// It tries a few non-invasive strategies in order of safety:
// 1. Click the topmost `.modal-overlay` (many components close when overlay is clicked)
// 2. Click a `.close-modal` button inside the topmost modal
// 3. Click any element with `[data-close-on-esc]`

function isVisible(el: Element) {
  if (!(el instanceof HTMLElement)) return false;
  return !!(el.offsetParent !== null || getComputedStyle(el).visibility !== 'hidden');
}

function handleEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' && e.key !== 'Esc') return;

  try {
    // 1) Topmost modal-overlay
    const overlays = Array.from(document.querySelectorAll('.modal-overlay')) as HTMLElement[];
    const visibleOverlays = overlays.filter(isVisible);
    if (visibleOverlays.length > 0) {
      const top = visibleOverlays[visibleOverlays.length - 1];
      // If overlay has a close handler on click, this will trigger it.
      top.click();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 2) Topmost close button inside modal content
    const closeBtns = Array.from(document.querySelectorAll('.modal-contents-modality .close-modal, .modal-overlay .close-modal, .close-modal')) as HTMLElement[];
    const visibleClose = closeBtns.find(isVisible);
    if (visibleClose) {
      visibleClose.click();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 3) Generic data attribute target
    const dataClose = Array.from(document.querySelectorAll('[data-close-on-esc]')) as HTMLElement[];
    const visibleData = dataClose.find(isVisible);
    if (visibleData) {
      visibleData.click();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  } catch (err) {
    // Don't break the app if something unexpected happens
    // eslint-disable-next-line no-console
    console.warn('ESC handler error', err);
  }
}

export function initEscHandler() {
  // Avoid attaching multiple listeners
  if ((window as any).__escHandlerAttached) return;
  document.addEventListener('keydown', handleEscape, { capture: true });
  (window as any).__escHandlerAttached = true;
}

export default initEscHandler;
