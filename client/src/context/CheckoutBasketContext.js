import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import toast from "react-hot-toast";
import API from "../api";

const CheckoutBasketContext = createContext(null);

const REPAIR_CATEGORIES = new Set(["repair", "laptop-repair", "pc-repair"]);

function inventoryToQuoteCategory(category) {
  switch (category) {
    case "cell-phone":
      return "cell-phone-purchase";
    case "laptop":
      return "laptop-purchase";
    case "pc":
      return "pc-purchase";
    case "accessory":
      return "cell-phone-accessory";
    default:
      return "other";
  }
}

export function CheckoutBasketProvider({ children }) {
  const [lines, setLines] = useState([]);

  const addItem = useCallback(async (item, qty = 1) => {
    if (!item?._id) return;
    const addQty = Math.max(1, Number(qty) || 1);
    try {
      await API.post(`/inventory/${item._id}/reserve`, { qty: addQty });
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not reserve item.");
      return false;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.inventoryItemId === item._id);
      if (existing) {
        return prev.map((l) =>
          l.inventoryItemId === item._id ? { ...l, stockQty: l.stockQty + addQty } : l
        );
      }
      return [
        ...prev,
        {
          inventoryItemId: item._id,
          itemNumber: item.itemNumber,
          description: item.name,
          category: inventoryToQuoteCategory(item.category),
          price: item.sellingPrice || 0,
          stockQty: addQty,
          imei: item.imei || "",
        },
      ];
    });
    toast.success(`Added ${item.name} to basket`);
    return true;
  }, []);

  const removeLine = useCallback(async (inventoryItemId) => {
    const line = lines.find((l) => l.inventoryItemId === inventoryItemId);
    if (line) {
      try {
        await API.post(`/inventory/${inventoryItemId}/unreserve`, { qty: line.stockQty });
      } catch {
        /* still drop from cart */
      }
    }
    setLines((prev) => prev.filter((l) => l.inventoryItemId !== inventoryItemId));
  }, [lines]);

  const clear = useCallback(async () => {
    await Promise.all(
      lines.map((l) =>
        API.post(`/inventory/${l.inventoryItemId}/unreserve`, { qty: l.stockQty }).catch(() => null)
      )
    );
    setLines([]);
  }, [lines]);

  const consume = useCallback(() => {
    const snapshot = [...lines];
    setLines([]);
    return snapshot;
  }, [lines]);

  const saleOnly =
    lines.length > 0 && lines.every((l) => l.inventoryItemId && !REPAIR_CATEGORIES.has(l.category || "repair"));
  const subtotal = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.stockQty) || 1), 0);

  const value = useMemo(
    () => ({ lines, addItem, removeLine, clear, consume, saleOnly, subtotal, count: lines.reduce((n, l) => n + l.stockQty, 0) }),
    [lines, addItem, removeLine, clear, consume, saleOnly, subtotal]
  );

  return <CheckoutBasketContext.Provider value={value}>{children}</CheckoutBasketContext.Provider>;
}

export function useCheckoutBasket() {
  const ctx = useContext(CheckoutBasketContext);
  if (!ctx) throw new Error("useCheckoutBasket requires CheckoutBasketProvider");
  return ctx;
}

export { REPAIR_CATEGORIES, inventoryToQuoteCategory };
