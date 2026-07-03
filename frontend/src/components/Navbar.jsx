import { Menu, Bell } from 'lucide-react';

export default function Navbar({ onMenuClick, title }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden btn-ghost p-2 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-ghost p-2 rounded-lg relative">
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
