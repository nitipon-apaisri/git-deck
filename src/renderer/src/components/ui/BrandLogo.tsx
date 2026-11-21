import githubDark from '../../assets/logos/github-dark.svg'
import githubLight from '../../assets/logos/github-light.svg'
import gitlab from '../../assets/logos/gitlab.svg'

const LOGO = 'size-4 flex-none'

/** Logos from svgl.app. GitHub ships a dark and a light mark; the theme picks one. */
export function BrandLogo({
  brand,
  className = LOGO
}: {
  brand: 'github' | 'gitlab'
  className?: string
}) {
  if (brand === 'gitlab') {
    return <img className={className} src={gitlab} alt="" aria-hidden="true" />
  }
  return (
    <>
      <img className={`${className} dark:hidden`} src={githubLight} alt="" aria-hidden="true" />
      <img
        className={`${className} hidden dark:inline`}
        src={githubDark}
        alt=""
        aria-hidden="true"
      />
    </>
  )
}
