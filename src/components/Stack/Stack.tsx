"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useState, useEffect, type ReactNode } from "react";
import styles from "./Stack.module.css";

/**
 * Stack — draggable card stack (React Bits).
 *
 * Each card sits in a perspective-deep 3D stack. The user can:
 *   · drag the top card past a sensitivity threshold to send it
 *     to the back (revealing the next card)
 *   · click to send to back (when `sendToBackOnClick` is on, or
 *     on touch when `mobileClickOnly` is on)
 *   · just let `autoplay` cycle through on a timer
 *
 * Ported from JS to TS for the codebase. Uses framer-motion drag
 * + spring layout transitions. CSS-module-scoped class names.
 */

type CardRotateProps = {
  children: ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
  disableDrag?: boolean;
};

function CardRotate({
  children,
  onSendToBack,
  sensitivity,
  disableDrag = false,
}: CardRotateProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (
      Math.abs(info.offset.x) > sensitivity ||
      Math.abs(info.offset.y) > sensitivity
    ) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  };

  if (disableDrag) {
    return (
      <motion.div
        className={styles.cardRotateDisabled}
        style={{ x: 0, y: 0 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={styles.cardRotate}
      style={{ x, y, rotateX, rotateY }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: "grabbing" }}
      onDragEnd={handleDragEnd}
    >
      {children}
    </motion.div>
  );
}

type AnimationConfig = {
  stiffness: number;
  damping: number;
};

type Props = {
  randomRotation?: boolean;
  sensitivity?: number;
  cards?: ReactNode[];
  animationConfig?: AnimationConfig;
  sendToBackOnClick?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  /** Touch users: disable drag, allow click only. */
  mobileClickOnly?: boolean;
  mobileBreakpoint?: number;
};

type StackItem = {
  id: number;
  content: ReactNode;
};

export default function Stack({
  randomRotation = false,
  sensitivity = 200,
  cards = [],
  animationConfig = { stiffness: 260, damping: 20 },
  sendToBackOnClick = false,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  mobileClickOnly = false,
  mobileBreakpoint = 768,
}: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mobileBreakpoint]);

  const shouldDisableDrag = mobileClickOnly && isMobile;
  const shouldEnableClick = sendToBackOnClick || shouldDisableDrag;

  const [stack, setStack] = useState<StackItem[]>(() =>
    cards.map((content, index) => ({ id: index + 1, content }))
  );

  useEffect(() => {
    setStack(cards.map((content, index) => ({ id: index + 1, content })));
  }, [cards]);

  const sendToBack = (id: number) => {
    setStack((prev) => {
      const next = [...prev];
      const idx = next.findIndex((card) => card.id === id);
      if (idx < 0) return prev;
      const [card] = next.splice(idx, 1);
      next.unshift(card);
      return next;
    });
  };

  useEffect(() => {
    if (autoplay && stack.length > 1 && !isPaused) {
      const interval = setInterval(() => {
        const topCardId = stack[stack.length - 1].id;
        sendToBack(topCardId);
      }, autoplayDelay);
      return () => clearInterval(interval);
    }
  }, [autoplay, autoplayDelay, stack, isPaused]);

  return (
    <div
      className={styles.stackContainer}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      {stack.map((card, index) => {
        const randomRotate = randomRotation ? Math.random() * 10 - 5 : 0;
        return (
          <CardRotate
            key={card.id}
            onSendToBack={() => sendToBack(card.id)}
            sensitivity={sensitivity}
            disableDrag={shouldDisableDrag}
          >
            <motion.div
              className={styles.card}
              onClick={() => shouldEnableClick && sendToBack(card.id)}
              animate={{
                rotateZ: (stack.length - index - 1) * 4 + randomRotate,
                scale: 1 + index * 0.06 - stack.length * 0.06,
                transformOrigin: "90% 90%",
              }}
              initial={false}
              transition={{
                type: "spring",
                stiffness: animationConfig.stiffness,
                damping: animationConfig.damping,
              }}
            >
              {card.content}
            </motion.div>
          </CardRotate>
        );
      })}
    </div>
  );
}
