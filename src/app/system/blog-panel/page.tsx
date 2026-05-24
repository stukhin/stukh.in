import type { Metadata } from "next";
import styles from "./page.module.css";

/**
 * /system/blog-panel — internal design-system audit page for the
 * country notebook panel. Lists where the current panel deviates
 * from the rest of the site (typography, spacing, motion) and
 * shows before/after pairs rendered in real HTML so the
 * change-set can be approved by eye, not by spec.
 *
 * Noindex / nofollow / nosnippet — internal tool, not linked.
 */
export const metadata: Metadata = {
  title: "Country panel audit — stukh.in",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
    },
  },
};

type Severity = "high" | "med" | "low";

const TYPE_RAMP = [
  { px: 20, weight: 300, tracking: "-0.03em", use: "TopNav link" },
  { px: 18, weight: 300, tracking: "0", use: "Walls card title" },
  { px: 17, weight: 400, tracking: "-0.01em", use: "Walls modal title" },
  { px: 14, weight: 200, tracking: "0.02em", use: "Walls filter dropdown" },
  { px: 13, weight: 300, tracking: "0", use: "Body fallback" },
  { px: 12, weight: 300, tracking: "0.06em", use: "Caps small label" },
  { px: 11, weight: 300, tracking: "0.12em", use: "Caps spec line" },
  { px: 9, weight: 300, tracking: "0.08em", use: "Tiny caps" },
];

const EASINGS = [
  {
    token: "ease-glide",
    value: "cubic-bezier(0.65, 0, 0.25, 1)",
    use: "Big surfaces (Walls FLIP, GalleryModal backdrop, TopNav underline)",
  },
  {
    token: "ease-enter",
    value: "cubic-bezier(0.2, 0.7, 0.4, 1)",
    use: "Entrance scales (modals, letter-in animation)",
  },
];

const SPACING_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 66, 96];

type Proposal = {
  id: number;
  title: string;
  severity: Severity;
  rationale: string;
  before: React.ReactNode;
  after: React.ReactNode;
  beforeSpec: string;
  afterSpec: string;
};

