import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfkit liest seine Schrift-AFM-Dateien zur Laufzeit per fs aus dem eigenen
  // Paketverzeichnis. Würde es gebündelt, schlägt die PDF-Erzeugung im
  // Produktionsbuild fehl (DOCX bleibt unberührt). Daher als extern behandeln.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;