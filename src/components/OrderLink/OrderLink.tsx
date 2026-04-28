import styles from "./OrderLink.module.css";

type Props = {
  href?: string;
  small?: boolean;
  children: React.ReactNode;
  external?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

export default function OrderLink({
  href,
  small = false,
  children,
  external = false,
  onClick,
}: Props) {
  const cls = `${styles.orderLink} ${small ? styles.small : ""}`;
  return (
    <div className={cls}>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          onClick={onClick}
        >
          {children}
        </a>
      ) : (
        <a role="button" onClick={onClick}>
          {children}
        </a>
      )}
    </div>
  );
}
