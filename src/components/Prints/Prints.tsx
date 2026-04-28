import styles from "./Prints.module.css";

type Props = {
  front: string;
  left: string;
  right: string;
  reverse?: boolean;
};

export default function Prints({ front, left, right, reverse = false }: Props) {
  return (
    <div className={`${styles.prints} ${reverse ? styles.reverse : ""}`}>
      <div className={`${styles.image} ${styles.front}`}>
        <img src={front} alt="" loading="lazy" />
      </div>
      <div className={`${styles.image} ${styles.left}`}>
        <img src={left} alt="" loading="lazy" />
      </div>
      <div className={`${styles.image} ${styles.right}`}>
        <img src={right} alt="" loading="lazy" />
      </div>
    </div>
  );
}
