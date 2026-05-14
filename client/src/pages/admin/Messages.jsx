import React, { useState, useEffect } from "react";
import { Mail, MailOpen, Trash2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchMessages = async () => {
    try {
      const { data } = await API.get("/contact-forms");
      setMessages(data);
    } catch {
      setMessages([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMessages(); }, []);

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

  const unread = messages.filter((m) => !m.read).length;

  return (
    <AdminLayout title={`Messages${unread > 0 ? ` (${unread} unread)` : ""}`}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-130px)]">
          {/* List */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden lg:col-span-1">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-dark-900 text-sm">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </h3>
            </div>
            {messages.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No messages yet.</div>
            ) : (
              <div className="divide-y divide-gray-50 overflow-y-auto max-h-[calc(100vh-220px)]">
                {messages.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => handleSelect(m)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selected?._id === m._id ? "bg-primary-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {m.read ? (
                        <MailOpen size={14} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <Mail size={14} className="text-primary-500 flex-shrink-0" />
                      )}
                      <span className={`text-sm font-medium truncate ${m.read ? "text-gray-600" : "text-dark-900"}`}>
                        {m.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate pl-6">{m.message}</p>
                    <p className="text-[10px] text-gray-400 pl-6 mt-1">
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden lg:col-span-2">
            {selected ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-dark-900">{selected.name}</h2>
                    <p className="text-sm text-primary-500">{selected.email}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <Clock size={12} />
                      {new Date(selected.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(selected._id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-dark-900 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                </div>
                <div className="mt-4">
                  <a
                    href={`mailto:${selected.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    <Mail size={14} />
                    Reply via Email
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm p-8">
                Select a message to view it
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
