import React, { useState, useEffect, useCallback } from "react";
import { Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: "", password: "", role: "admin" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/auth/users");
      setUsers(data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not load users.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return;
    setSaving(true);
    try {
      await API.post("/auth/register", form);
      toast.success("Account created.");
      setForm({ username: "", password: "", role: "admin" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create user.");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this admin account?")) return;
    try {
      await API.delete(`/auth/users/${id}`);
      toast.success("User removed.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete.");
    }
  };

  return (
    <AdminLayout title="Admins">
      <div className="space-y-3">
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-sm p-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[8rem] flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Username</span>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full h-8 px-2 border border-gray-200 rounded-sm text-sm" minLength={3} required />
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Password</span>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full h-8 px-2 border border-gray-200 rounded-sm text-sm" minLength={6} required />
          </label>
          <label className="w-36">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-8 px-2 border border-gray-200 rounded-sm text-sm">
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1 h-8 px-2.5 bg-primary-500 text-white text-sm font-medium rounded-sm hover:bg-primary-600 disabled:opacity-50">
            <UserPlus size={14} /> {saving ? "…" : "Add"}
          </button>
        </form>

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">User</th>
                  <th className="px-3 py-1.5 text-left font-medium">Role</th>
                  <th className="px-3 py-1.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium text-dark-900">{u.username}</td>
                    <td className="px-3 py-1.5 text-xs uppercase tracking-wider text-gray-400">{u.role}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button type="button" onClick={() => handleDelete(u._id)} className="text-red-500 hover:text-red-600 p-1" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
