import React, { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap, getFocusableElements } from './useFocusTrap';

function SingleModalHarness({
  initialOpen = false,
  withFocusableChildren = true,
  onCloseSpy,
}: {
  initialOpen?: boolean;
  withFocusableChildren?: boolean;
  onCloseSpy?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, {
    isOpen: open,
    onClose: () => {
      onCloseSpy?.();
      setOpen(false);
    },
  });

  return (
    <div>
      <main id="main-content" tabIndex={-1}>
        <button type="button" onClick={() => setOpen(true)}>
          Open Dialog
        </button>
      </main>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Sample modal">
          {withFocusableChildren ? (
            <>
              <button type="button">First Action</button>
              <input type="text" aria-label="Middle input" />
              <button type="button" onClick={() => setOpen(false)}>
                Close Action
              </button>
            </>
          ) : (
            <p>Static dialog content without buttons</p>
          )}
        </div>
      )}
    </div>
  );
}

function StackedModalHarness() {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(outerRef, {
    isOpen: outerOpen,
    onClose: () => setOuterOpen(false),
  });
  useFocusTrap(innerRef, {
    isOpen: innerOpen,
    onClose: () => setInnerOpen(false),
  });

  return (
    <div>
      <button type="button" onClick={() => setOuterOpen(true)}>
        Open Outer
      </button>
      {outerOpen && (
        <div ref={outerRef} role="dialog" aria-modal="true" aria-label="Outer dialog">
          <button type="button" onClick={() => setInnerOpen(true)}>
            Open Inner
          </button>
          <button type="button" onClick={() => setOuterOpen(false)}>
            Close Outer
          </button>
        </div>
      )}
      {innerOpen && (
        <div ref={innerRef} role="dialog" aria-modal="true" aria-label="Inner dialog">
          <button type="button">Inner First</button>
          <button type="button" onClick={() => setInnerOpen(false)}>
            Close Inner
          </button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves initial focus inside the modal, traps Tab and Shift+Tab, and restores focus to trigger on close', () => {
    render(<SingleModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);

    const firstBtn = screen.getByRole('button', { name: 'First Action' });
    const closeBtn = screen.getByRole('button', { name: 'Close Action' });

    // Initial focus moves inside dialog
    expect(firstBtn).toHaveFocus();

    // Shift+Tab from first wraps to last
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(closeBtn).toHaveFocus();

    // Tab from last wraps to first
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstBtn).toHaveFocus();

    // Closing restores focus to the triggering button
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes via Escape key and restores focus to trigger', () => {
    const onCloseSpy = vi.fn();
    render(<SingleModalHarness onCloseSpy={onCloseSpy} />);
    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('focuses the dialog container safely when no focusable children exist', () => {
    render(<SingleModalHarness withFocusableChildren={false} />);
    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();

    // Tab stays locked on the container rather than escaping
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog).toHaveFocus();
  });

  it('traps Tab and Escape only in the topmost modal when dialogs are stacked', () => {
    render(<StackedModalHarness />);
    const openOuter = screen.getByRole('button', { name: 'Open Outer' });
    openOuter.focus();
    fireEvent.click(openOuter);

    const openInner = screen.getByRole('button', { name: 'Open Inner' });
    expect(openInner).toHaveFocus();
    fireEvent.click(openInner);

    const innerFirst = screen.getByRole('button', { name: 'Inner First' });
    const closeInner = screen.getByRole('button', { name: 'Close Inner' });
    expect(innerFirst).toHaveFocus();

    // Tab wraps within inner dialog only
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(closeInner).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(innerFirst).toHaveFocus();

    // Escape closes inner dialog first and restores focus to Open Inner inside outer dialog
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Inner dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Outer dialog' })).toBeInTheDocument();
    expect(openInner).toHaveFocus();

    // Second Escape closes outer dialog and restores focus to Open Outer
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Outer dialog' })).not.toBeInTheDocument();
    expect(openOuter).toHaveFocus();
  });

  it('deduplicates named radio groups in getFocusableElements', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <input type="radio" name="plan" value="a" />
      <input type="radio" name="plan" value="b" checked />
      <input type="radio" name="plan" value="c" />
      <button type="button">Submit</button>
    `;
    document.body.appendChild(container);
    const focusables = getFocusableElements(container);
    expect(focusables).toHaveLength(2);
    expect((focusables[0] as HTMLInputElement).value).toBe('b');
    expect(focusables[1].textContent).toBe('Submit');
    container.remove();
  });

  it('excludes focusable descendants inside display:none ancestors', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button">Visible</button>
      <div style="display: none">
        <button type="button">Hidden In Ancestor</button>
      </div>
      <button type="button">Also Visible</button>
    `;
    document.body.appendChild(container);
    const focusables = getFocusableElements(container);
    expect(focusables.map((el) => el.textContent)).toEqual(['Visible', 'Also Visible']);
    container.remove();
  });
});
