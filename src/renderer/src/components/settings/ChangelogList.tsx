import { Fragment, useState } from 'react'
import { parseChangelog } from '@shared/changelog'
import changelog from '../../../../../CHANGELOG.md?raw'
import { Icon } from '../ui'

// Bundled at build time, so it works offline. A test keeps the top entry equal to the app version.
const ENTRIES = parseChangelog(changelog)

// The release page is the source of each entry: its notes, files and tag.
const RELEASE_URL = 'https://github.com/nitipon-apaisri/git-deck/releases/tag/v'

/** `code` between backticks, plain text elsewhere. */
function Inline({ text }: { text: string }) {
  return text.split('`').map((part, i) =>
    i % 2 ? (
      <code key={i} className="rounded-sm bg-muted px-1 font-mono text-[12px]">
        {part}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

/** One line per release, newest first. The newest (the installed version) starts open. */
export function ChangelogList() {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(ENTRIES.slice(0, 1).map((e) => e.version))
  )
  const toggle = (version: string): void =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(version)) next.add(version)
      return next
    })

  return (
    <section aria-label="Change log" className="flex flex-col">
      {ENTRIES.map((entry, i) => {
        const shown = open.has(entry.version)
        const panel = `changelog-${entry.version}`
        return (
          <div key={entry.version} className="border-t border-border py-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={panel}
                onClick={() => toggle(entry.version)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1 py-2 text-left text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-(--focus-ring)"
              >
                <Icon name={shown ? 'chevron-down' : 'chevron-right'} size="sm" />
                <span className="text-[14px] leading-5 font-semibold">{entry.version}</span>
                {i === 0 ? (
                  <span className="text-[12px] text-muted-foreground">Installed</span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`Open release ${entry.version} on GitHub`}
                onClick={() => void window.api.openExternal(RELEASE_URL + entry.version)}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-[12px] text-(--accent-text) hover:underline focus-visible:outline-2 focus-visible:outline-(--focus-ring)"
              >
                Release
                <Icon name="external" size="xs" />
              </button>
            </div>
            {shown ? (
              <div id={panel} className="flex flex-col gap-4 pt-1 pr-2 pb-4 pl-7">
                {entry.sections.map((s) => (
                  <div key={s.title}>
                    <h4 className="m-0 mb-1 text-[12px] leading-4.5 font-semibold text-muted-foreground">
                      {s.title}
                    </h4>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] leading-5">
                      {s.items.map((item) => (
                        <li
                          key={item}
                          className={`[overflow-wrap:anywhere] ${s.title === 'Known limits' ? 'text-muted-foreground' : ''}`}
                        >
                          <Inline text={item} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
