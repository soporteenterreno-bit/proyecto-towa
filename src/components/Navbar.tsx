import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function Navbar() {
  const { user, role, logout } = useAuth();

  return (
    <nav className="bg-black text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo Placeholder */}
            <div className="flex-shrink-0 flex items-center">
              <img src="/logo.png" alt="Towa Logo" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
              <span className="ml-3 font-bold text-xl tracking-wider">STORE MANAGER</span>
            </div>
          </div>
          <div className="flex items-center">
            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium">{user.email}</span>
                  <span className="text-xs text-green-400 font-bold capitalize">{role}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1c322e]"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5 text-gray-300 hover:text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
