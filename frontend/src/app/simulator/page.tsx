"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Simulator() {
  const [status, setStatus] = useState<any>({ status: "idle", logs: [], progress: 0 });

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://meghdrishti-backend.abhinavkumarsingh.tech'}/api/v1/pipeline/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const int = setInterval(fetchStatus, 2000);
    return () => clearInterval(int);
  }, []);

  const runPipeline = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://meghdrishti-backend.abhinavkumarsingh.tech'}/api/v1/pipeline/run`, { method: "POST" });
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const resetPipeline = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://meghdrishti-backend.abhinavkumarsingh.tech'}/api/v1/pipeline/reset`, { method: "POST" });
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-enter" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.8px" }}>AI Pipeline Simulator</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.95rem", marginTop: 4 }}>Live backend Machine Learning pipeline execution.</p>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          {status.status === "completed" || status.status === "error" ? (
            <button onClick={resetPipeline} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--glass-border)", background: "transparent", color: "var(--text-1)", cursor: "pointer", fontWeight: 600 }}>
              Reset Simulator
            </button>
          ) : null}
          <button 
            onClick={runPipeline} 
            disabled={status.status === "running"}
            style={{ 
              padding: "10px 24px", 
              borderRadius: 8, 
              border: "none", 
              background: status.status === "running" ? "var(--text-3)" : "var(--accent)", 
              color: "#fff", 
              cursor: status.status === "running" ? "not-allowed" : "pointer", 
              fontWeight: 600,
              boxShadow: status.status === "running" ? "none" : "0 4px 14px var(--accent-glow)"
            }}
          >
            {status.status === "running" ? "Pipeline Running..." : "Start ML Pipeline"}
          </button>
        </div>
      </div>
      
      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
        
        <div className="glass" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Data Flow Architecture</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
            
            <div style={{ position: "absolute", top: "50%", left: 50, right: 50, height: 4, background: "var(--glass-border)", zIndex: 0, borderRadius: 2 }}>
              <motion.div 
                style={{ height: "100%", background: "var(--accent)", borderRadius: 2 }}
                initial={{ width: 0 }}
                animate={{ width: `${status.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {[
              { id: "ingest", label: "Data Ingestion", step: 30, desc: "IMD GFS + CHIRPS" },
              { id: "features", label: "Feature Eng.", step: 60, desc: "Spatial & Temporal" },
              { id: "ml", label: "AI Inference", step: 75, desc: "LightGBM + Optuna" },
              { id: "db", label: "Database", step: 100, desc: "Turso Edge" }
            ].map((node, i) => (
              <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, width: 120 }}>
                <div style={{ 
                  width: 48, height: 48, borderRadius: "50%", 
                  background: status.progress >= node.step ? "var(--accent)" : "var(--bg-tertiary)",
                  border: `4px solid ${status.progress >= node.step ? "var(--bg-secondary)" : "var(--glass-border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: status.progress >= node.step ? "#fff" : "var(--text-3)",
                  fontWeight: 800, fontSize: "1.2rem",
                  boxShadow: status.progress >= node.step ? "0 0 20px var(--accent-glow)" : "none",
                  transition: "all 0.3s ease"
                }}>
                  {i + 1}
                </div>
                <div style={{ marginTop: 12, fontWeight: 700, fontSize: "0.9rem", textAlign: "center", color: status.progress >= node.step ? "var(--text-1)" : "var(--text-2)" }}>{node.label}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-3)", textAlign: "center", marginTop: 4 }}>{node.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "var(--bg-secondary)", padding: "12px 20px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }}></div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308" }}></div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }}></div>
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)", fontFamily: "monospace" }}>backend_pipeline.log</span>
          </div>
          <div style={{ padding: 20, background: "#0f172a", color: "#38bdf8", fontFamily: "monospace", fontSize: "0.85rem", minHeight: 300, maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {status.logs.length === 0 && <span style={{ color: "#475569" }}>No logs yet. Click 'Start ML Pipeline' to begin.</span>}
            {status.logs.map((log: string, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <span style={{ color: "#94a3b8", marginRight: 12 }}>[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
                {log}
              </motion.div>
            ))}
            {status.status === "running" && (
              <motion.div animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} style={{ width: 8, height: 16, background: "#38bdf8", marginTop: 4 }} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
