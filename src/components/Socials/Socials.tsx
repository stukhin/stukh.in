import styles from "./Socials.module.css";

type Props = {
  className?: string;
};

export default function Socials({ className = "" }: Props) {
  return (
    <ul className={`${styles.socials} ${className}`}>
      <li className={styles.link}>
        <a aria-label="Telegram" target="_blank" rel="noreferrer" href="https://t.me/avstkhn">
          <span className={`${styles.icon} ${styles.tg}`} />
          <span className={styles.underline} />
        </a>
      </li>
      <li className={styles.link}>
        <a aria-label="Instagram" target="_blank" rel="noreferrer" href="https://instagram.com/stukhin">
          <span className={`${styles.icon} ${styles.inst}`} />
          <span className={styles.underline} />
        </a>
      </li>
    </ul>
  );
}
