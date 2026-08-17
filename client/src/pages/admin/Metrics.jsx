import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import SalesChart from "../../components/SalesChart";
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
  const rangeFrom = summary?.range?.from || from;
  const rangeTo = summary?.range?.to || to;

  return (
    <AdminLayout title="Metrics">
      <div className="space-y-3">
        <form onSubmit={applyRange} className="flex flex-wrap items-end gap-2">
          <label>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 px-2 border border-gray-200 rounded-sm text-sm" />
          </label>
          <label>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 px-2 border border-gray-200 rounded-sm text-sm" />
          </label>
          <button type="submit" className="h-8 px-2.5 bg-primary-500 text-white text-sm font-medium rounded-sm hover:bg-primary-600">
            Apply
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            className="inline-flex items-center gap-1 h-8 px-2.5 bg-white border border-gray-200 text-sm font-medium rounded-sm hover:bg-gray-50"
          >
            <Download size={12} />
            XLSX
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white border border-gray-200 rounded-sm px-3 py-2">
                <p className="text-base font-semibold text-dark-900 leading-tight">{r?.totalInRange ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Tickets</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-sm px-3 py-2">
                <p className="text-base font-semibold text-dark-900 leading-tight">${Number(r?.completedRevenue || 0).toFixed(2)}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Completed</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-sm px-3 py-2">
                <p className="text-base font-semibold text-dark-900 leading-tight">${Number(inv?.moneyInSold || 0).toFixed(2)}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Sold</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-sm px-3 py-2">
                <p className="text-base font-semibold text-dark-900 leading-tight">${Number(inv?.moneyOutPurchases || 0).toFixed(2)}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Purchases</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm px-3 py-2">
              <h3 className="text-xs font-semibold text-dark-900 mb-1">Quotes</h3>
              <SalesChart from={rangeFrom} to={rangeTo} series={summary?.daily?.quotes || []} color="#0787ec" />
            </div>
            <div className="bg-white border border-gray-200 rounded-sm px-3 py-2">
              <h3 className="text-xs font-semibold text-dark-900 mb-1">Inventory</h3>
              <SalesChart from={rangeFrom} to={rangeTo} series={summary?.daily?.inventory || []} color="#ca8a04" emptyLabel="None" />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
