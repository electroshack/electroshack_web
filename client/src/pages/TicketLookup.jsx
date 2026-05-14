import React, { useState } from "react";
import { Search, Clock, MessageCircle, Send, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import API from "../api";

const statusConfig = {
  received: { label: "Received", color: "bg-gray-100 text-gray-700", step: 0 },
  diagnosing: { label: "Diagnosing", color: "bg-primary-100 text-primary-700", step: 1 },
  "waiting-for-parts": { label: "Waiting for Parts", color: "bg-accent-100 text-accent-700", step: 2 },
  "in-progress": { label: "In Progress", color: "bg-blue-100 text-blue-700", step: 3 },
  "ready-for-pickup": { label: "Ready for Pickup", color: "bg-green-100 text-green-700", step: 4 },
  "customer-called": { label: "Customer Called", color: "bg-emerald-100 text-emerald-700", step: 4 },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", step: 5 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", step: -1 },
};

function statusStep(status) {
  const s = statusConfig[status];
  if (s == null || s.step < 0) return 0;
  return s.step;
}

/** Progress reflects both the ticket header and the furthest-along line item. */
function effectiveProgressStep(ticket) {
  const fromHeader = statusStep(ticket.status);
  const fromItems = (ticket.items || []).map((it) => statusStep(it.status));
  return Math.max(fromHeader, ...fromItems, 0);
}

const categoryLabels = {
  repair: "Repair",
  "cell-phone-accessory": "Cell Phone Accessory",
  "cell-phone-purchase": "Cell Phone Purchase",
  "laptop-repair": "Laptop Repair",
  "laptop-purchase": "Laptop Purchase",
  "pc-repair": "PC Repair",
  "pc-purchase": "PC Purchase",
  other: "Other",
};

