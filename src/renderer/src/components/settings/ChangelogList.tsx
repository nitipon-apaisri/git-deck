import { parseChangelog } from '@shared/changelog'
import changelog from '../../../../../CHANGELOG.md?raw'

// Bundled at build time, so it works offline. A test keeps the top entry equal to the app version.
const ENTRIES = parseChangelog(changelog)

/** What changed in each release, newest first. The newest is the installed version and starts open. */
export function ChangelogList() {
  return (
    <section className="flex flex-col gap-2" aria-label="Change log">
      <h3 className="m-0 text-[14px] leading-5 font-semibold">Change log</h3>
      {ENTRIES.map((entry, i) => (
        <details key={entry.version} open={i === 0} className="rounded-md bg-card px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-medium">
            {entry.version}
            {i === 0 ? (
              <span className="font-normal text-muted-foreground"> · installed</span>
            ) : null}
          </summary>
          {entry.sections.map((s) => (
            <div key={s.title} className="mt-2">
              <h4 className="m-0 text-[12px] leading-4.5 font-semibold text-muted-foreground">
                {s.title}
              </h4>
              <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-5">
                {s.items.map((item) => (
                  <li key={item} className="[overflow-wrap:anywhere]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      ))}
    </section>
  )
}
