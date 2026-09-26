import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/lib/providers";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Regime-SIH | Monsoon Forecast Dashboard",
  description: "Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 240, padding: "28px 32px", minHeight: "100vh" }}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
