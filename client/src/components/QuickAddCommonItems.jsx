import React from "react";

// # One-click restock presets. Click fills name/category/price; staff save after a photo.
const PRESETS = [
  { id: "usbc-65w", label: "USB-C 65W charger", name: "USB-C 65W fast charger", description: "Universal 65W USB-C PD wall charger — fits phones, tablets, and most modern laptops.", category: "accessory", condition: "new", sellingPrice: 39.99, quantity: 1 },
  { id: "lightning-cable", label: "Lightning cable", name: "Lightning to USB-A cable (1m)", description: "MFi-style Lightning charging & sync cable for iPhone / iPad.", category: "accessory", condition: "new", sellingPrice: 14.99, quantity: 1 },
  { id: "usbc-cable", label: "USB-C cable", name: "USB-C to USB-C cable (1m)", description: "Braided USB-C to USB-C cable, supports up to 100W PD and USB 2.0 data.", category: "accessory", condition: "new", sellingPrice: 12.99, quantity: 1 },
  { id: "tempered-glass", label: "Tempered glass", name: "Tempered glass screen protector", description: "9H tempered glass with oleophobic coating — installation included with purchase.", category: "accessory", condition: "new", sellingPrice: 19.99, quantity: 1 },
  { id: "phone-case", label: "Phone case", name: "Protective phone case", description: "Slim shock-absorbing case with raised edges around the camera and screen.", category: "accessory", condition: "new", sellingPrice: 24.99, quantity: 1 },
  { id: "earbuds", label: "Bluetooth earbuds", name: "Bluetooth wireless earbuds", description: "Bluetooth 5.x earbuds with charging case — touch controls, in-ear fit.", category: "accessory", condition: "new", sellingPrice: 49.99, quantity: 1 },
  { id: "powerbank", label: "Power bank 10K", name: "Power bank — 10,000 mAh", description: "10,000 mAh portable power bank with USB-C PD in/out and a USB-A port.", category: "accessory", condition: "new", sellingPrice: 39.99, quantity: 1 },
  { id: "screen-replacement", label: "Screen part", name: "Replacement screen", description: "OEM-grade replacement display assembly (specify model in notes).", category: "part", condition: "new", sellingPrice: 0, quantity: 1 },
  { id: "battery", label: "Battery", name: "Replacement battery", description: "OEM-grade replacement battery (specify model in notes).", category: "part", condition: "new", sellingPrice: 0, quantity: 1 },
];

export default function QuickAddCommonItems({ onPick, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick?.(p)}
          className="px-2 py-0.5 text-xs border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 rounded-sm"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export { PRESETS };
