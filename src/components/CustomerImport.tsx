import { useState, useRef, useEffect } from 'react';
import { authApi, customerApi, type ImportResult } from '../api/client';

interface CustomerImportProps {
  user: {
    role: string;
    ownerCompanyId?: string;
    company?: { _id?: string; companyId?: string; companyName?: string };
    fullName?: string;
  };
  onBack: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'result';

interface ParsedRow {
  customerName: string;
  address: string;
  lotCode: string;
  phone?: string;
  email?: string;
  customerType?: string;
  customerId?: string;
  _error?: string;
}

const ADMIN_ROLES = ['admin', 'cherry_picker', 'superadmin'];
const CSV_TEMPLATE_HEADERS = 'customerName,address,lotCode,phone,email,customerType,customerId';
const CSV_TEMPLATE_ROWS = [
  'Adewale Okafor,14 Bode Thomas Street Ibadan,27,08012345678,adewale@example.com,residential,',
  'Funke Adeyemi,22 Ring Road Ibadan,27,08098765432,,commercial,EXT-002',
];

/** Normalise a CSV header to a known field name */
function normaliseHeader(h: string): string {
  const map: Record<string, string> = {
    customername: 'customerName',
    customer_name: 'customerName',
    name: 'customerName',
    address: 'address',
    Address: 'address',
    lotcode: 'lotCode',
    lot_code: 'lotCode',
    lot_id: 'lotCode',
    Lot_ID: 'lotCode',
    phone: 'phone',
    Phone: 'phone',
    phonenumber: 'phone',
    phone_number: 'phone',
    email: 'email',
    Email: 'email',
    customertype: 'customerType',
    customer_type: 'customerType',
    type: 'customerType',
    customerid: 'customerId',
    customer_id: 'customerId',
    externalid: 'customerId',
    external_id: 'customerId',
  };
  return map[h.toLowerCase().trim()] ?? map[h.trim()] ?? h.trim();
}

/** Parse CSV text into rows, handling BOM and quoted fields */
function parseCsv(text: string): ParsedRow[] {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(normaliseHeader);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    const parsed: ParsedRow = {
      customerName: row.customerName ?? '',
      address: row.address ?? '',
      lotCode: row.lotCode ?? '',
      phone: row.phone || undefined,
      email: row.email || undefined,
      customerType: row.customerType || undefined,
      customerId: row.customerId || undefined,
    };
    // Validate required fields
    if (!parsed.customerName || !parsed.address || !parsed.lotCode) {
      parsed._error = 'Missing required field(s): ' +
        [!parsed.customerName && 'customerName', !parsed.address && 'address', !parsed.lotCode && 'lotCode']
          .filter(Boolean).join(', ');
    }
    rows.push(parsed);
  }
  return rows;
}

