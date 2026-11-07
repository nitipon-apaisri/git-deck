import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Same look as `TextInput`, for text that runs over several lines. */
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-21 min-w-0 resize-y rounded-md border border-(--border-strong) bg-secondary px-3 py-2 text-[13px] leading-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...rest}
    />
  )
}
