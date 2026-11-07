import { useRef, useState, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

interface ModalProps {
  onClose: () => void
  className?: string
  /** Accessible name when the content has no `ModalTitle`. */
  label?: string
  children: ReactNode
}

/**
 * shadcn's dialog shell on Radix: focus trap, Escape, and focus back to the opener. Mount it to
 * open it, unmount it to close it, so the caller owns the open state. Clicking the backdrop does
 * not close it. A `[data-autofocus]` element inside gets focus first.
 */
export function Modal({ onClose, className, label, children }: ModalProps) {
  const content = useRef<HTMLDivElement>(null)
  // Radix only gives focus back to a `Trigger`; ours is opened by mounting, so remember the opener.
  const [opener] = useState(() => document.activeElement)
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-in fade-in-0 fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--window)_60%,transparent)] duration-(--motion-base)" />
        <DialogPrimitive.Content
          ref={content}
          aria-label={label}
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Not if something else took focus meanwhile, such as the next dialog.
            if (document.activeElement !== document.body) return
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
          }}
          onOpenAutoFocus={(event) => {
            const target = content.current?.querySelector<HTMLElement>('[data-autofocus]')
            target?.focus()
            // A hidden target cannot take focus; leave Radix to focus the first control instead.
            if (target && document.activeElement === target) event.preventDefault()
          }}
          className={cn(
            'animate-in fade-in-0 slide-in-from-bottom-2 fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100vh-48px)] w-130 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-(--radius-dialog) bg-card text-foreground shadow-(--shadow-dialog) duration-(--motion-base) ease-(--ease-out)',
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export const ModalTitle = DialogPrimitive.Title

interface DialogProps {
  title: string
  description?: string
  /** 520 for most dialogs, 560 for the project dialog, 960 for a diff. */
  width?: 520 | 560 | 960
  onClose: () => void
  children: ReactNode
  /** Test and secondary actions, left in the footer. */
  actionsStart?: ReactNode
  /** Cancel and the one primary action, right-aligned. */
  actions?: ReactNode
}

/** A titled dialog with a close button, a scrolling body and an optional action footer. */
export function Dialog({
  title,
  description,
  width = 520,
  onClose,
  children,
  actionsStart,
  actions
}: DialogProps) {
  return (
    <Modal
      onClose={onClose}
      className={width === 560 ? 'w-140' : width === 960 ? 'w-240' : undefined}
    >
      <header className="flex items-start gap-3 px-6 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <DialogPrimitive.Title className="m-0 text-[17px] leading-6 font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-muted-foreground m-0">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <IconButton label="Close" icon="x" onClick={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-1 pb-4">
        {children}
      </div>
      {actionsStart || actions ? (
        <footer className="border-border flex items-center gap-2.5 border-t px-6 py-3.5">
          {actionsStart}
          <span className="flex-1" />
          {actions}
        </footer>
      ) : null}
    </Modal>
  )
}
