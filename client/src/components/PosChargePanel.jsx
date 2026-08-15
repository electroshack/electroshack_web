import React, { useEffect, useRef, useState } from "react";
import { CreditCard, Usb, Keyboard } from "lucide-react";
import toast from "react-hot-toast";
import API from "../api";

const METHODS = [
  { value: "terminal", label: "Tap / insert" },
  { value: "cash", label: "Cash" },
  { value: "etransfer", label: "E-transfer" },
  { value: "other", label: "Other" },
];

function deviceName(dev, kind) {
  const product = dev.productName || dev.product || "Unknown device";
  const vendor = dev.manufacturerName || "";
  return vendor ? `${kind}: ${product} (${vendor})` : `${kind}: ${product}`;
}

export default function PosChargePanel({ receipt, quoteTotal, onPaid }) {
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState(receipt?.payment?.method && receipt.payment.method !== "unpaid" ? receipt.payment.method : "terminal");
  const [amount, setAmount] = useState(
    receipt?.payment?.amountPaid || quoteTotal || 0
  );
  const [refCode, setRefCode] = useState(receipt?.payment?.terminalRef || "");
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const listenRef = useRef("");

  useEffect(() => {
    setAmount(receipt?.payment?.amountPaid || quoteTotal || 0);
  }, [quoteTotal, receipt?.payment?.amountPaid]);

  const paid = receipt?.payment?.method && receipt.payment.method !== "unpaid";

  const pairHid = async () => {
    if (!navigator.hid?.requestDevice) {
      toast.error("This browser cannot list USB card terminals. Use Chrome or Edge on this PC.");
      return;
    }
    try {
      const list = await navigator.hid.requestDevice({ filters: [] });
      const next = list.map((d) => ({ id: `${d.vendorId}-${d.productId}-${d.productName}`, label: deviceName(d, "HID"), kind: "hid", raw: d }));
      setDevices((prev) => [...prev.filter((p) => p.kind !== "hid"), ...next]);
      if (next[0]) setSelected(next[0].id);
    } catch (e) {
      if (e?.name !== "NotFoundError") toast.error("HID permission was not granted.");
    }
  };

  const pairUsb = async () => {
    if (!navigator.usb?.requestDevice) {
      toast.error("WebUSB is not available. Use Chrome or Edge.");
      return;
    }
    try {
      const d = await navigator.usb.requestDevice({ filters: [] });
      const item = { id: `usb-${d.vendorId}-${d.productId}`, label: deviceName(d, "USB"), kind: "usb", raw: d };
      setDevices((prev) => [...prev.filter((p) => p.id !== item.id), item]);
      setSelected(item.id);
    } catch (e) {
      if (e?.name !== "NotFoundError") toast.error("USB permission was not granted.");
    }
  };

  const pairSerial = async () => {
    if (!navigator.serial?.requestPort) {
      toast.error("Web Serial is not available. Use Chrome or Edge.");
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      const info = port.getInfo?.() || {};
      const item = {
        id: `serial-${info.usbVendorId || "port"}-${info.usbProductId || Date.now()}`,
        label: `Serial terminal ${info.usbVendorId ? `(${info.usbVendorId}:${info.usbProductId})` : ""}`.trim(),
        kind: "serial",
        raw: port,
      };
      setDevices((prev) => [...prev.filter((p) => p.id !== item.id), item]);
      setSelected(item.id);
    } catch (e) {
      if (e?.name !== "NotFoundError") toast.error("Serial permission was not granted.");
    }
  };

  const sendAmountToSerial = async () => {
    const dev = devices.find((d) => d.id === selected);
    if (!dev || dev.kind !== "serial") {
      toast.error("Pair a serial terminal first, or charge on the handheld and mark paid.");
      return;
    }
    try {
      await dev.raw.open({ baudRate: 9600 });
      const writer = dev.raw.writable.getWriter();
      const line = `${Number(amount).toFixed(2)}\r\n`;
      await writer.write(new TextEncoder().encode(line));
      writer.releaseLock();
      await dev.raw.close();
      toast.success(`Sent $${Number(amount).toFixed(2)} to the serial port. Complete tap/insert on the terminal.`);
    } catch (e) {
      toast.error(e?.message || "Could not write to the terminal. Charge on the handheld, then mark paid.");
    }
  };

  useEffect(() => {
    if (!listening) return undefined;
    listenRef.current = "";
    const onKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const code = listenRef.current.trim();
        if (code) setRefCode(code);
        setListening(false);
        toast.success("Captured terminal response.");
        return;
      }
      if (e.key.length === 1) listenRef.current += e.key;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening]);

  const savePayment = async (clear = false) => {
    if (!receipt?._id) return;
    setSaving(true);
    try {
      const payload = clear
        ? { method: "unpaid", amountPaid: 0, terminalRef: "", deviceLabel: "", note: "" }
        : {
            method,
            amountPaid: Number(amount) || 0,
            terminalRef: refCode,
            deviceLabel: devices.find((d) => d.id === selected)?.label || "",
            note: method === "terminal" ? "Charged on handheld POS" : "",
          };
      const { data } = await API.post(`/receipts/${receipt._id}/payment`, payload);
      onPaid?.(data);
      toast.success(clear ? "Marked unpaid." : `Recorded ${METHODS.find((m) => m.value === payload.method)?.label || payload.method}.`);
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not save payment.");
    }
    setSaving(false);
  };

  if (!receipt?._id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-[11px] text-amber-900/70">
        Save the quote first, then charge tap/insert on the handheld and mark it paid here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300/60 bg-white/80 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 text-amber-950">
        <CreditCard size={14} />
        <span className="text-[10px] font-bold uppercase tracking-wider">POS / payment</span>
        {paid ? (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-green-700">
            {receipt.payment.method} ${Number(receipt.payment.amountPaid || 0).toFixed(2)}
          </span>
        ) : (
          <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-800/50">unpaid</span>
        )}
      </div>
      <p className="text-[10px] leading-snug text-amber-900/65">
        Chip and tap stay on the handheld (PCI). Pair the USB/serial dongle if the browser can see it, send the amount, then mark paid. Cash and e-transfer still work as manual entry.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={pairHid} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-100 text-amber-950 hover:bg-amber-200">
          <Keyboard size={11} /> HID
        </button>
        <button type="button" onClick={pairUsb} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-100 text-amber-950 hover:bg-amber-200">
          <Usb size={11} /> USB
        </button>
        <button type="button" onClick={pairSerial} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-100 text-amber-950 hover:bg-amber-200">
          Serial
        </button>
      </div>
      {devices.length > 0 ? (
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full text-[11px] border-b border-amber-800/25 bg-transparent py-0.5">
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      ) : (
        <p className="text-[10px] text-amber-800/50">No terminal paired in this browser session yet.</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="col-span-1">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-800/55">Amount</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-1 py-0.5 text-sm font-mono border-b border-amber-800/25 bg-transparent" />
        </label>
        <label className="col-span-1">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-800/55">Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full text-[11px] border-b border-amber-800/25 bg-transparent py-0.5">
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="col-span-2">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-800/55">Approval / ref</span>
          <input value={refCode} onChange={(e) => setRefCode(e.target.value)} placeholder="Optional — or capture from keyboard-wedge" className="w-full px-1 py-0.5 text-[11px] border-b border-amber-800/25 bg-transparent" />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={sendAmountToSerial} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded bg-dark-900 text-white hover:bg-dark-800">
          Send amount
        </button>
        <button type="button" onClick={() => setListening((v) => !v)} className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded ${listening ? "bg-green-600 text-white" : "bg-amber-100 text-amber-950"}`}>
          {listening ? "Listening…" : "Capture ref"}
        </button>
        <button type="button" disabled={saving} onClick={() => savePayment(false)} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50">
          Mark paid
        </button>
        {paid ? (
          <button type="button" disabled={saving} onClick={() => savePayment(true)} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded text-amber-800/70 hover:bg-amber-100">
            Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}