export default function BlogPanelSystem() {
  const proposals: Proposal[] = [
    {
      id: 1,
      title: "Country name",
      severity: "high",
      rationale:
        "Currently the largest type on the entire site at 78px. Nothing else gets that big — TopNav peaks at 20px, the home page leans on imagery, not display type. Drop one step on the ramp + go to 300 weight and the panel stops feeling like a sub-app.",
      beforeSpec: "78px / weight 200 / -0.03em / capitalize",
      afterSpec: "44px / weight 300 / -0.02em / capitalize",
      before: <NameSample size={78} weight={200} tracking="-0.03em" />,
      after: <NameSample size={44} weight={300} tracking="-0.02em" />,
    },
    {
      id: 2,
      title: "Cover issue number (№ 06)",
      severity: "med",
      rationale:
        "Tracking is 0.24em uppercase — louder than anything else on the site (Walls .specs uses 0.06–0.12em). Drop tracking, switch to lowercase, take the weight down a notch.",
      beforeSpec: "11px / 0.24em / uppercase / weight 400",
      afterSpec: "12px / 0.06em / lowercase / weight 300",
      before: <KickerSample text="№ 06" px={11} tracking="0.24em" upper weight={400} />,
      after: <KickerSample text="№ 06" px={12} tracking="0.06em" weight={300} />,
    },
    {
      id: 3,
      title: "Spread kicker (TASTE MAP)",
      severity: "med",
      rationale:
        "Same problem as #2 — over-tracked uppercase. The rest of the site rarely uppercases; when it does (Walls .specs) it lands at 0.06em or 0.12em.",
      beforeSpec: "11px / 0.22em / uppercase / weight 400",
      afterSpec: "12px / 0.06em / lowercase / weight 300",
      before: <KickerSample text="TASTE MAP" px={11} tracking="0.22em" upper weight={400} />,
      after: <KickerSample text="taste map" px={12} tracking="0.06em" weight={300} />,
    },
    {
      id: 4,
      title: "Cover description",
      severity: "low",
      rationale:
        "Close to system already (15px / 300) but every body fragment on the site is 14px / 200. Aligning lets the panel inherit the same reading rhythm as a Walls card open-state.",
      beforeSpec: "15px / weight 300 / -0.005em",
      afterSpec: "14px / weight 200 / 0.02em",
      before: <DescSample size={15} weight={300} tracking="-0.005em" />,
      after: <DescSample size={14} weight={200} tracking="0.02em" />,
    },
    {
      id: 5,
      title: "Cities row",
      severity: "low",
      rationale:
        "Tiny + tracked — feels like a caption from a different design language. One step up + closer tracking matches the cardTitle scale and feels like part of the body, not a stamp.",
      beforeSpec: "12px / weight 400 / 0.04em / lowercase",
      afterSpec: "13px / weight 300 / -0.005em / lowercase",
      before: <CitiesSample size={12} weight={400} tracking="0.04em" />,
      after: <CitiesSample size={13} weight={300} tracking="-0.005em" />,
    },
    {
      id: 6,
      title: "Frames · spots counter",
      severity: "med",
      rationale:
        "Caps line at the bottom of the cover. 0.18em is too cosmetic; 0.12em is exactly the Walls .specs tracking — borrow it.",
      beforeSpec: "11px / 0.18em / uppercase / weight 500",
      afterSpec: "11px / 0.12em / uppercase / weight 300",
      before: <KickerSample text="0 FRAMES · 3 SPOTS" px={11} tracking="0.18em" upper weight={500} />,
      after: <KickerSample text="0 FRAMES · 3 SPOTS" px={11} tracking="0.12em" upper weight={300} />,
    },
    {
      id: 7,
      title: "Taste chip — name",
      severity: "high",
      rationale:
        "Weight 500 is heavier than ANY text anywhere else on the site (peak is 400 on Walls cardTitle / 400 on GalleryModal title). Drop to 300 and bump 1px so it still reads at a glance.",
      beforeSpec: "13px / weight 500 / -0.005em",
      afterSpec: "14px / weight 300 / -0.005em",
      before: <ChipSample weight={500} size={13} />,
      after: <ChipSample weight={300} size={14} />,
    },
    {
      id: 8,
      title: "Taste chip — city subtitle",
      severity: "low",
      rationale: "Tracking too cosmetic for 9px caps. Walls .specs is 0.08em at 10px.",
      beforeSpec: "9px / 0.18em / uppercase / weight 400",
      afterSpec: "10px / 0.08em / uppercase / weight 300",
      before: <ChipSample weight={300} size={13} cityTracking="0.18em" citySize={9} />,
      after: <ChipSample weight={300} size={14} cityTracking="0.08em" citySize={10} />,
    },
    {
      id: 9,
      title: "Locked card — recommendation title",
      severity: "med",
      rationale: "Walls modal title is the spec — 17px / 400 / -0.01em.",
      beforeSpec: "20px / weight 400 / -0.015em",
      afterSpec: "17px / weight 400 / -0.01em",
      before: <LockedTitleSample size={20} weight={400} tracking="-0.015em" />,
      after: <LockedTitleSample size={17} weight={400} tracking="-0.01em" />,
    },
    {
      id: 10,
      title: "Visa stamp — calmer",
      severity: "med",
      rationale:
        "The stamp is a deliberate decoration but right now it's loud — 0.3em tracking + -6° rotation + dashed terracotta. Soften the tracking, halve the rotation, drop one px on the tag.",
      beforeSpec: "11px / 0.3em / uppercase + -6° + 1.5px dashed border",
      afterSpec: "9px / 0.12em / uppercase + -3° + 1px dashed border",
      before: <StampSample bold tag="VISITED" rot={-6} />,
      after: <StampSample tag="VISITED" rot={-3} />,
    },
    {
      id: 11,
      title: "Panel slide-in easing",
      severity: "high",
      rationale:
        "Currently cubic-bezier(0.5, 0, 0.4, 1) — close, but not the canonical site curve. Walls FLIP, GalleryModal, TopNav all use cubic-bezier(0.65, 0, 0.25, 1). Aligning means the panel arrives with the same rhythm as every other big surface.",
      beforeSpec: "0.6s · cubic-bezier(0.5, 0, 0.4, 1)",
      afterSpec: "0.7s · cubic-bezier(0.65, 0, 0.25, 1)",
      before: <EasingSample duration="0.6s" curve="cubic-bezier(0.5, 0, 0.4, 1)" />,
      after: <EasingSample duration="0.7s" curve="cubic-bezier(0.65, 0, 0.25, 1)" />,
    },
    {
      id: 12,
      title: "Chip hover transition",
      severity: "low",
      rationale:
        "Spring (motion stiffness 320 / damping 28) feels different from every other hover on the site (all CSS transitions with ease-glide). Switch to plain transition.",
      beforeSpec: "spring (stiffness 320 / damping 28)",
      afterSpec: "0.3s · cubic-bezier(0.65, 0, 0.25, 1)",
      before: <span className={styles.note}>(spring — see live panel)</span>,
      after: <span className={styles.note}>(plain ease-glide — see proposal)</span>,
    },
    {
      id: 13,
      title: "Em-dash empty quadrant",
      severity: "low",
      rationale:
        "The “—” placeholders in empty quadrants are a custom invention — nothing similar exists elsewhere. The corner labels already anchor the geometry; let empty space speak.",
      beforeSpec: '"—" centred in each empty quadrant',
      afterSpec: "remove placeholder, keep corner label only",
      before: <span className={styles.dashSample}>—</span>,
      after: <span className={styles.note}>(nothing, by design)</span>,
    },
  ];

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.h1}>Country panel — system audit</h1>
        <p className={styles.lede}>
          Where the /blog country notebook drifts from the rest of the site.
          Each row is a real DOM render of the current spec vs the proposed
          one. Approve by number — I'll apply the change-set in one pass and
          leave the unapproved items as-is.
        </p>
      </header>

      <Section title="What the site actually uses">
        <div className={styles.col2}>
          <div>
            <h3 className={styles.h3}>Type ramp</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>px</th>
                  <th>weight</th>
                  <th>tracking</th>
                  <th>where</th>
                </tr>
              </thead>
              <tbody>
                {TYPE_RAMP.map((t) => (
                  <tr key={t.px + t.use}>
                    <td>{t.px}</td>
                    <td>{t.weight}</td>
                    <td>{t.tracking}</td>
                    <td>{t.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className={styles.h3}>Easings + spacing</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>name</th>
                  <th>value</th>
                  <th>where</th>
                </tr>
              </thead>
              <tbody>
                {EASINGS.map((e) => (
                  <tr key={e.token}>
                    <td>{e.token}</td>
                    <td>{e.value}</td>
                    <td>{e.use}</td>
                  </tr>
                ))}
                <tr>
                  <td>spacing</td>
                  <td>{SPACING_SCALE.join(" · ")}</td>
                  <td>px multiples; 16/20/32/48 most common</td>
                </tr>
                <tr>
                  <td>hairline</td>
                  <td>1px hsla(0,0%,?,0.08)</td>
                  <td>dark surfaces ·08 / cream surfaces ·08</td>
                </tr>
                <tr>
                  <td>case</td>
                  <td>lowercase</td>
                  <td>everything except country name (capitalize) + caps spec lines</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="Proposed change-set">
        <p className={styles.lede}>
          {proposals.length} proposals. Severity = how off-system the current
          state reads.
        </p>
        <div className={styles.proposals}>
          {proposals.map((p) => (
            <article key={p.id} className={styles.proposal}>
              <header className={styles.proposalHead}>
                <span className={styles.proposalNum}>{p.id.toString().padStart(2, "0")}</span>
                <span className={styles.proposalTitle}>{p.title}</span>
                <span
                  className={`${styles.sev} ${
                    p.severity === "high"
                      ? styles.sevHigh
                      : p.severity === "med"
                      ? styles.sevMed
                      : styles.sevLow
                  }`}
                >
                  {p.severity}
                </span>
              </header>

              <div className={styles.pairGrid}>
                <div className={styles.pair}>
                  <span className={styles.pairLabel}>before</span>
                  <div className={styles.pairFrame}>{p.before}</div>
                  <span className={styles.pairSpec}>{p.beforeSpec}</span>
                </div>
                <div className={styles.pair}>
                  <span className={styles.pairLabel}>after</span>
                  <div className={styles.pairFrame}>{p.after}</div>
                  <span className={styles.pairSpec}>{p.afterSpec}</span>
                </div>
              </div>

              <p className={styles.proposalRationale}>{p.rationale}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="How to approve">
        <p className={styles.lede}>
          Reply with the numbers you accept (e.g. “1, 2, 3, 6, 7, 10” or
          “all except 13”). I'll apply the change-set, build, push to main.
          Anything not approved stays as it is.
        </p>
      </Section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Section + sample components                                        */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

function NameSample({
  size,
  weight,
  tracking,
}: {
  size: number;
  weight: number;
  tracking: string;
}) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking,
        textTransform: "capitalize",
        lineHeight: 0.95,
        color: "#1a1a1a",
        fontFamily: "Rubik, Inter, sans-serif",
      }}
    >
      spain
    </div>
  );
}

function KickerSample({
  text,
  px,
  tracking,
  weight,
  upper = false,
}: {
  text: string;
  px: number;
  tracking: string;
  weight: number;
  upper?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: px,
        fontWeight: weight,
        letterSpacing: tracking,
        textTransform: upper ? "uppercase" : "lowercase",
        color: "#1a1a1a",
        opacity: 0.55,
        fontFamily: "Rubik, Inter, sans-serif",
      }}
    >
      {text}
    </span>
  );
}

function DescSample({
  size,
  weight,
  tracking,
}: {
  size: number;
  weight: number;
  tracking: string;
}) {
  return (
    <p
      style={{
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking,
        lineHeight: 1.55,
        color: "#1a1a1a",
        opacity: 0.82,
        margin: 0,
        maxWidth: "40ch",
        fontFamily: "Rubik, Inter, sans-serif",
      }}
    >
      coastal walks along the costa brava, sant pere de rodes monastery at sunset.
    </p>
  );
}

function CitiesSample({
  size,
  weight,
  tracking,
}: {
  size: number;
  weight: number;
  tracking: string;
}) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking,
        textTransform: "lowercase",
        opacity: 0.7,
        color: "#1a1a1a",
        fontFamily: "Rubik, Inter, sans-serif",
      }}
    >
      barcelona <span style={{ opacity: 0.45, margin: "0 8px" }}>·</span> girona
      <span style={{ opacity: 0.45, margin: "0 8px" }}>·</span> valencia
    </div>
  );
}

