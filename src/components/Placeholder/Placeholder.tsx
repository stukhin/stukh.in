import AppShell from "../AppShell/AppShell";
import styles from "./Placeholder.module.css";

type Props = {
  title: string;
  subtitle?: string;
};

export default function Placeholder({
  title,
  subtitle = "Coming soon",
}: Props) {
  return (
    <div className={styles.wrap}>
      <AppShell theme="dark" cursorVariant="light">
        <main className={styles.inner}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </main>
      </AppShell>
    </div>
  );
}
