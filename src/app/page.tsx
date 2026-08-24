import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">MERA MAKAN</h1>
          <p className="text-slate-300 mt-2 text-lg">“अपनी ज़मीन, अपनी पहचान”</p>
        </div>
        
        <div className="p-8">
          <p className="text-slate-600 text-center mb-10 text-lg">
            Welcome to the Mera Makan platform. Please select your portal to continue.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link 
              href="/customer"
              className="flex flex-col items-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all group"
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <h2 className="font-semibold text-slate-900">Customer Portal</h2>
              <p className="text-sm text-slate-500 text-center mt-2">Manage your bookings, payments, and ROI</p>
            </Link>

            <Link 
              href="/partner"
              className="flex flex-col items-center p-6 border-2 border-slate-100 rounded-xl hover:border-emerald-600 hover:bg-emerald-50 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h2 className="font-semibold text-slate-900">Partner Portal</h2>
              <p className="text-sm text-slate-500 text-center mt-2">Track sales, royalty tiers, and rewards</p>
            </Link>

            <Link 
              href="/admin"
              className="flex flex-col items-center p-6 border-2 border-slate-100 rounded-xl hover:border-purple-600 hover:bg-purple-50 transition-all group"
            >
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h2 className="font-semibold text-slate-900">Admin Console</h2>
              <p className="text-sm text-slate-500 text-center mt-2">Manage rules, inventory, and payouts</p>
            </Link>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Secure Environment • Protected by RBAC</p>
        </div>
      </main>
    </div>
  );
}
