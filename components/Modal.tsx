"use client";

import * as Dialog from "@radix-ui/react-dialog";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed left-1/2 top-1/2 z-[9999] w-[calc(100%-1.5rem)] sm:w-full ${maxWidth} -translate-x-1/2 -translate-y-1/2 focus:outline-none`}
        >
          <div className="max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl animate-[modalIn_0.2s_ease-out]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 sm:px-6 sm:py-4">
              <Dialog.Title className="text-lg font-semibold text-slate-800">{title}</Dialog.Title>
              <Dialog.Close className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
            <div className="max-h-[calc(100dvh-6.5rem)] overflow-y-auto px-4 py-4 sm:max-h-[70vh] sm:px-6 sm:py-5">
              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
