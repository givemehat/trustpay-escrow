'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Track open focus traps (oldest -> newest) so stacked modals (e.g. a lightbox
// opened inside a form modal) only trap Tab inside the topmost dialog.
const activeTrapStack: HTMLElement[] = [];

function isElementFocusable(el: HTMLElement, container?: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  if (el.tabIndex < 0) return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  if (el.closest('fieldset[disabled]') && !el.closest('legend:first-of-type')) return false;

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    // `display: none` is not inherited, so walk ancestors up to the trap container
    // to exclude focusable descendants inside hidden responsive wrappers.
    let parent = el.parentElement;
    while (parent && parent !== container) {
      if (window.getComputedStyle(parent).display === 'none') return false;
      parent = parent.parentElement;
    }
  }
  return true;
}

/**
 * Returns keyboard-tabbable elements within `container` in DOM order.
 * Safe in both real browsers and jsdom (does not rely on offsetParent/layout rects).
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => isElementFocusable(el, container)
  );

  // Deduplicate named radio groups to match native Tab behavior: only the checked
  // radio (or the first radio if none is checked) participates in the Tab sequence.
  const checkedRadios = new Map<string, HTMLInputElement>();
  const firstRadios = new Map<string, HTMLInputElement>();

  for (const el of candidates) {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      if (!firstRadios.has(el.name)) firstRadios.set(el.name, el);
      if (el.checked) checkedRadios.set(el.name, el);
    }
  }

  return candidates.filter((el) => {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const active = checkedRadios.get(el.name) ?? firstRadios.get(el.name);
      return el === active;
    }
    return true;
  });
}

function canRestoreFocus(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  return true;
}

export interface UseFocusTrapOptions {
  /** Whether the modal / trap is currently active. */
  isOpen: boolean;
  /** Optional Escape-to-close handler (uses the shared LIFO `useEscapeKey` stack). */
  onClose?: () => void;
  /** Element to focus first when opened; defaults to the first focusable descendant or container. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Explicit element to restore focus to when closed; defaults to `document.activeElement` before open. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Whether to restore focus to the trigger when closed (default: `true`). */
  restoreFocus?: boolean;
  /** Whether to move initial focus inside the container when opened (default: `true`). */
  autoFocus?: boolean;
}

/**
 * Traps Tab / Shift+Tab keyboard focus inside `containerRef` while `isOpen` is true,
 * coordinates Escape handling via `useEscapeKey`, and restores focus to the trigger
 * element when the modal closes.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  {
    isOpen,
    onClose,
    initialFocusRef,
    returnFocusRef,
    restoreFocus = true,
    autoFocus = true,
  }: UseFocusTrapOptions
) {
  const onCloseRef = useRef(onClose);
  const initialFocusRefHolder = useRef(initialFocusRef);
  const returnFocusRefHolder = useRef(returnFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRefHolder.current = initialFocusRef;
    returnFocusRefHolder.current = returnFocusRef;
  });

  useEscapeKey(() => {
    onCloseRef.current?.();
  }, Boolean(isOpen && onClose));

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const container = containerRef.current;
    if (!container) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }

    activeTrapStack.push(container);

    if (autoFocus) {
      const explicitTarget = initialFocusRefHolder.current?.current ?? null;
      if (explicitTarget && container.contains(explicitTarget) && isElementFocusable(explicitTarget, container)) {
        explicitTarget.focus({ preventScroll: true });
      } else {
        const focusables = getFocusableElements(container);
        if (focusables.length > 0) {
          focusables[0].focus({ preventScroll: true });
        } else {
          container.focus({ preventScroll: true });
        }
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (activeTrapStack[activeTrapStack.length - 1] !== container) return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !container.contains(active) || active === container) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const stackIdx = activeTrapStack.lastIndexOf(container);
      if (stackIdx !== -1) activeTrapStack.splice(stackIdx, 1);

      if (!restoreFocus) return;

      const activeNow = document.activeElement;
      const focusWasInsideOrLost =
        !activeNow || activeNow === document.body || container.contains(activeNow);

      if (!focusWasInsideOrLost) return;

      const explicitReturn = returnFocusRefHolder.current?.current ?? null;
      if (canRestoreFocus(explicitReturn)) {
        explicitReturn.focus({ preventScroll: true });
        return;
      }
      if (canRestoreFocus(previousFocus) && !container.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
        return;
      }
      const mainLandmark = document.getElementById('main-content');
      if (mainLandmark instanceof HTMLElement) {
        mainLandmark.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef, restoreFocus, autoFocus]);
}
