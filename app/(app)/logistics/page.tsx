import Link from "next/link";

export default function LogisticsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-emerald-100/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Logistics
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </h1>
          <p className="text-sm text-slate-600 mt-1">Manage inventory, assets, and expenses</p>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/logistics/inventory"
          className="group bg-white hover:bg-slate-50 transition-colors rounded-2xl border border-slate-200 p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">Inventory</h2>
          <p className="text-sm text-slate-500 mt-1">Track assets, supplies, and equipment</p>
        </Link>
        <Link
          href="/logistics/expenses"
          className="group bg-white hover:bg-slate-50 transition-colors rounded-2xl border border-slate-200 p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">Expenses</h2>
          <p className="text-sm text-slate-500 mt-1">Track purchases and spending</p>
        </Link>
      </div>
    </div>
  );
}
