"use client";

import { useRef, type ReactNode } from "react";
import { ModalDialog } from "@/components/modal-dialog";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "돌아가기",
  busy = false,
  tone = "primary",
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      open={open}
      title={title}
      busy={busy}
      onClose={() => {
        if (!busy) onCancel();
      }}
      initialFocusRef={cancelRef}
    >
      <div className="dialog-panel__body">{children}</div>
      <div className="dialog-panel__actions actions">
        <button
          ref={cancelRef}
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === "danger" ? "btn btn--danger" : "btn btn--primary"}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "처리 중…" : confirmLabel}
        </button>
      </div>
    </ModalDialog>
  );
}
