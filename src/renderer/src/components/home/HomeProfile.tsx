import { useMemo, useState } from 'react'
import type { Account, ProfileInfo, Repo } from '@shared/types'
import { heatCells, heatTip, monthLabels } from '../../lib/profileView'
import { timeAgo } from '../../lib/format'
import { hostTileOf } from '../../lib/presets'
import { readStored, writeStored } from '../../state/storage'
import { readCollapsed, toggleCollapsed } from '../../state/collapsed'
import { useProfile } from '../../state/profileData'
import { useNow } from '../../state/useNow'
import { Avatar, Button, ErrorBanner, HostTile, Icon, Skeleton, StatCard } from '../ui'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

const ACCOUNT_KEY = 'gitdeck.homeAccount'
const HEAT = ['bg-(--hover)', 'bg-(--heat-1)', 'bg-(--heat-2)', 'bg-(--heat-3)', 'bg-(--heat-4)']

interface HomeProfileProps {
  accounts: Account[]
  /** Loaded repositories by account, to open a profile repo that is in the sidebar. */
  reposByAccount: Record<string, Repo[]>
  onOpenRepo: (repoKey: string) => void
  onConnect: () => void
}

/** The Home screen: one account at a time, with a switcher. Needs no repository. */
export function HomeProfile({ accounts, reposByAccount, onOpenRepo, onConnect }: HomeProfileProps) {
  const [picked, setPicked] = useState(() => readStored(ACCOUNT_KEY))
  const account = accounts.find((a) => a.id === picked) ?? accounts[0] ?? null
  const { profile, loading, error, reload } = useProfile(account?.id ?? null)

  if (!account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <h2 className="m-0 text-[15px] leading-5.5 font-semibold">Home needs an account</h2>
        <p className="m-0 mb-2 text-muted-foreground">
          Connect GitHub or GitLab to see your profile, repositories and activity here.
        </p>
        <Button variant="primary" onClick={onConnect}>
          Add an account
        </Button>
      </div>
    )
  }

  function pick(id: string): void {
    setPicked(id)
    writeStored(ACCOUNT_KEY, id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
      {accounts.length > 1 ? (
        <div role="group" aria-label="Account" className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const { tile, host } = hostTileOf(a.type, a.baseUrl)
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={a.id === account.id}
                onClick={() => pick(a.id)}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-(--border-strong) bg-transparent px-3 text-foreground hover:bg-accent aria-pressed:border-transparent aria-pressed:bg-(--selection)"
              >
                <HostTile tile={tile} host={host} brand={a.type} />
                {a.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? (
        <ErrorBanner onRetry={reload}>Could not load this profile: {error}</ErrorBanner>
      ) : null}
      {profile ? (
        <ProfileBody
          account={account}
          profile={profile}
          repos={reposByAccount[account.id] ?? []}
          onOpenRepo={onOpenRepo}
        />
      ) : loading ? (
        <ProfileSkeleton />
      ) : null}
    </div>
  )
}

function ProfileBody({
  account,
  profile,
  repos,
  onOpenRepo
}: {
  account: Account
  profile: ProfileInfo
  repos: Repo[]
  onOpenRepo: (repoKey: string) => void
}) {
  const now = useNow()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = (key: string): void => setCollapsed(toggleCollapsed(key))
  const cells = useMemo(() => (profile.heatmap ? heatCells(profile.heatmap.days) : []), [profile])
  const months = useMemo(() => monthLabels(cells), [cells])
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const noun = profile.heatmap?.source === 'events' ? 'event' : 'contribution'
  const byFullName = useMemo(() => new Map(repos.map((r) => [r.fullName, r.key])), [repos])
  const ago = (iso: string): string => {
    const t = Date.parse(iso)
    return Number.isNaN(t) ? '' : timeAgo(t, now)
  }
  const name = profile.name || profile.username

  return (
    <>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar src={profile.avatarUrl || undefined} name={name} size={56} />
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
          <h1 className="m-0 text-[22px] leading-7 font-semibold">{name}</h1>
          <div className="font-mono text-[12px] leading-4 text-muted-foreground">
            @{profile.username} · {account.label}
          </div>
          {profile.bio ? <p className="m-0 max-w-140">{profile.bio}</p> : null}
          <div className="mt-1 flex gap-4 text-muted-foreground">
            <span>
              <b className="font-semibold text-foreground">{profile.followers ?? 'Unavailable'}</b>{' '}
              followers
            </span>
            <span>
              <b className="font-semibold text-foreground">{profile.following ?? 'Unavailable'}</b>{' '}
              following
            </span>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Organizations">
          {profile.orgs.map((o) => (
            <li
              key={o.name}
              className="flex h-7 items-center gap-1.5 rounded-sm bg-(--island-raised) px-2.5"
            >
              <Avatar src={o.avatarUrl || undefined} name={o.name} size={24} />
              {o.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={profile.orgs.length} label="Organizations" />
        <StatCard
          value={profile.heatmap ? profile.heatmap.total : null}
          label={
            profile.heatmap?.source === 'events' ? 'Events, 12 months' : 'Contributions, 12 months'
          }
        />
        <StatCard value={profile.events.length} label="Recent events" />
      </div>

      <section
        aria-label="Contributions"
        className="flex flex-col gap-3 rounded-xl bg-(--island-raised) p-4"
      >
        <h2 className="m-0 text-[15px] leading-5.5 font-semibold">
          Contributions
          {profile.heatmap?.source === 'events' ? (
            <span className="ml-2 text-[12px] leading-4 font-normal text-muted-foreground">
              Counted from events
            </span>
          ) : null}
        </h2>
        {profile.heatmap ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex w-max gap-2">
              <div
                aria-hidden="true"
                className="grid grid-rows-[11px_repeat(7,11px)] gap-0.75 pr-1 text-[10px] leading-2.75 text-muted-foreground"
              >
                <span />
                <span />
                <span>Mon</span>
                <span />
                <span>Wed</span>
                <span />
                <span>Fri</span>
                <span />
              </div>
              <div className="flex flex-col gap-0.75">
                <div
                  aria-hidden="true"
                  className="grid h-2.75 auto-cols-[11px] grid-flow-col gap-0.75 text-[10px] leading-2.75 text-muted-foreground"
                >
                  {months.map((m) => (
                    <span key={m.col} style={{ gridColumnStart: m.col + 1 }}>
                      {m.label}
                    </span>
                  ))}
                </div>
                <div
                  role="img"
                  aria-label={`${profile.heatmap.total} ${noun}s in the last 12 months`}
                  className="grid w-max auto-cols-[11px] grid-flow-col grid-rows-[repeat(7,11px)] gap-0.75"
                >
                  {cells.map((c, i) =>
                    c ? (
                      <div
                        key={c.date}
                        onMouseEnter={(e) => {
                          const r = e.currentTarget.getBoundingClientRect()
                          setTip({
                            text: heatTip(c.count, c.date, noun),
                            x: r.left + r.width / 2,
                            y: r.top
                          })
                        }}
                        onMouseLeave={() => setTip(null)}
                        className={cn('size-2.75 rounded-xs', HEAT[c.level])}
                      />
                    ) : (
                      <div key={`pad-${i}`} className="size-2.75" />
                    )
                  )}
                </div>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground"
            >
              Less
              {HEAT.map((h) => (
                <span key={h} className={cn('size-2.75 rounded-xs', h)} />
              ))}
              More
            </div>
            {tip ? (
              <div
                role="tooltip"
                style={{ left: tip.x, top: tip.y - 6 }}
                className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-(--island-raised) px-2 py-1 text-[12px] leading-4 whitespace-nowrap text-foreground shadow-(--shadow-menu)"
              >
                {tip.text}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-(--warning-bg) px-3 py-2 text-(--warning-text)">
            <Icon name="alert" size="sm" />
            Unavailable. The host did not return a contribution calendar or events.
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <Section
          id="home:repos"
          title={profile.repoKind === 'pinned' ? 'Pinned repositories' : 'Recent repositories'}
          collapsed={collapsed}
          onToggle={toggle}
          className="min-w-0 flex-[1_1_440px]"
        >
          {profile.repos.length === 0 ? (
            <p className="m-0 text-muted-foreground">No repositories to show.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {profile.repos.map((r) => {
                const key = byFullName.get(r.fullName)
                const body = (
                  <>
                    <span className="truncate font-medium">{r.fullName}</span>
                    <span className="text-[12px] leading-4 text-muted-foreground">
                      {r.description || 'No description'}
                    </span>
                    <span className="flex gap-2 text-[12px] leading-4 text-muted-foreground">
                      {r.language ? <span>{r.language}</span> : null}
                      <span className="flex-1" />
                      <span>{ago(r.updatedAt)}</span>
                    </span>
                  </>
                )
                const cls =
                  'flex min-w-0 flex-col gap-1 rounded-md border border-(--border-strong) p-3 text-left'
                return key ? (
                  <button
                    key={r.fullName}
                    type="button"
                    className={cn(
                      cls,
                      'cursor-pointer bg-transparent text-foreground hover:bg-accent'
                    )}
                    onClick={() => onOpenRepo(key)}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={r.fullName} className={cls} title="Not in your repository list">
                    {body}
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <Section
          id="home:activity"
          title="Recent activity"
          collapsed={collapsed}
          onToggle={toggle}
          className="min-w-0 flex-[1_1_360px]"
        >
          {profile.events.length === 0 ? (
            <p className="m-0 text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {profile.events.map((e, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-(--hover)"
                >
                  <span className="min-w-0 flex-1 truncate">{e.text}</span>
                  <span className="flex-none text-[12px] leading-4 text-muted-foreground">
                    {ago(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="m-0 text-[12px] leading-4 text-muted-foreground">
        Profile data is read with your account token, which stays encrypted in your OS keychain.
      </p>
    </>
  )
}

function Section({
  id,
  title,
  collapsed,
  onToggle,
  className,
  children
}: {
  id: string
  title: string
  collapsed: Set<string>
  onToggle: (id: string) => void
  className?: string
  children: ReactNode
}) {
  const open = !collapsed.has(id)
  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label={title}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(id)}
        className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[15px] leading-5.5 font-semibold text-foreground"
      >
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size="sm" />
        {title}
      </button>
      {open ? children : null}
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <Skeleton circle width={32} height={32} label="Loading profile" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton width={180} height={22} />
          <Skeleton width={260} />
        </div>
      </div>
      <Skeleton height={96} />
      <Skeleton height={140} />
    </div>
  )
}
