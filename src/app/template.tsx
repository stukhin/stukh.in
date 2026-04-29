import styles from "./template.module.css";

/**
 * Re-mounts on every navigation. The CSS keyframes on `pageEnter` animate
 * each new page sliding in from below with an S-curve so the menu →
 * destination feels like scrolling down to the next block.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className={styles.pageEnter}>{children}</div>;
}
