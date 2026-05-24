"use client";

import { useCallback, useState } from "react";
import Modal from "./Modal";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};

type PendingState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      if (pending) {
        pending.resolve(value);
        setPending(null);
      }
    },
    [pending]
  );

  const confirmButtonClass =
    pending?.variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "bg-purple-600 hover:bg-purple-700 text-white";

  const dialog = (
    <Modal
      open={Boolean(pending)}
      onClose={() => close(false)}
      title={pending?.title ?? "Are you sure?"}
      maxWidth="max-w-sm"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600">{pending?.message ?? ""}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {pending?.cancelText ?? "No"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmButtonClass}`}
          >
            {pending?.confirmText ?? "Yes"}
          </button>
        </div>
      </div>
    </Modal>
  );

  return { confirm, dialog };
}
