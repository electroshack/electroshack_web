import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, FileText, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

const statusColors = {
  received: "bg-gray-100 text-gray-600",
  diagnosing: "bg-primary-100 text-primary-700",
  "waiting-for-parts": "bg-accent-100 text-accent-700",
  "in-progress": "bg-blue-100 text-blue-700",
  "ready-for-pickup": "bg-green-100 text-green-700",
  "customer-called": "bg-emerald-100 text-emerald-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function contactLabel(r) {
  const e = r.lastNotify?.email;
  const s = r.lastNotify?.sms;
  if (e?.sent || s?.sent) return { text: "sent", cls: "text-green-700" };
  if (e?.at || s?.at) return { text: "failed", cls: "text-red-600" };
  return { text: "not sent", cls: "text-red-600" };
}

function defaultChannel(r) {
  if (r.lastNotify?.email?.at && (!r.lastNotify?.sms?.at || r.lastNotify.email.at >= r.lastNotify.sms.at)) {
    return "email";
  }
  if (r.lastNotify?.sms?.at) return "text";
  if (r.customerEmail) return "email";
  return "text";
}

const ROW1 = "h-5 flex items-center";
const ROW2 = "h-6 flex items-center";

function ResendMenu({ anchor, onPick, onClose }) {
  const [pos, setPos] = useState(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!anchor) return undefined;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const menuH = 52;
      const openUp = window.innerHeight - r.bottom < menuH + 8;
      setPos({
        left: r.left,
        width: r.width,
        top: openUp ? r.top - menuH : r.bottom,
        openUp,
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  useEffect(() => {
    const onDoc = (e) => {
      if (anchor?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [anchor, onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 80 }}
      className={`overflow-hidden bg-gray-800 text-white shadow-md ${pos.openUp ? "rounded-t-sm" : "rounded-b-sm"}`}
    >
      <button
        type="button"
        onClick={() => onPick("text")}
        className="block w-full h-6 px-1.5 text-left text-[10px] font-medium hover:bg-gray-700"
      >
        text
      </button>
      <button
        type="button"
        onClick={() => onPick("email")}
        className="block w-full h-6 px-1.5 text-left text-[10px] font-medium hover:bg-gray-700"
      >
        email
      </button>
    </div>,
    document.body
  );
}

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [menuFor, setMenuFor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [notify, setNotify] = useState(null);
  const [notifyTo, setNotifyTo] = useState("");
  const [notifyUseOnFile, setNotifyUseOnFile] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await API.get("/receipts", { params });
      setReceipts(data.receipts);
      setTotalPages(data.totalPages);
    } catch {
      setReceipts([]);
    }
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReceipts();
  };

  const closeMenu = useCallback(() => {
    setMenuFor(null);
    setMenuAnchor(null);
  }, []);

  const openNotify = (receipt, channel) => {
    closeMenu();
    setNotify({ receipt, channel });
    setNotifyUseOnFile(true);
    setNotifyTo("");
  };

  const toggleMenu = (id, el) => {
    if (menuFor === id) {
      closeMenu();
      return;
    }
    setMenuFor(id);
    setMenuAnchor(el);
  };

  const sendNotify = async (e) => {
    e.preventDefault();
    if (!notify) return;
    const onFile = notify.channel === "email" ? notify.receipt.customerEmail : notify.receipt.customerPhone;
    const to = notifyUseOnFile ? "" : notifyTo.trim();
    if (!notifyUseOnFile && !to) {
      toast.error(notify.channel === "email" ? "Enter an email." : "Enter a number.");
      return;
    }
    if (notifyUseOnFile && !String(onFile || "").trim()) {
      toast.error(notify.channel === "email" ? "No email on file." : "No number on file.");
      return;
    }
    setSending(true);
    try {
      const { data } = await API.post(`/receipts/${notify.receipt._id}/notify`, {
        channel: notify.channel,
        to: to || undefined,
      });
      const result = notify.channel === "email" ? data.emailNotify : data.smsNotify;
      if (result?.sent) toast.success(`${notify.channel === "email" ? "Email" : "Text"} sent.`);
      else toast.error(`Failed: ${result?.reason || "unknown"}`);
      setNotify(null);
      fetchReceipts();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send.");
    }
    setSending(false);
  };

  const inputCls = "h-8 px-2 bg-white border border-gray-200 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-primary-500";
  const openReceipt = menuFor ? receipts.find((r) => r._id === menuFor) : null;

  return (
    <AdminLayout title="Quotes">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[180px] max-w-md">
            <input
              type="text"
              placeholder="Name, phone, or #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} flex-1 rounded-r-none`}
            />
            <button type="submit" className="h-8 px-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-sm text-gray-500 hover:bg-gray-200">
              <Search size={14} />
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className={inputCls}
          >
            <option value="">All</option>
            <option value="received">Received</option>
            <option value="diagnosing">Diagnosing</option>
            <option value="waiting-for-parts">Waiting for Parts</option>
            <option value="in-progress">In Progress</option>
            <option value="ready-for-pickup">Ready for Pickup</option>
            <option value="customer-called">Customer Called</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Link
            to="/admin/receipts/new"
            className="inline-flex items-center gap-1 h-8 px-2 bg-primary-500 text-white text-xs font-medium leading-none rounded-sm hover:bg-primary-600 ml-auto"
          >
            <Plus size={13} />
            Quote
          </Link>
        </div>

        <div className="bg-white rounded-sm border border-gray-200">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No quotes found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs table-fixed">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium w-[8.5rem]">Receipt Num #</th>
                    <th className="px-2 py-1.5 text-left font-medium">Customer</th>
                    <th className="px-2 py-1.5 text-left font-medium w-12">Items</th>
                    <th className="px-2 py-1.5 text-left font-medium w-24">Status</th>
                    <th className="px-2 py-1.5 text-left font-medium w-16">Total</th>
                    <th className="px-2 py-1.5 text-left font-medium w-[5.5rem]">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipts.map((r) => {
                    const contact = contactLabel(r);
                    return (
                      <tr key={r._id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 align-top whitespace-nowrap">
                          <div className={ROW1}>
                            <Link to={`/admin/receipts/${r._id}`} className="font-medium text-primary-500 hover:underline">
                              #{r.receiptNumber}
                            </Link>
                          </div>
                          <div className={`${ROW2} text-[10px] text-gray-400`}>
                            {new Date(r.date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <div className={`${ROW1} font-medium text-dark-900 truncate max-w-[10rem]`}>{r.customerName}</div>
                          <div className={`${ROW2} text-[10px] text-gray-400 whitespace-nowrap`}>{r.customerPhone}</div>
                        </td>
                        <td className="px-2 py-1.5 align-top tabular-nums text-gray-500">
                          <div className={ROW1}>{r.items?.length || 0}</div>
                          <div className={ROW2} />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <div className={ROW1}>
                            <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-medium whitespace-nowrap ${statusColors[r.status] || "bg-gray-100"}`}>
                              {r.status?.replace(/-/g, " ")}
                            </span>
                          </div>
                          <div className={ROW2} />
                        </td>
                        <td className="px-2 py-1.5 align-top tabular-nums text-gray-600 whitespace-nowrap text-left">
                          <div className={ROW1}>${Number(r.priceEstimate || 0).toFixed(2)}</div>
                          <div className={ROW2} />
                        </td>
                        <td className="px-2 py-1.5 align-top text-left">
                          <div className={ROW1}>
                            <div
                              className={`inline-flex h-6 overflow-hidden ${menuFor === r._id ? "rounded-t-sm" : "rounded-sm"}`}
                            >
                              <button
                                type="button"
                                onClick={() => openNotify(r, defaultChannel(r))}
                                className="h-6 px-1.5 text-[10px] font-medium leading-none bg-gray-800 text-white hover:bg-gray-700"
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                onClick={(e) => toggleMenu(r._id, e.currentTarget.parentElement)}
                                className="h-6 px-1 bg-gray-800 text-white border-l border-white/20 hover:bg-gray-700"
                                aria-label="Resend options"
                                aria-expanded={menuFor === r._id}
                              >
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div className={`${ROW2} text-[10px] font-medium ${contact.cls}`}>{contact.text}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-2 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-sm disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-sm disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}

          {search.trim() !== "" && (
            <div className="px-2 py-2 border-t border-gray-100 bg-gray-50/80 flex items-center justify-center gap-2 text-xs text-gray-600">
              <FileText size={14} className="text-gray-400 shrink-0" aria-hidden />
              <Link to="/admin/receipts/legacy/new" className="font-medium text-primary-600 hover:underline">
                Add paper / old quote
              </Link>
            </div>
          )}
        </div>
      </div>

      {openReceipt && menuAnchor ? (
        <ResendMenu
          anchor={menuAnchor}
          onClose={closeMenu}
          onPick={(channel) => openNotify(openReceipt, channel)}
        />
      ) : null}

      {notify ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3" onClick={() => setNotify(null)}>
          <form
            onSubmit={sendNotify}
            className="w-full max-w-sm bg-white rounded-sm shadow-lg p-3 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-dark-900">
                Send {notify.channel === "email" ? "email" : "text"}
              </h2>
              <button type="button" onClick={() => setNotify(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X size={14} />
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="radio"
                checked={notifyUseOnFile}
                onChange={() => setNotifyUseOnFile(true)}
                className="mt-0.5"
              />
              <span>
                On file
                <span className="block text-gray-400 font-mono">
                  {(notify.channel === "email" ? notify.receipt.customerEmail : notify.receipt.customerPhone) || "—"}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="radio"
                checked={!notifyUseOnFile}
                onChange={() => setNotifyUseOnFile(false)}
                className="mt-0.5"
              />
              <span className="flex-1">
                New {notify.channel === "email" ? "email" : "number"}
                <input
                  type={notify.channel === "email" ? "email" : "tel"}
                  value={notifyTo}
                  onChange={(e) => {
                    setNotifyUseOnFile(false);
                    setNotifyTo(e.target.value);
                  }}
                  placeholder={notify.channel === "email" ? "name@example.com" : "Phone"}
                  className="mt-1 w-full h-8 px-2 border border-gray-200 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setNotify(null)} className="h-8 px-2 text-xs text-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={sending} className="h-8 px-3 text-xs font-medium bg-primary-500 text-white rounded-sm hover:bg-primary-600 disabled:opacity-50">
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminLayout>
  );
}
