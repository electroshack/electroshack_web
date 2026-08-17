import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

const emptyForm = {
  title: "",
  notes: "",
  matchBarcode: "",
  matchItemNumber: "",
  priority: "normal",
  customerRequest: { name: "", email: "", phone: "", notify: "none" },
};

const TABS = [
  { value: "pending", label: "Open" },
  { value: "purchased", label: "Purchased" },
  { value: "", label: "All" },
];

const PRIORITY_PIP = {
  high: "bg-red-500",
  normal: "bg-gray-300",
  low: "bg-gray-200",
};

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

const NOTIFY = [
  { value: "none", label: "None" },
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "both", label: "Both" },
];

const fieldCls = "w-full h-8 px-2 border border-gray-200 rounded-sm text-sm";
const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-gray-400";

export default function GroceryList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState("pending");

  const load = () => {
    API.get("/grocery-list")
      .then((r) => setItems(r.data))
      .catch(() => toast.error("Could not load list."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const setCustomer = (patch) => {
    setForm((f) => ({ ...f, customerRequest: { ...f.customerRequest, ...patch } }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    const notify = form.customerRequest.notify;
    if ((notify === "email" || notify === "both") && !form.customerRequest.email.trim()) {
      toast.error("Email is required.");
      return;
    }
    if ((notify === "text" || notify === "both") && !form.customerRequest.phone.trim()) {
      toast.error("Phone is required.");
      return;
    }
    try {
      await API.post("/grocery-list", { ...form, status: "pending" });
      toast.success("Item added.");
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add.");
    }
  };

  const setStatus = async (id, status) => {
    try {
      await API.put(`/grocery-list/${id}`, { status });
      load();
    } catch {
      toast.error("Could not update.");
    }
  };

  const setPriority = async (id, priority) => {
    try {
      await API.put(`/grocery-list/${id}`, { priority });
      load();
    } catch {
      toast.error("Could not update priority.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this line?")) return;
    try {
      await API.delete(`/grocery-list/${id}`);
      load();
    } catch {
      toast.error("Could not delete.");
    }
  };

  const rows = items
    .filter((i) => !tab || i.status === tab)
    .slice()
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) || new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <AdminLayout title="Grocery list">
      <div className="space-y-3">
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-sm p-2">
          <div className="flex flex-nowrap items-end gap-1.5 overflow-x-auto">
            <label className="flex-1 min-w-[10rem]">
              <span className={labelCls}>Item</span>
              <input className={fieldCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="w-24 shrink-0">
              <span className={labelCls}>Priority</span>
              <select className={fieldCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="w-32 shrink-0">
              <span className={labelCls}>Barcode</span>
              <input className={`${fieldCls} font-mono`} value={form.matchBarcode} onChange={(e) => setForm({ ...form, matchBarcode: e.target.value })} />
            </label>
            <label className="w-24 shrink-0">
              <span className={labelCls}>Item #</span>
              <input className={`${fieldCls} font-mono`} value={form.matchItemNumber} onChange={(e) => setForm({ ...form, matchItemNumber: e.target.value })} />
            </label>
            <button type="submit" className="inline-flex items-center gap-1 h-8 px-2.5 bg-primary-500 text-white text-sm font-medium rounded-sm hover:bg-primary-600 shrink-0">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="border-t border-dashed border-gray-300 mt-2 pt-2">
            <div className="flex flex-nowrap items-end gap-1.5 overflow-x-auto">
              <label className="w-36 shrink-0">
                <span className={labelCls}>For</span>
                <input className={fieldCls} value={form.customerRequest.name} onChange={(e) => setCustomer({ name: e.target.value })} />
              </label>
              <label className="w-44 shrink-0">
                <span className={labelCls}>Email</span>
                <input type="email" className={fieldCls} value={form.customerRequest.email} onChange={(e) => setCustomer({ email: e.target.value })} />
              </label>
              <label className="w-36 shrink-0">
                <span className={labelCls}>Phone</span>
                <input className={fieldCls} value={form.customerRequest.phone} onChange={(e) => setCustomer({ phone: e.target.value })} />
              </label>
              <label className="w-24 shrink-0">
                <span className={labelCls}>Contact</span>
                <select className={fieldCls} value={form.customerRequest.notify} onChange={(e) => setCustomer({ notify: e.target.value })}>
                  {NOTIFY.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </form>

        <div className="flex border border-gray-200 bg-white p-0.5 w-fit rounded-sm">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setTab(t.value)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-sm ${tab === t.value ? "bg-dark-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-sm overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-gray-400 text-xs">None</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium w-6"></th>
                  <th className="px-3 py-1.5 text-left font-medium">Item</th>
                  <th className="px-3 py-1.5 text-left font-medium">For</th>
                  <th className="px-3 py-1.5 text-left font-medium">Contact</th>
                  <th className="px-3 py-1.5 text-left font-medium">Priority</th>
                  <th className="px-3 py-1.5 text-left font-medium">Match</th>
                  <th className="px-3 py-1.5 text-left font-medium">Status</th>
                  <th className="px-3 py-1.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const cr = row.customerRequest || {};
                  const notify = cr.notify || "none";
                  return (
                    <tr key={row._id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        <span className={`inline-block w-2 h-2 ${PRIORITY_PIP[row.priority] || PRIORITY_PIP.normal}`} />
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="font-medium text-dark-900">{row.title}</span>
                        {row.notes ? <span className="block text-[11px] text-gray-400">{row.notes}</span> : null}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-dark-900">{cr.name || "—"}</span>
                        {cr.email ? <span className="block text-[11px] text-gray-400">{cr.email}</span> : null}
                        {cr.phone ? <span className="block text-[11px] text-gray-400">{cr.phone}</span> : null}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs text-gray-600">
                        {NOTIFY.find((n) => n.value === notify)?.label || "None"}
                      </td>
                      <td className="px-3 py-1.5">
                        <select value={row.priority || "normal"} onChange={(e) => setPriority(row._id, e.target.value)} className="text-xs border border-gray-200 rounded-sm px-1 py-0.5">
                          <option value="high">High</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-gray-500">
                        {row.matchBarcode || row.matchItemNumber || "—"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold ${row.status === "pending" ? "bg-amber-100 text-amber-900" : row.status === "purchased" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {row.status === "pending" ? (
                            <button type="button" onClick={() => setStatus(row._id, "purchased")} className="text-[10px] px-2 py-0.5 border border-gray-200 rounded-sm hover:bg-gray-50">Purchased</button>
                          ) : null}
                          <button type="button" onClick={() => remove(row._id)} className="text-red-500 p-0.5"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
