import React from "react";
import { Zap } from "lucide-react";

/**
 * One-click templates for common items the shop restocks all the time.
 * Click → pre-fills name, category, condition, selling price, and a short
 * description. Staff can then snap a photo & save without typing the basics.
 *
 * Override / extend by editing this list.
 */
const PRESETS = [
  {
    id: "usbc-65w",
    label: "USB-C 65W charger",
    name: "USB-C 65W fast charger",
    description: "Universal 65W USB-C PD wall charger — fits phones, tablets, and most modern laptops.",
    category: "accessory",
    condition: "new",
    sellingPrice: 39.99,
    quantity: 1,
  },
  {
    id: "lightning-cable",
    label: "Lightning cable",
    name: "Lightning to USB-A cable (1m)",
    description: "MFi-style Lightning charging & sync cable for iPhone / iPad.",
    category: "accessory",
    condition: "new",
    sellingPrice: 14.99,
    quantity: 1,
  },
  {
    id: "usbc-cable",
    label: "USB-C cable",
    name: "USB-C to USB-C cable (1m)",
    description: "Braided USB-C to USB-C cable, supports up to 100W PD and USB 2.0 data.",
    category: "accessory",
    condition: "new",
    sellingPrice: 12.99,
    quantity: 1,
  },
  {
    id: "tempered-glass",
    label: "Tempered glass",
    name: "Tempered glass screen protector",
    description: "9H tempered glass with oleophobic coating — installation included with purchase.",
    category: "accessory",
    condition: "new",
    sellingPrice: 19.99,
    quantity: 1,
  },
  {
    id: "phone-case",
    label: "Phone case",
    name: "Protective phone case",
    description: "Slim shock-absorbing case with raised edges around the camera and screen.",
    category: "accessory",
    condition: "new",
    sellingPrice: 24.99,
    quantity: 1,
  },
  {
    id: "earbuds",
    label: "Bluetooth earbuds",
    name: "Bluetooth wireless earbuds",
    description: "Bluetooth 5.x earbuds with charging case — touch controls, in-ear fit.",
    category: "accessory",
    condition: "new",
    sellingPrice: 49.99,
    quantity: 1,
  },
  {
    id: "powerbank",
    label: "Power bank 10K",
    name: "Power bank — 10,000 mAh",
    description: "10,000 mAh portable power bank with USB-C PD in/out and a USB-A port.",
    category: "accessory",
    condition: "new",
    sellingPrice: 39.99,
    quantity: 1,
  },
  {
    id: "screen-replacement",
    label: "Screen part",
    name: "Replacement screen",
    description: "OEM-grade replacement display assembly (specify model in notes).",
    category: "part",
    condition: "new",
    sellingPrice: 0,
    quantity: 1,
  },
  {
    id: "battery",
    label: "Battery",
    name: "Replacement battery",
    description: "OEM-grade replacement battery (specify model in notes).",
    category: "part",
    condition: "new",
    sellingPrice: 0,
    quantity: 1,
  },
];

export default function QuickAddCommonItems({ onPick, disabled = false }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-amber-500" />
        <h3 className="font-semibold text-dark-900">Quick add — common items</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80">One click pre-fills the form</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Click the closest match, then just adjust the price/photo and save. Use this for items you restock often.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick?.(p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 hover:border-amber-300 transition-colors disabled:opacity-50"
          >
            <span>{p.label}</span>
            {p.sellingPrice > 0 ? (
              <span className="text-[10px] text-amber-600/70 font-mono">${p.sellingPrice.toFixed(2)}</span>
            ) : (
              <span className="text-[10px] text-gray-400">price?</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export { PRESETS };
