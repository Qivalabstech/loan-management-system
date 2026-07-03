import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, FileText, CreditCard, Building2,
  Calculator, AlertTriangle, BarChart3, LogOut, TrendingUp
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/leads', label: 'Leads', icon: Users, roles: ['Admin','Loan Officer'] },
  { to: '/applications', label: 'Applications', icon: FileText, roles: ['Admin','Loan Officer','Credit Analyst'] },
  { to: '/credit-scoring', label: 'Credit Scoring', icon: CreditCard, roles: ['Admin','Credit Analyst'] },
  { to: '/loan-accounts', label: 'Loan Accounts', icon: Building2, roles: ['Admin','Loan Officer'] },
  { to: '/emi-calculator', label: 'EMI Calculator', icon: Calculator, roles: null },
  { to: '/collections', label: 'Collections', icon: AlertTriangle, roles: ['Admin','Collections Agent'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['Admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  const visible = navItems.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <TrendingUp className="w-6 h-6 text-blue-400 mr-2" />
          <span className="font-bold text-lg">LMS Portal</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {visible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {user?.name?.[0] || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
