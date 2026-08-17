import React, { useState, useEffect } from "react";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [outbound, setOutbound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchMessages = async () => {
    try {
      const { data } = await API.get("/contact-forms");
      setMessages(data);
    } catch {
      setMessages([]);
    }
  };

  const fetchOutbound = async () => {
    try {
      const { data } = await API.get("/admin/outbound-sms");
      setOutbound(Array.isArray(data) ? data : []);
    } catch {
      setOutbound([]);
    }
  };

  useEffect(() => {
    Promise.all([fetchMessages(), fetchOutbound()]).finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await API.patch(`/contact-forms/${id}/read`);
      setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, read: true } : m)));
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await API.delete(`/contact-forms/${id}`);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      if (selected?._id === id) setSelected(null);
      toast.success("Deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleSelect = (msg) => {
    setSelected(msg);
    if (!msg.read) markRead(msg._id);
  };

  const retrySms = async (id) => {
    try {
      const { data } = await API.post(`/admin/outbound-sms/${id}/retry`);
      setOutbound((prev) => prev.map((row) => (row._id === id ? data : row)));
      if (data.status === "sent") toast.success("Sent.");
      else toast.error("Failed to send.");
    } catch {
      toast.error("Failed to send.");
    }
  };

  const unread = messages.filter((m) => !m.read).length;

  return (
    <AdminLayout title={unread > 0 ? `Messages (${unread})` : "Messages"}>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {outbound.length > 0 ? (
            <div className="bg-white rounded-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium w-36">To</th>
                    <th className="px-3 py-1.5 text-left font-medium">Message</th>
                    <th className="px-3 py-1.5 text-left font-medium w-20">Status</th>
                    <th className="px-3 py-1.5 text-right font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {outbound.slice(0, 40).map((row) => (
                    <tr key={row._id}>
                      <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">{row.to}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600 truncate">{row.body}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {row.status === "failed" ? (
                          <span className="inline-block bg-red-600 text-white text-[10px] font-bold uppercase px-1.5 py-0.5">failed</span>
                        ) : (
                          <span className="inline-block bg-green-700 text-white text-[10px] font-bold uppercase px-1.5 py-0.5">sent</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        {row.status === "failed" ? (
                          <button type="button" onClick={() => retrySms(row._id)} className="text-[11px] text-primary-600 hover:underline">
                            Retry
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
              {messages.length === 0 ? (
                <p className="px-3 py-6 text-center text-gray-400 text-xs">None</p>
              ) : (
                <div className="divide-y divide-gray-100 overflow-y-auto max-h-[70vh]">
                  {messages.map((m) => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => handleSelect(m)}
                      className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 ${selected?._id === m._id ? "bg-primary-50" : ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {m.read ? (
                          <MailOpen size={12} className="text-gray-400 shrink-0" />
                        ) : (
                          <Mail size={12} className="text-primary-500 shrink-0" />
                        )}
                        <span className={`text-sm truncate ${m.read ? "text-gray-600" : "font-medium text-dark-900"}`}>
                          {m.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate pl-5">{m.message}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-sm border border-gray-200 lg:col-span-2 min-h-[12rem]">
              {selected ? (
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-dark-900 truncate">{selected.name}</h2>
                      <a href={`mailto:${selected.email}`} className="text-xs text-primary-600 hover:underline">{selected.email}</a>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(selected.createdAt).toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={() => handleDelete(selected._id)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-dark-900 whitespace-pre-wrap">{selected.message}</p>
                </div>
              ) : (
                <p className="px-3 py-8 text-center text-gray-400 text-xs">Select a message</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
