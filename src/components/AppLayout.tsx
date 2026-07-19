import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LayoutDashboard, Store, ClipboardList, BarChart3, Users, Settings, LogOut, ChevronDown, ChevronRight, Briefcase, CalendarPlus, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

export default function AppLayout() {
  const { userData, user, role, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  

  
  // Track which accordion menus are open. By default, open if current route is inside.
  const isVisitasRoute = location.pathname.startsWith('/visitas');
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'Gestión de Visitas': isVisitasRoute
  });

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['administrador', 'tecnico'] },
    { name: 'Tiendas e Inventario', href: '/tiendas', icon: Store, roles: ['administrador', 'tecnico'] },
    { 
      name: 'Gestión de Visitas', 
      icon: ClipboardList, 
      roles: ['administrador', 'tecnico'],
      subItems: [
        { name: 'Mis Visitas', href: '/visitas/mis-visitas', icon: Briefcase, roles: ['administrador', 'tecnico'] },
        { name: 'Tabla de Visitas', href: '/visitas/tabla', icon: ClipboardList, roles: ['administrador', 'tecnico'] },
        { name: 'Asignar Visita', href: '/visitas/asignar', icon: CalendarPlus, roles: ['administrador', 'tecnico'] },
      ]
    },
    { name: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['administrador'] },

    { name: 'Gestión Personal', href: '/personal', icon: Users, roles: ['administrador'] },
    { name: 'Mi Cuenta', href: '/cuenta', icon: Settings, roles: ['administrador', 'tecnico'] },
    { name: 'Configuración', href: '/configuracion', icon: Settings, roles: ['administrador'] }
  ];

  const filteredNav = navigation.filter(item => role && item.roles.includes(role));

  return (
    <div className="flex h-screen bg-brand-gray overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-black text-white shadow-xl flex flex-col transition-transform duration-300 md:relative md:scale-100 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-brand-dark overflow-hidden flex items-center justify-center border border-white/20">
               <img 
                 src="/logo.png" 
                 alt="Towa" 
                 className="w-full h-full object-cover"
                 onError={(e) => {
                   const t = e.target as HTMLImageElement;
                   t.style.display = 'none';
                   t.parentElement!.innerHTML = '<span class="text-white font-bold text-lg font-serif italic">T.</span>';
                 }}
               />
            </div>
            <span className="text-xl font-bold tracking-tight">TechManager</span>
          </div>
          <button className="md:hidden text-gray-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            
            if (item.subItems) {
               const isOpen = openMenus[item.name];
               // Filter subitems that user role has access to
               const filteredSubItems = item.subItems.filter(sub => role && sub.roles.includes(role));
               if (filteredSubItems.length === 0) return null;

               return (
                 <div key={item.name} className="space-y-1">
                   <button
                     onClick={() => toggleMenu(item.name)}
                     className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                       isOpen ? 'bg-white/5' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                     }`}
                   >
                     <div className="flex items-center">
                       <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isOpen ? 'text-white' : 'text-gray-400'}`} />
                       <span className="font-medium text-sm">{item.name}</span>
                     </div>
                     {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                   </button>
                   
                   <AnimatePresence>
                     {isOpen && (
                       <motion.div
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden"
                       >
                         <div className="pl-11 pr-2 py-1 space-y-1">
                           {filteredSubItems.map(subItem => {
                             const isSubActive = location.pathname.startsWith(subItem.href);
                             const SubIcon = subItem.icon;
                             return (
                               <Link
                                 key={subItem.name}
                                 to={subItem.href}
                                 onClick={() => setSidebarOpen(false)}
                                 className={`flex items-center px-4 py-2.5 rounded-lg transition-colors ${
                                   isSubActive
                                     ? 'bg-brand-hover text-white'
                                     : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                 }`}
                               >
                                 <SubIcon className={`w-4 h-4 mr-3 flex-shrink-0 ${isSubActive ? 'text-white' : 'text-gray-500'}`} />
                                 <span className="font-medium text-sm">{subItem.name}</span>
                               </Link>
                             )
                           })}
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
               );
            }

            // Normal item without subitems
            const isActive = item.href && location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href as string}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-brand-hover text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3 mb-4 px-2">
             <div className="w-10 h-10 rounded-full bg-brand-hover flex items-center justify-center border border-white/20">
                <span className="text-white font-bold text-sm">
                  {userData?.nombre ? userData.nombre[0].toUpperCase() : user?.user_metadata?.full_name ? user.user_metadata.full_name[0].toUpperCase() : 'U'}
                </span>
             </div>
             <div>
                <p className="text-sm font-medium text-white truncate max-w-[140px]">{userData?.nombre || user?.user_metadata?.full_name || 'Usuario'}</p>
                <p className="text-xs text-gray-400 capitalize">{userData?.rol === 'tecnico' ? 'Técnico' : userData?.rol}</p>
             </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Cerrar Sesión
          </button>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header (Mobile & Context) */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-sm z-10 w-full">
          <div className="flex items-center">
            <button
              className="md:hidden p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800">
              {filteredNav.find(n => location.pathname.startsWith(n.href))?.name || 'Dashboard'}
            </h1>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto bg-brand-gray relative w-full flex flex-col">
            {userData && (!userData.pais || !userData.telefono) && location.pathname !== '/cuenta' && (
                <div className="bg-[#163f3a] text-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between shadow-md">
                    <div className="flex items-center text-sm font-medium mb-3 sm:mb-0">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0" />
                        <span>Es necesario que completes tu perfil (País y Teléfono) para habilitar todas las funciones.</span>
                    </div>
                    <Link to="/cuenta" className="whitespace-nowrap px-4 py-1.5 bg-white text-[#163f3a] text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors">
                        Completar Perfil
                    </Link>
                </div>
            )}
            <div className="p-4 sm:p-6 lg:p-8 flex-1">
                <Outlet />
            </div>
        </main>
      </div>
    </div>
  );
}
