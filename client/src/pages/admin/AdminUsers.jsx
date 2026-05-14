import React, { useState, useEffect, useCallback } from "react";
import { Trash2, UserPlus, Shield } from "lucide-react";
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
    <AdminLayout title="Admin accounts">
      <div className="max-w-3xl space-y-8">
        <p className="text-sm text-gray-500">
          Only superadmins can manage accounts. Use this to add staff logins or remove old ones.
        </p>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-dark-900 mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-primary-500" />
            Add admin
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                minLength={3}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                minLength={6}
                required
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 self-end"
              >
                {saving ? "…" : "Add"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <h3 className="font-semibold text-dark-900 px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <Shield size={18} className="text-primary-500" />
            Existing accounts
          </h3>
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {users.map((u) => (
                <li key={u._id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div>
                    <span className="font-medium text-dark-900">{u.username}</span>
                    <span className="ml-2 text-xs uppercase tracking-wider text-gray-400">{u.role}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(u._id)}
                    className="text-red-500 hover:text-red-600 p-1"
                    title="Remove user"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
