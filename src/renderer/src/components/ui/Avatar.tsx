import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/cn'
import { avatarIndex, initialsOf } from '../../lib/format'

interface AvatarProps {
  /** Image URL. When it is missing or fails to load, coloured initials show instead. */
  src?: string
  name: string
  size?: 24 | 28 | 32
}

const SIZES = {
  24: 'size-6 text-[10px]',
  28: 'size-7 text-[11px]',
  32: 'size-8 text-[12px]'
} as const
const TONES = ['bg-(--avatar-1)', 'bg-(--avatar-2)', 'bg-(--avatar-3)', 'bg-(--avatar-4)'] as const

/** shadcn's avatar on Radix: the image, or coloured initials until it loads or when it fails. */
export function Avatar({ src, name, size = 28 }: AvatarProps) {
  const tone = TONES[Math.max(0, Math.min(3, Number(avatarIndex(name)) - 1))]
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-grid flex-none place-items-center overflow-hidden rounded-full font-semibold text-(--avatar-ink)',
        SIZES[size],
        tone
      )}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback aria-hidden="true">{initialsOf(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
