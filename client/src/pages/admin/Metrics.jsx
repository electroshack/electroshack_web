import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, BarChart3 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Metrics() {
  const [from, setFrom] = useState(startOfMonthISO);
  const [to, setTo] = useState(todayISO);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  function loadMetrics() {
    setLoading(true);
    API.get("/metrics", { params: { from, to } })
      .then((r) => setSummary(r.data))
      .catch(() => toast.error("Could not load metrics."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMetrics();
    // initial range only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = (e) => {
    e.preventDefault();
    loadMetrics();
  };

  const exportXlsx = async () => {
    try {
      const res = await API.get("/metrics/export.xlsx", {
        params: { from, to },
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `electroshack-metrics-${from}_${to}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Download started.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const r = summary?.receipts;
  const inv = summary?.inventory;

  return (
    <AdminLayout title="Metrics & export">
      <div className="max-w-4xl space-y-6">
        <p className="text-sm text-gray-600">
          Repair ticket revenue uses completed tickets in the date range (<code className="text-xs bg-gray-100 px-1 rounded">date</code> field). Inventory money in/out uses{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">dateSold</code> / <code className="text-xs bg-gray-100 px-1 rounded">dateBought</code>.
        </p>

        <form onSubmit={applyRange} className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-gray-100 p-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
            Apply range
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-900 text-white text-sm font-medium rounded-lg hover:bg-dark-800"
          >
            <Download size={16} />
            Export XLSX
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 text-primary-600 mb-2">
                <BarChart3 size={20} />
                <span className="font-semibold text-dark-900">Receipts</span>
              </div>
              <p className="text-2xl font-bold text-dark-900">{r?.totalInRange ?? 0}</p>
              <p className="text-sm text-gray-500">Tickets in range</p>
              <p className="text-lg font-semibold text-dark-900 mt-3">${Number(r?.completedRevenue || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Revenue (completed, final total)</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 text-accent-600 mb-2">
                <BarChart3 size={20} />
                <span className="font-semibold text-dark-900">Inventory</span>
              </div>
              <p className="text-lg font-bold text-green-700">${Number(inv?.moneyInSold || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Money in (sold lines × price)</p>
              <p className="text-lg font-bold text-amber-800 mt-2">${Number(inv?.moneyOutPurchases || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Money out (purchases × cost)</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
