import React from "react";

// # Sidebar scan: barcode + finder brackets + magnifier.
export default function ScanBarcodeIcon({ size = 18, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path d="M3 7V5a1 1 0 0 1 1-1h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M21 7V5a1 1 0 0 0-1-1h-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M3 17v2a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M21 17v2a1 1 0 0 1-1 1h-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7 7.5v6.5M9.2 7.5v6.5M10.6 7.5v6.5M13 7.5v4M15 7.5v6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15.5" cy="14.5" r="3.4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M18 17.2 20.4 19.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
