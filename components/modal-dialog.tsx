"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { trapTabKey } from "@/lib/ui/focus-trap";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  /** Extra class on the panel (e.g. wider create form). */
  panelClassName?: string;
};

/**
 * Modal dialog shell: body portal, backdrop, aria-modal, focus trap, Escape,
 * scroll lock, inert background, restore focus to the opener.
 */
export function ModalDialog({
  open,
  title,
  description,
  busy = false,
  initialFocusRef,
  onClose,
  children,
  panelClassName,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const inerted: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child === backdropRef.current) continue;
      if (child.hasAttribute("data-caregap-dialog-root")) continue;
      child.inert = true;
      inerted.push(child);
    }

    const id = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>(
          "input:not([disabled]), button:not([disabled]), [href], textarea:not([disabled])",
        ) ??
        panelRef.current;
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = overflow;
      for (const el of inerted) {
        el.inert = false;
      }
      restoreRef.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === "undefined") return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onClose();
      return;
    }
    if (panelRef.current) trapTabKey(event, panelRef.current);
  }

  function onBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (busy) return;
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div
      ref={backdropRef}
      className="dialog-backdrop"
      data-caregap-dialog-root=""
      onMouseDown={onBackdrop}
    >
      <div
        ref={panelRef}
        className={
          panelClassName ? `dialog-panel ${panelClassName}` : "dialog-panel"
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="dialog-panel__chrome">
          <h2 id={titleId} className="dialog-panel__title">
            {title}
          </h2>
          <button
            type="button"
            className="dialog-panel__close btn btn--ghost"
            aria-label="닫기"
            disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            ×
          </button>
        </div>
        {description ? (
          <p id={descId} className="dialog-panel__lede muted">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