function ChipSample({
  size,
  weight,
  cityTracking = "0.18em",
  citySize = 9,
}: {
  size: number;
  weight: number;
  cityTracking?: string;
  citySize?: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 14px 11px",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderLeft: "3px solid #4a6b3e",
        borderRadius: 2,
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        fontFamily: "Rubik, Inter, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <span
        style={{
          fontSize: size,
          fontWeight: weight,
          letterSpacing: "-0.005em",
          lineHeight: 1.3,
        }}
      >
        sant pere de rodes
      </span>
      <span
        style={{
          fontSize: citySize,
          fontWeight: 400,
          letterSpacing: cityTracking,
          textTransform: "uppercase",
          opacity: 0.5,
        }}
      >
        girona
      </span>
    </div>
  );
}

function LockedTitleSample({
  size,
  weight,
  tracking,
}: {
  size: number;
  weight: number;
  tracking: string;
}) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking,
        lineHeight: 1.2,
        color: "#1a1a1a",
        fontFamily: "Rubik, Inter, sans-serif",
      }}
    >
      sant pere de rodes
    </div>
  );
}

function StampSample({
  tag,
  rot,
  bold,
}: {
  tag: string;
  rot: number;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "10px 16px",
        border: `${bold ? 1.5 : 1}px dashed rgba(193, 74, 58, 0.7)`,
        borderRadius: 3,
        transform: `rotate(${rot}deg)`,
        color: "rgba(193, 74, 58, 0.85)",
        background: "rgba(245, 244, 241, 0.85)",
        fontFamily: "Rubik, Inter, sans-serif",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        may 2017
      </span>
      <span
        style={{
          width: 28,
          height: 1,
          background: "rgba(193, 74, 58, 0.55)",
        }}
      />
      <span
        style={{
          fontSize: bold ? 11 : 9,
          letterSpacing: bold ? "0.3em" : "0.12em",
          textTransform: "uppercase",
        }}
      >
        {tag}
      </span>
    </div>
  );
}

function EasingSample({ duration, curve }: { duration: string; curve: string }) {
  return (
    <div className={styles.easingSample}>
      <div
        className={styles.easingDot}
        style={{ animationDuration: duration, animationTimingFunction: curve }}
      />
      <span className={styles.easingLabel}>
        {duration} · {curve}
      </span>
    </div>
  );
}