export default function CustomerImport({ user, onBack }: CustomerImportProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [ownerCompanyId, setOwnerCompanyId] = useState(user.ownerCompanyId ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const KNOWN_COMPANIES = [
    { label: 'URBAN SPIRIT', value: 'URBAN-SPIRIT' },
    { label: 'W ABDULSALAM MECH', value: 'WAS-061' },
    { label: 'SAYOTOM', value: 'SAYOTOM' },
    { label: 'MAIA RECYCLING', value: 'MAIA-RECYCLING' },
    { label: 'ECO SOLUTIONS', value: 'ECO-SOLUTIONS' },
    { label: 'CUMMINGTONITE', value: 'CUMMINGTONITE' },
    { label: 'MOTTAINAI', value: 'MOTTAINAI' },
    { label: 'MORTAD', value: 'MORTAD' },
    { label: 'AFT OKULEYE', value: 'AFT-OKULEYE' },
    { label: 'TINKUB', value: 'TINKUB' },
    { label: 'ADESKUNLAR', value: 'ADESKUNLAR' },
    { label: 'DIC', value: 'DIC' },
    { label: 'EOA PEST CONTROL', value: 'EOA-PEST-CONTROL' },
    { label: 'TEST FRANCHISOR', value: 'TEST-FRANCHISOR' },
    { label: 'TEST FRANCHISEE', value: 'TEST-FRANCHISEE' },
    { label: 'TEST COMPANY', value: 'TESTCO' },
  ];
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For non-admin users, try to derive company ID from their profile on mount
  useEffect(() => {
    if (!ownerCompanyId) {
      authApi.me().then(freshUser => {
        const freshId =
          freshUser.ownerCompanyId ||
          (freshUser.company as any)?.companyId ||
          (freshUser.company as any)?._id;
        if (freshId) setOwnerCompanyId(freshId);
      }).catch(() => {});
    }
  }, []);

  const isAdminRole = ADMIN_ROLES.includes(user.role);
  const isSuperAdmin = user.role === 'superadmin';
  const validRows = rows.filter(r => !r._error);
  const invalidRows = rows.filter(r => r._error);

  const handleDownloadTemplate = () => {
    const content = [CSV_TEMPLATE_HEADERS, ...CSV_TEMPLATE_ROWS].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setParseError('');
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = parseCsv(text);
        if (parsed.length === 0) {
          setParseError('No data rows found. Make sure the file has a header row and at least one data row.');
          return;
        }
        setRows(parsed);
        setStep('preview');
      } catch {
        setParseError('Failed to parse CSV. Please check the file format and try again.');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!ownerCompanyId.trim()) {
      setImportError('Company ID is required. Please enter your company identifier (e.g. URBAN-SPIRIT).');
      return;
    }
    if (validRows.length === 0) return;

    setStep('importing');
    setImportError('');

    if (!file) return;

    try {
      const result = await customerApi.importCsv(file, ownerCompanyId.trim());
      setImportResult(result);
      setStep('result');
    } catch (err: any) {
      const status: number = err.response?.status ?? 0;
      const backendMsg: string =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        'Import failed. Please try again.';
      let displayMsg = `[HTTP ${status}] ${backendMsg}`;
      if (status === 403) {
        displayMsg = `Permission denied (403): Your account role does not have permission to import customers. Ask your system administrator to grant you the \'cherry_picker\' or \'superadmin\' role. (Backend: ${backendMsg})`;
      } else if (status === 404) {
        displayMsg = `Import endpoint not found (404). The server may not support this feature. (Backend: ${backendMsg})`;
      }
      setImportError(displayMsg);
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setRows([]);
    setParseError('');
    setImportResult(null);
    setImportError('');
    setShowErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Access guard ──────────────────────────────────────────────────────────────
  if (!isAdminRole) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">Load Customers</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Admin Access Required</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Loading customers requires an admin, cherry_picker, or superadmin account.
            Contact your administrator to import customer data before your enumeration session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Load Customers</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isSuperAdmin ? 'Superadmin' : user.role === 'cherry_picker' ? 'Cherry Picker' : 'Admin'} •{' '}
              {user.company?.companyName ?? ownerCompanyId}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(24px + var(--sab, env(safe-area-inset-bottom, 0px)))' }}>
        <div className="p-6 space-y-5">

          {/* ── STEP: Upload ─────────────────────────────────────────────────── */}
          {step === 'upload' && (
            <>
              {/* Role badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isSuperAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current"></span>
                {isSuperAdmin ? 'Superadmin access' : user.role === 'cherry_picker' ? 'Cherry Picker access' : 'Admin access'}
              </div>

              {/* Company ID field — editable for superadmin, read-only for others */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Company ID (ownerCompanyId)
                </label>
                <select
                  value={KNOWN_COMPANIES.some(c => c.value === ownerCompanyId) ? ownerCompanyId : ''}
                  onChange={e => { if (e.target.value) setOwnerCompanyId(e.target.value); }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white mb-2"
                >
                  <option value="">— Select a company —</option>
                  {KNOWN_COMPANIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label} ({c.value})</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={ownerCompanyId}
                  onChange={e => setOwnerCompanyId(e.target.value)}
                  placeholder="e.g. URBAN-SPIRIT"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Select from the list or type the exact Company ID. Must match exactly (case-sensitive).
                </p>
              </div>

              {/* Step 1: Download template */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">Step 1 — Download the CSV template</p>
                <p className="text-xs text-blue-700 mb-3">
                  Fill in your customer list using the template. Required columns: <strong>customerName</strong>, <strong>address</strong>, <strong>lotCode</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 bg-white border border-blue-300 text-blue-700 font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-blue-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV Template
                </button>
              </div>

              {/* Step 2: Upload CSV */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Step 2 — Upload your filled CSV file</p>
                {parseError && (
                  <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {parseError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-blue-400 hover:bg-blue-50 transition"
                >
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Tap to select CSV file</p>
                    <p className="text-xs text-gray-500 mt-1">Max 5 MB · CSV format only</p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* CSV format reference */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">CSV Column Reference</p>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left pb-1 pr-3">Column</th>
                        <th className="text-left pb-1 pr-3">Required</th>
                        <th className="text-left pb-1">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {[
                        ['customerName', '✅', 'Full name of the customer'],
                        ['address', '✅', 'Physical address of premises'],
                        ['lotCode', '✅', 'Lot number (e.g. 27)'],
                        ['phone', 'Optional', 'Contact number'],
                        ['email', 'Optional', 'Email address'],
                        ['customerType', 'Optional', 'residential or commercial'],
                        ['customerId', 'Optional', 'Your own reference ID'],
                      ].map(([col, req, note]) => (
                        <tr key={col} className="border-t border-gray-100">
                          <td className="py-1 pr-3 font-mono text-blue-700">{col}</td>
                          <td className="py-1 pr-3">{req}</td>
                          <td className="py-1 text-gray-500">{note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── STEP: Preview ─────────────────────────────────────────────────── */}
          {step === 'preview' && (
            <>
              {/* File summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-900">{file?.name}</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {rows.length} rows parsed · {validRows.length} valid · {invalidRows.length} with errors
                  </p>
                </div>
              </div>

              {/* Validation errors */}
              {invalidRows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    ⚠️ {invalidRows.length} row{invalidRows.length > 1 ? 's' : ''} will be skipped (missing required fields)
                  </p>
                  <p className="text-xs text-amber-700">These rows will not be imported. Fix the CSV and re-upload to include them.</p>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {importError}
                </div>
              )}

              {/* Preview table — first 5 valid rows */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Preview (first {Math.min(5, validRows.length)} of {validRows.length} valid rows)
                </p>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="text-xs w-full min-w-[400px]">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Name', 'Address', 'Lot', 'Phone', 'Type'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-gray-600 font-semibold border-b border-gray-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-3 py-2 text-gray-900 font-medium">{row.customerName}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{row.address}</td>
                          <td className="px-3 py-2 text-gray-700">{row.lotCode}</td>
                          <td className="px-3 py-2 text-gray-600">{row.phone ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.customerType === 'commercial'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {row.customerType ?? 'residential'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validRows.length > 5 && (
                  <p className="text-xs text-gray-500 mt-1.5 text-center">
                    + {validRows.length - 5} more rows not shown
                  </p>
                )}
              </div>

              {/* Company ID confirmation */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Importing to company</p>
                <p className="text-sm font-mono font-semibold text-gray-900">{ownerCompanyId}</p>
                {user.company?.companyName && (
                  <p className="text-xs text-gray-500">{user.company.companyName}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3 3-3" />
                  </svg>
                  Import {validRows.length} Customer{validRows.length !== 1 ? 's' : ''}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition"
                >
                  Choose Different File
                </button>
              </div>
            </>
          )}

          {/* ── STEP: Importing ──────────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">Importing customers…</p>
                <p className="text-sm text-gray-500 mt-1">This may take a moment for large files.</p>
              </div>
            </div>
          )}

          {/* ── STEP: Result ─────────────────────────────────────────────────── */}
          {step === 'result' && importResult && (
            <>
              {/* Summary card */}
              <div className={`rounded-xl p-5 border-2 ${
                importResult.failed === 0
                  ? 'bg-green-50 border-green-400'
                  : 'bg-amber-50 border-amber-400'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {importResult.failed === 0 ? (
                    <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <p className={`text-base font-bold ${importResult.failed === 0 ? 'text-green-900' : 'text-amber-900'}`}>
                    Import Complete
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                    <p className="text-2xl font-black text-green-700">{importResult.created}</p>
                    <p className="text-xs text-gray-600 mt-0.5">Created</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                    <p className="text-2xl font-black text-blue-700">{importResult.updated}</p>
                    <p className="text-xs text-gray-600 mt-0.5">Updated</p>
                  </div>
                  <div className={`bg-white rounded-lg p-3 text-center border ${importResult.failed > 0 ? 'border-red-200' : 'border-gray-200'}`}>
                    <p className={`text-2xl font-black ${importResult.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{importResult.failed}</p>
                    <p className="text-xs text-gray-600 mt-0.5">Failed</p>
                  </div>
                </div>
              </div>

              {/* Error details */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={() => setShowErrors(v => !v)}
                    className="flex items-center justify-between w-full"
                  >
                    <p className="text-sm font-semibold text-red-900">
                      {importResult.errors.length} error{importResult.errors.length > 1 ? 's' : ''} — tap to {showErrors ? 'hide' : 'view'}
                    </p>
                    <svg className={`w-4 h-4 text-red-600 transition-transform ${showErrors ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showErrors && (
                    <ul className="mt-3 space-y-1.5">
                      {importResult.errors.map((err, i) => (
                        <li key={i} className="text-xs text-red-700 bg-white border border-red-100 rounded-lg px-3 py-2">
                          {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3 3-3" />
                  </svg>
                  Import Another File
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
