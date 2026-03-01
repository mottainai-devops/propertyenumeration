import { useState } from 'react';
import { authApi } from '../api/client';

interface ProfileSettingsProps {
  onClose: () => void;
  onLogout: () => void;
  onLoadCustomers?: () => void;
}

const ADMIN_ROLES = ['admin', 'cherry_picker', 'superadmin'];

export default function ProfileSettings({ onClose, onLogout, onLoadCustomers }: ProfileSettingsProps) {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  // Backend v3.0.0 returns fullName; older cached data may use name — support both
  const displayName: string = user.fullName || user.name || '';
  const assignedLots: { lotCode: string; name?: string; lotName?: string }[] = (() => {
    try { return JSON.parse(localStorage.getItem('assignedLots') || '[]'); } catch { return []; }
  })();

  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Profile & Settings</h1>
            <p className="text-xs text-gray-500">Manage your account</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Avatar + name card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
            <span className="text-green-800 font-bold text-2xl">{initials(displayName || user.email || 'U')}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">{displayName || '—'}</p>
            <p className="text-sm text-gray-500 truncate">{user.email || '—'}</p>
            {user.role && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold capitalize">
                {user.role}
              </span>
            )}
          </div>
        </div>

        {/* Assigned lots */}
        {assignedLots.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Lots</p>
            <div className="flex flex-wrap gap-2">
              {assignedLots.map((lot, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-800">{lot.lotCode}</span>
                  {(lot.lotName || lot.name) && <span className="text-xs text-blue-600">{lot.lotName || lot.name}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setTab('profile'); setError(''); setSuccess(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                tab === 'profile'
                  ? 'text-green-700 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Account Info
            </button>
            <button
              onClick={() => { setTab('password'); setError(''); setSuccess(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                tab === 'password'
                  ? 'text-green-700 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Change Password
            </button>
          </div>

          {/* Account Info tab */}
          {tab === 'profile' && (
            <div className="p-4 space-y-3">
              <InfoRow label="Full Name" value={displayName || '—'} />
              <InfoRow label="Email" value={user.email || '—'} />
              <InfoRow label="Role" value={user.role || '—'} />
              <InfoRow label="User ID" value={user._id || user.id || '—'} mono />
            </div>
          )}

          {/* Change Password tab */}
          {tab === 'password' && (
            <form onSubmit={handleChangePassword} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
                autoComplete="current-password"
              />
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew(v => !v)}
                autoComplete="new-password"
                hint="Minimum 8 characters"
              />
              <PasswordField
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showNew}
                onToggle={() => setShowNew(v => !v)}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving…' : 'Change Password'}
              </button>
            </form>
          )}
        </div>

        {/* Load Customers — admin/cherry_picker/superadmin only */}
        {ADMIN_ROLES.includes(user.role) && onLoadCustomers && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Data Management</p>
            <button
              onClick={onLoadCustomers}
              className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold py-3.5 px-4 rounded-xl transition"
            >
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3 3-3" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-blue-900">Load Customers</p>
                <p className="text-xs text-blue-600 font-normal">Import franchisee customer data via CSV</p>
              </div>
              <svg className="w-4 h-4 text-blue-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full border-2 border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>

        <div style={{ height: 'calc(24px + env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono text-xs text-gray-500' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle, autoComplete, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
