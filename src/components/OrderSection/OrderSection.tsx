import Prints from "../Prints/Prints";
import OrderLink from "../OrderLink/OrderLink";
import styles from "./OrderSection.module.css";

type Props = {
  id: string;
  text: React.ReactNode;
  linkHref: string;
  linkLabel: string;
  images: { front: string; left: string; right: string };
  reverse?: boolean;
};

export default function OrderSection({
  id,
  text,
  linkHref,
  linkLabel,
  images,
  reverse = false,
}: Props) {
  return (
    <section
      id={id}
      className={`${styles.orderSection} ${reverse ? styles.reverse : ""}`}
    >
      <Prints {...images} reverse={reverse} />
      <div className={styles.content}>
        <div className={styles.text}>{text}</div>
        <div className={styles.link}>
          <OrderLink href={linkHref} external small>
            {linkLabel}
          </OrderLink>
        </div>
      </div>
    </section>
  );
}
