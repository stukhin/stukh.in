import styles from "./Socials.module.css";

type Props = {
  className?: string;
};

export default function Socials({ className = "" }: Props) {
  return (
    <ul className={`${styles.socials} ${className}`}>
      <li className={`${styles.link} ${styles.tg}`}>
        <a aria-label="Telegram" target="_blank" rel="noreferrer" href="https://t.me/avstkhn">
          <span className={styles.underline} />
        </a>
      </li>
      <li className={`${styles.link} ${styles.inst}`}>
        <a aria-label="Instagram" target="_blank" rel="noreferrer" href="https://instagram.com/stukhin">
          <span className={styles.underline} />
        </a>
      </li>
    </ul>
  );
}
