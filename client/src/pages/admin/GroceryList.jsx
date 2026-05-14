import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShoppingCart, Plus, Trash2, Mail } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

const emptyForm = {
  title: "",
  notes: "",
  matchBarcode: "",
  matchItemNumber: "",
  customerRequest: { name: "", email: "", phone: "" },
};

export default function GroceryList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    API.get("/grocery-list")
      .then((r) => setItems(r.data))
      .catch(() => toast.error("Could not load list."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    try {
      const res = await API.post("/grocery-list", {
        ...form,
        status: "pending",
      });
      const n = res.data?.emailNotify;
      toast.success("Item added.");
      if (n && !n.sent) {
        toast.error(`Grocery alert email failed: ${n.reason || "unknown"}`, { duration: 9000 });
      }
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add.");
    }
  };

  const setStatus = async (id, status) => {
    try {
      const res = await API.put(`/grocery-list/${id}`, { status });
      load();
      const n = res.data?.emailNotify;
      if (n && !n.sent && n.reason) {
        toast.error(`Status saved, but grocery email failed: ${n.reason}`, { duration: 8000 });
      }
    } catch {
      toast.error("Could not update.");
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

  return (
    <AdminLayout title="Grocery / parts list">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="max-w-5xl space-y-8">
          <p className="text-sm text-gray-600">
            Things to pick up for the shop. If a customer asked for something, add their email — when matching inventory is received (same barcode or item #) and goes
            in-stock, they get an email. Configure SMTP in the server (<code className="text-xs bg-gray-100 px-1 rounded">SMTP_HOST</code>, etc.).
          </p>

          <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-dark-900 flex items-center gap-2">
              <Plus size={18} className="text-primary-500" />
              Add line
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">What to get *</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. USB-C hub, iPhone 14 screen"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Supplier, qty…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Match barcode (for auto email)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  value={form.matchBarcode}
                  onChange={(e) => setForm({ ...form, matchBarcode: e.target.value })}
                  placeholder="Scan or type UPC/EAN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Or match item #</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  value={form.matchItemNumber}
                  onChange={(e) => setForm({ ...form, matchItemNumber: e.target.value })}
                  placeholder="Internal SKU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Customer name</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.customerRequest.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customerRequest: { ...form.customerRequest, name: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Mail size={14} />
                  Customer email (notify when in stock)
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.customerRequest.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customerRequest: { ...form.customerRequest, email: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Customer phone</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.customerRequest.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customerRequest: { ...form.customerRequest, phone: e.target.value },
                    })
                  }
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
            >
              <ShoppingCart size={16} />
              Add to list
            </button>
          </form>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-dark-900">Open items ({items.filter((i) => i.status === "pending").length})</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {items.length === 0 ? (
                <li className="p-8 text-center text-gray-400 text-sm">Nothing on the list yet.</li>
              ) : (
                items.map((row) => (
                  <li key={row._id} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <p className="font-medium text-dark-900">{row.title}</p>
                      {row.notes && <p className="text-sm text-gray-500 mt-1">{row.notes}</p>}
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                        {row.matchBarcode && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded font-mono">barcode: {row.matchBarcode}</span>
                        )}
                        {row.matchItemNumber && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded font-mono">item: {row.matchItemNumber}</span>
                        )}
                        {row.customerRequest?.email && (
                          <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded">notify: {row.customerRequest.email}</span>
                        )}
                        {row.stockNotifiedAt && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                            Emailed {new Date(row.stockNotifiedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          row.status === "pending"
                            ? "bg-amber-100 text-amber-900"
                            : row.status === "purchased"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {row.status}
                      </span>
                      {row.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatus(row._id, "purchased")}
                            className="text-xs px-3 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50"
                          >
                            Mark purchased
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(row._id, "cancelled")}
                            className="text-xs px-3 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(row._id)}
                        className="text-red-500 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
