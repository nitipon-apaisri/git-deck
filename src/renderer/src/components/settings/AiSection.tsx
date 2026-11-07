import { setAiEnabled, useAiEnabled } from '../../state/ai'
import { CheckOption } from '../ui'

/** Opt-in for commit message suggestions from the user's own Claude Code CLI. */
export function AiSection() {
  const enabled = useAiEnabled()
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] leading-5 text-muted-foreground">
        Adds a sparkles button inside the commit message field. It suggests a message for the staged
        changes and fills the field. You edit it and commit as usual: nothing is committed for you.
      </p>
      <CheckOption
        label="Suggest commit messages with Claude Code"
        checked={enabled}
        onChange={setAiEnabled}
        warning={
          enabled
            ? undefined
            : 'The staged diff (first 60 KB) is sent to Claude through the Claude Code CLI installed on this computer. GitDeck stores no key: the CLI uses your own sign-in.'
        }
      />
      <p className="m-0 text-[12px] leading-4 text-muted-foreground">
        Needs the <code>claude</code> command installed and signed in. It only runs when you press
        the sparkles button.
      </p>
    </div>
  )
}