export default function TicketLookup() {
  const [receiptNumber, setReceiptNumber] = useState("");
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!receiptNumber.trim()) return;
    setLoading(true);
    setTicket(null);
    setSearched(true);
    try {
      const { data } = await API.get(`/receipts/lookup/${encodeURIComponent(receiptNumber.trim())}`);
      setTicket(data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Ticket not found.");
    }
    setLoading(false);
  };

  const handleMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSendingMsg(true);
    try {
      await API.post(`/receipts/lookup/${encodeURIComponent(ticket.receiptNumber)}/message`, { message });
      toast.success("Message sent!");
      setMessage("");
      const { data } = await API.get(`/receipts/lookup/${encodeURIComponent(ticket.receiptNumber)}`);
      setTicket(data);
    } catch {
      toast.error("Failed to send message.");
    }
    setSendingMsg(false);
  };

  const overallStatus = ticket ? statusConfig[ticket.status] : null;
  const progressStep = ticket ? effectiveProgressStep(ticket) : 0;

  const combinedActivity =
    ticket &&
    [
      ...(ticket.updates || []).map((u) => ({
        kind: "ticket",
        date: u.date,
        message: u.message,
        author: u.author,
      })),
      ...(ticket.items || []).flatMap((it, itemIdx) =>
        (it.updates || []).map((u) => ({
          kind: "item",
          itemIdx,
          itemLabel: it.description || `Item ${itemIdx + 1}`,
          date: u.date,
          message: u.message,
          author: u.author,
        }))
      ),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <main className="min-h-screen bg-dark-900">
      {/* Search Hero - takes up full screen when no result */}
      <section className={`bg-dark-900 flex flex-col items-center justify-center transition-all duration-500 ${
        ticket ? "py-12" : searched ? "py-16" : "py-32"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
          <div className={`transition-all duration-500 ${ticket ? "mb-0" : "mb-4"}`}>
            <Search size={ticket ? 0 : 40} className="mx-auto text-primary-400 mb-4 transition-all duration-300" />
            <h1 className={`font-bold text-white transition-all duration-500 ${ticket ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
              Track Your Repair
            </h1>
            {!ticket && (
              <p className="text-gray-400 max-w-xl mx-auto mt-4 mb-2">
                Enter your quote number to check the status of your repair, see your estimate, and message our team.
              </p>
            )}
          </div>
          <form onSubmit={handleSearch} className="max-w-md mx-auto flex mt-6">
              <input
              type="text"
              placeholder="Enter quote / receipt number (e.g. 081952)"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="flex-1 px-4 py-3 rounded-l-lg border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-dark-800 text-white placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-accent-400 text-dark-900 font-bold rounded-r-lg hover:bg-accent-300 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Search"}
            </button>
          </form>

          {/* Not found state */}
          {searched && !loading && !ticket && (
            <div className="mt-8 text-gray-500 text-sm">
              <AlertCircle size={24} className="mx-auto text-gray-600 mb-2" />
              <p>No ticket found. Double-check your receipt number and try again.</p>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {ticket && (
        <section className="bg-gray-50 py-10 rounded-t-3xl">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-dark-900">Quote #{ticket.receiptNumber}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{ticket.customerName} &mdash; {new Date(ticket.date).toLocaleDateString()}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${overallStatus?.color}`}>
                  {overallStatus?.label}
                </span>
              </div>

              {ticket.priceEstimate > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Estimated quote</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Estimate only — final price may vary after diagnosis. This is a quote, not a tax invoice.</p>
                  </div>
                  <p className="text-2xl font-extrabold text-primary-600 font-mono tabular-nums">${Number(ticket.priceEstimate).toFixed(2)}</p>
                </div>
              )}

              {/* Overall progress */}
              {progressStep >= 0 && overallStatus?.step !== -1 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-[11px] text-gray-500 mb-2">Progress uses your ticket and each repair line.</p>
                  <div className="flex items-center gap-1">
                    {["Received", "Diagnosing", "Parts", "Repairing", "Ready", "Done"].map((label, i) => (
                      <React.Fragment key={label}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                              i <= progressStep ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {i <= progressStep ? "\u2713" : i + 1}
                          </div>
                          <span className="text-[9px] mt-1 text-gray-400 font-medium">{label}</span>
                        </div>
                        {i < 5 && (
                          <div className={`flex-1 h-0.5 mt-[-12px] ${i < progressStep ? "bg-primary-500" : "bg-gray-100"}`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Combined staff activity (ticket + line items) */}
            {combinedActivity && combinedActivity.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
                <h3 className="text-sm font-bold text-dark-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-primary-500" />
                  Repair activity
                </h3>
                <div className="space-y-3">
                  {combinedActivity.map((u, i) => (
                    <div key={i} className="flex gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                      <div>
                        {u.kind === "item" && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600 mb-0.5">
                            Line: {u.itemLabel}
                          </p>
                        )}
                        <p className="text-sm text-dark-900">{u.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(u.date).toLocaleString()}
                          {u.author && ` \u2014 ${u.author}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-item statuses */}
            {ticket.items?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
                <h3 className="text-sm font-bold text-dark-900 uppercase tracking-wider mb-4">Items on this Ticket</h3>
                <div className="space-y-3">
                  {ticket.items.map((item, idx) => {
                    const itemStatus = statusConfig[item.status];
                    return (
                      <div key={item._id || idx} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded">Item {idx + 1}</span>
                            <span className="text-sm font-semibold text-dark-900">{item.description}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${itemStatus?.color || "bg-gray-100 text-gray-600"}`}>
                            {itemStatus?.label || item.status}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>{categoryLabels[item.category] || item.category}</span>
                          {item.price > 0 && <span className="font-medium text-dark-900">${item.price.toFixed(2)}</span>}
                        </div>
                        {item.updates?.length > 0 && (
                          <p className="mt-2 text-[11px] text-gray-400">Line notes appear in Repair activity above.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-dark-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageCircle size={16} className="text-primary-500" />
                Messages
              </h3>

              {ticket.messages?.length > 0 ? (
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {ticket.messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                        m.sender === "customer"
                          ? "bg-primary-500 text-white rounded-br-md"
                          : "bg-gray-100 text-dark-900 rounded-bl-md"
                      }`}>
                        <p>{m.message}</p>
                        <p className={`text-[10px] mt-1 ${m.sender === "customer" ? "text-primary-200" : "text-gray-400"}`}>
                          {new Date(m.date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-4">No messages yet. Send a message to our team below.</p>
              )}

              <form onSubmit={handleMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !message.trim()}
                  className="px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
