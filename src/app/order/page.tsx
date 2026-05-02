"use client";

import AppShell from "@/components/AppShell/AppShell";
import Parallax from "@/components/Parallax/Parallax";
import OrderMenu from "@/components/OrderMenu/OrderMenu";
import OrderSection from "@/components/OrderSection/OrderSection";
import ButtonUp from "@/components/ButtonUp/ButtonUp";
import styles from "./order.module.css";

export default function OrderPage() {
  return (
    <div className={styles.order}>
      <AppShell
        theme="dark"
        themeScrolled="light"
        cursorVariant="light"
        cursorVariantScrolled="dark"
        burgerBg="#B1B1B1"
        burgerLine="#424242"
        burgerClassName={styles.burger}
      >
        <header className={styles.header}>
          <Parallax />
          <OrderMenu />
        </header>

        <div className={styles.content}>
          <OrderSection
            id="prints"
            reverse
            text={
              <>
                Any of the&nbsp;presented photoworks can be ordered as
                a&nbsp;digital copy, separate print or to be framed.
              </>
            }
            linkHref="https://t.me/avstkhn"
            linkLabel="Contact me"
            images={{
              front: "/images/order/1.99a44e9a.webp",
              left: "/images/order/3.6e6340d3.webp",
              right: "/images/order/2.f6f903aa.webp",
            }}
          />

          <OrderSection
            id="shoots"
            text={
              <>
                I am happy to realise commercial orders related to artistic
                photography
              </>
            }
            linkHref="https://t.me/avstkhn"
            linkLabel="Book a shoot"
            images={{
              front: "/images/order/1.6760b656.webp",
              left: "/images/order/3.761fb74a.webp",
              right: "/images/order/2.3d9b099f.webp",
            }}
          />

          <OrderSection
            id="touch"
            reverse
            text={
              <>
                I&apos;ll share my knowledge, give a master class or take
                a&nbsp;photo tour with you.
              </>
            }
            linkHref="https://t.me/avstkhn"
            linkLabel="Keep in touch"
            images={{
              front: "/images/order/1.5cbd6d32.webp",
              left: "/images/order/3.e27a4f48.webp",
              right: "/images/order/2.45e91f47.webp",
            }}
          />
        </div>

        <ButtonUp className={styles.buttonUp} />
      </AppShell>
    </div>
  );
}
