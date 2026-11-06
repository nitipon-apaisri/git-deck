import githubDark from '../../assets/logos/github-dark.svg'
import githubLight from '../../assets/logos/github-light.svg'
import gitlab from '../../assets/logos/gitlab.svg'

const LOGO = 'size-4 flex-none'

/** Logos from svgl.app. GitHub ships a dark and a light mark; the theme picks one. */
export function BrandLogo({ brand }: { brand: 'github' | 'gitlab' }) {
  if (brand === 'gitlab') {
    return <img className={LOGO} src={gitlab} alt="" aria-hidden="true" />
  }
  return (
    <>
      <img className={`${LOGO} dark:hidden`} src={githubLight} alt="" aria-hidden="true" />
      <img className={`${LOGO} hidden dark:inline`} src={githubDark} alt="" aria-hidden="true" />
    </>
  )
}
