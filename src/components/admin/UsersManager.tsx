'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import Pagination from './Pagination';
import { Button } from '@/components/ui/foundation';
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  Mail,
  Phone,
  Building,
  KeyRound,
  CheckCircle2,
  XCircle,
  Search,
  UserCheck,
} from 'lucide-react';
import { Role } from '@prisma/client';
import { useToast } from '@/components/Toast';

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  branchIds: string[];
  isActive: boolean;
  createdAt: string | Date;
}

interface BranchOption {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<Role, { ar: string; en: string; color: string }> = {
  SUPER_ADMIN: { ar: 'مدير نظام عام (Super Admin)', en: 'Super Admin', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  BRANCH_MANAGER: { ar: 'مدير فرع (Branch Manager)', en: 'Branch Manager', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  FINANCE: { ar: 'مسؤول مالي (Finance)', en: 'Finance', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  CASHIER: { ar: 'كاشير (Cashier POS)', en: 'Cashier', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  STAFF: { ar: 'موظف مبيعات (Staff)', en: 'Staff', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

export default function UsersManager({
  users,
  branches,
}: {
  users: UserItem[];
  branches: BranchOption[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const okMsg = isAr ? 'تمت العملية بنجاح' : 'Done successfully';

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>(Role.STAFF);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setManagerPin('');
    setPhone('');
    setRole(Role.STAFF);
    setSelectedBranches(branches.length > 0 ? [branches[0].id] : []);
    setIsActive(true);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setManagerPin('');
    setPhone(u.phone || '');
    setRole(u.role);
    setSelectedBranches(u.branchIds || []);
    setIsActive(u.isActive);
    setError('');
    setShowModal(true);
  };

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload: {
      name: string;
      email: string;
      phone?: string;
      role: Role;
      branchIds: string[];
      isActive: boolean;
      password?: string;
      managerPin?: string;
    } = {
      name,
      email,
      phone: phone || undefined,
      role,
      branchIds: selectedBranches,
      isActive,
    };

    if (password) {
      payload.password = password;
    }
    if (managerPin) {
      payload.managerPin = managerPin;
    }

    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت العملية');
      }

      setShowModal(false);
      setManagerPin('');
      toast(okMsg, 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'حدث خطأ أثناء حفظ بيانات المستخدم';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u: UserItem) => {
    const confirmMsg = isAr
      ? `هل أنت متأكد من حذف المستخدم "${u.name}" نهائياً؟`
      : `Are you sure you want to delete user "${u.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    setDeleteError('');
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const msg = data.error || (isAr ? 'تعذر حذف المستخدم' : 'Could not delete user');
        setDeleteError(msg);
        toast(msg, 'error');
        return;
      }
      toast(okMsg, 'success');
      router.refresh();
    } catch {
      const msg = isAr ? 'فشل الاتصال لحذف المستخدم' : 'Connection failed while deleting';
      setDeleteError(msg);
      toast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter]);

  return (
    <div className="space-y-4">
      {deleteError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold animate-fade-in">
          {deleteError}
        </div>
      )}
      {/* Action Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالاسم، الإيميل، أو الموبايل...' : 'Search users...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 outline-none"
          >
            <option value="ALL">{isAr ? 'كل الصلاحيات' : 'All Roles'}</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="BRANCH_MANAGER">Branch Manager</option>
            <option value="FINANCE">Finance</option>
            <option value="CASHIER">Cashier</option>
            <option value="STAFF">Staff</option>
          </select>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={openAddModal}
        >
          <Plus className="w-4 h-4" />
          {isAr ? 'إضافة مستخدم جديد' : 'Add New User'}
        </Button>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50">
        <table className="w-full text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5">{isAr ? 'المستخدم' : 'User'}</th>
              <th className="p-3.5">{isAr ? 'الصلاحية (الدور)' : 'Role'}</th>
              <th className="p-3.5">{isAr ? 'الفروع المصرح بها' : 'Assigned Branches'}</th>
              <th className="p-3.5">{isAr ? 'رقم الهاتف' : 'Phone'}</th>
              <th className="p-3.5">{isAr ? 'الحالة' : 'Status'}</th>
              <th className="p-3.5 text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                  {isAr ? 'لا يوجد مستخدمين مطابقين للبحث' : 'No users found'}
                </td>
              </tr>
            ) : (
              pagedUsers.map((u) => {
                const roleConfig = ROLE_LABELS[u.role] || ROLE_LABELS.STAFF;
                return (
                  <tr key={u.id} className="hover:bg-slate-900/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-black text-blue-400 text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleConfig.color}`}
                      >
                        {isAr ? roleConfig.ar : roleConfig.en}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-300">
                      {u.branchIds && u.branchIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.branchIds.map((bid) => (
                            <span
                              key={bid}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                            >
                              {branchMap.get(bid) || 'فرع غير معروف'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">
                          {isAr ? 'كل الفروع (عام)' : 'All branches'}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-slate-400" dir="ltr">
                      {u.phone || '—'}
                    </td>

                    <td className="p-3.5">
                      {u.isActive ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {isAr ? 'نشط' : 'Active'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border border-rose-500/20">
                          <XCircle className="w-2.5 h-2.5" /> {isAr ? 'معطل' : 'Disabled'}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title={isAr ? 'تعديل' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          disabled={deletingId === u.id}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors disabled:opacity-50"
                          title={isAr ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredUsers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${filteredUsers.length} مستخدم` : `${filteredUsers.length} users`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                {editingUser
                  ? (isAr ? `تعديل المستخدم: ${editingUser.name}` : 'Edit User')
                  : (isAr ? 'إضافة مستخدم جديد للنظام' : 'Add New User')}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: محمد كمال' : 'e.g. Mohamed Kamal'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'البريد الإلكتروني (تسجيل الدخول) *' : 'Email Address *'}
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@sportschampions.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {editingUser
                    ? (isAr ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)' : 'New Password (leave blank to keep current)')
                    : (isAr ? 'كلمة المرور *' : 'Password *')}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  placeholder={editingUser ? '••••••••' : (isAr ? '6 أحرف على الأقل' : 'Min 6 characters')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'PIN اعتماد الخصومات (للمديرين، 4-8 أرقام — اتركه فارغاً للإبقاء)' : 'Discount approval PIN (managers, 4-8 digits — blank keeps current)'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  placeholder="••••"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input
                  type="tel"
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? 'الصلاحية والمستوى الوظيفي *' : 'Role & Permissions *'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500 outline-none"
                >
                  <option value={Role.CASHIER}>{isAr ? 'كاشير - نقطة بيع POS فقط' : 'Cashier (POS)'}</option>
                  <option value={Role.STAFF}>{isAr ? 'موظف مبيعات وكتالوج' : 'Staff'}</option>
                  <option value={Role.BRANCH_MANAGER}>{isAr ? 'مدير فرع (مخزون وطلبات الفرع)' : 'Branch Manager'}</option>
                  <option value={Role.FINANCE}>{isAr ? 'مسؤول مالي وحسابات ومرتبات' : 'Finance & Accounting'}</option>
                  <option value={Role.SUPER_ADMIN}>{isAr ? 'مدير نظام كامل (Super Admin)' : 'Super Admin (Full Access)'}</option>
                </select>
              </div>

              {/* Branch Assignment */}
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  {isAr ? 'الفروع المصرح للمستخدم بالعمل بها:' : 'Assigned Branches:'}
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {branches.map((b) => {
                    const checked = selectedBranches.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBranchSelection(b.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                        />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-800"
                />
                <label htmlFor="userIsActive" className="text-slate-300 font-bold cursor-pointer">
                  {isAr ? 'الحساب نشط ومصرح له بالدخول' : 'Account is active'}
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'جاري الحفظ...' : (isAr ? 'حفظ بيانات المستخدم' : 'Save User')}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
