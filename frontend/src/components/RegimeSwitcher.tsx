"use client";
import { motion } from "framer-motion";
import { REGIME_LABELS } from "@/lib/api";

export default function RegimeSwitcher({ regime, setRegime }: { regime: string, setRegime: (v: string) => void }) {
  const options = Object.keys(REGIME_LABELS);
  return (
    <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.03)", padding: 6, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
      {options.map(r => {
        const active = regime === r;
        return (
          <button
            key={r}
            onClick={() => setRegime(r)}
            style={{
              position: "relative", padding: "8px 16px", fontSize: "0.8rem", fontWeight: active ? 600 : 500,
              color: active ? "var(--accent)" : "var(--text-3)", background: "transparent", border: "none",
              cursor: "pointer", outline: "none", transition: "color 0.2s", zIndex: 1, whiteSpace: "nowrap"
            }}
          >
            {active && (
              <motion.div
                layoutId="regime-pill"
                style={{ position: "absolute", inset: 0, background: "rgba(79, 195, 247, 0.15)", border: "1px solid rgba(79, 195, 247, 0.4)", borderRadius: 8, zIndex: -1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              />
            )}
            {REGIME_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}
