import githubDark from '../../assets/logos/github-dark.svg'
import githubLight from '../../assets/logos/github-light.svg'
import gitlab from '../../assets/logos/gitlab.svg'
import styles from './BrandLogo.module.css'

/** Logos from svgl.app. GitHub ships a dark and a light mark; the theme picks one. */
export function BrandLogo({ brand }: { brand: 'github' | 'gitlab' }) {
  if (brand === 'gitlab') {
    return <img className={styles.logo} src={gitlab} alt="" aria-hidden="true" />
  }
  return (
    <>
      <img
        className={`${styles.logo} ${styles.onLight}`}
        src={githubLight}
        alt=""
        aria-hidden="true"
      />
      <img
        className={`${styles.logo} ${styles.onDark}`}
        src={githubDark}
        alt=""
        aria-hidden="true"
      />
    </>
  )
}
