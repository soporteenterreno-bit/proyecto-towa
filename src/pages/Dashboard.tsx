import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { Store, UserCheck, AlertTriangle, CalendarCheck, Clock, Timer, PlayCircle } from 'lucide-react';

export default function Dashboard() {
  const { userData } = useAuth();
  const [stats, setStats] = useState({
    totalTiendas: 0, totalTecnicos: 0, visitasProg: 0, visitasFalla: 0,
    visitasPte: 0, visitasDone: 0, visitasEnCurso: 0, tiempoGestionStr: '---'
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchDash = async () => {
        // Aggregate stores
        const { data: tiendasArr } = await supabase.from('tiendas').select('*');
        
        // Aggregate techs
        const { data: uSnap } = await supabase.from('users').select('id').eq('rol', 'tecnico');
        
        // Aggregate visits
        const { data: visitasArr } = await supabase.from('visitas').select('*');

        const tiendasList = tiendasArr || [];
        const visitasList = visitasArr || [];

        const vProg = visitasList.filter(v => v.tipo === 'Programada').length;
        const vFalla = visitasList.filter(v => v.tipo === 'Falla').length;
        const vPte = visitasList.filter(v => v.status === 'Pendiente').length;
        const vEnCurso = visitasList.filter(v => v.status === 'En Curso').length;
        const vDone = visitasList.filter(v => v.status === 'Completada').length;

        // Tiempo de gestión promedio (minutos entre fecha_inicio y fecha_fin)
        const completedWithTimes = visitasList.filter(v =>
            v.status === 'Completada' && v.fecha_inicio && v.fecha_fin
        );
        const duraciones = completedWithTimes.map(v => {
            const fin = new Date(v.fecha_fin).getTime();
            const ini = new Date(v.fecha_inicio).getTime();
            return (fin - ini) / 60000;
        }).filter(d => d > 0 && d < 1440);
        const avgMin = duraciones.length > 0
            ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
            : 0;
        const tiempoGestionStr = avgMin === 0
            ? '---'
            : avgMin >= 60
                ? `${Math.floor(avgMin / 60)}h ${avgMin % 60}m`
                : `${avgMin} min`;

        setStats({
            totalTiendas: tiendasList.length,
            totalTecnicos: uSnap ? uSnap.length : 0,
            visitasProg: vProg, visitasFalla: vFalla,
            visitasPte: vPte, visitasDone: vDone,
            visitasEnCurso: vEnCurso, tiempoGestionStr
        });

        // Chart Data: Tiendas por Pais
        const paisesMap: any = {};
        tiendasList.forEach(t => {
            paisesMap[t.pais] = (paisesMap[t.pais] || 0) + 1;
        });
        const formattedChart = Object.keys(paisesMap).map(p => ({
            name: p || 'Sin Asignar',
            Tiendas: paisesMap[p]
        }));
        
        // Sort descending
        formattedChart.sort((a,b) => b.Tiendas - a.Tiendas);
        setChartData(formattedChart);
    };
    fetchDash();
  }, []);

  const totalVisitasCircular = stats.visitasDone + stats.visitasPte;
  const percentDone = totalVisitasCircular === 0 ? 0 : Math.round((stats.visitasDone / totalVisitasCircular) * 100);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      {userData && (
          <div className="bg-brand-dark p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden mb-8">
              <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">¡Bienvenido de nuevo, {userData.nombre.split(' ')[0]}!</h1>
                      <p className="text-white/80 text-sm sm:text-base">Has iniciado sesión como <span className="font-bold text-white capitalize">{userData.rol === 'tecnico' ? 'Técnico' : userData.rol}</span>. Aquí está el resumen de la operación.</p>
                  </div>
              </div>
              {/* Decorative shapes */}
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 right-20 w-32 h-32 bg-brand-hover/20 rounded-full blur-2xl"></div>
          </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-4 px-1">Métricas Generales</h2>

      {/* Row 1: Infraestructura y personal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Store className="w-6 h-6 text-indigo-500" />} title="Total Tiendas" value={stats.totalTiendas} bg="bg-indigo-50" />
          <StatCard icon={<UserCheck className="w-6 h-6 text-emerald-600" />} title="Técnicos Activos" value={stats.totalTecnicos} bg="bg-emerald-50" />
          <StatCard icon={<CalendarCheck className="w-6 h-6 text-brand-dark" />} title="Visitas Completadas" value={stats.visitasDone} bg="bg-green-50" />
          <StatCard icon={<AlertTriangle className="w-6 h-6 text-red-500" />} title="Atenciones de Falla" value={stats.visitasFalla} bg="bg-red-50" />
      </div>

      {/* Row 2: Estado y tiempos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <StatCard icon={<PlayCircle className="w-6 h-6 text-blue-500" />} title="Visitas En Curso" value={stats.visitasEnCurso} bg="bg-blue-50" />
          <StatCard icon={<Clock className="w-6 h-6 text-amber-500" />} title="Visitas Pendientes" value={stats.visitasPte} bg="bg-amber-50" />
          <StatCard icon={<Timer className="w-6 h-6 text-purple-500" />} title="Tiempo Promedio de Gestión" value={stats.tiempoGestionStr} bg="bg-purple-50" />
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
             <h3 className="text-lg font-bold text-gray-700 mb-6">Mapeo de Tiendas por País</h3>
             <div className="flex-1 w-full space-y-4">
                 {chartData.length > 0 ? chartData.map((item, index) => (
                    <div key={index} className="w-full">
                       <div className="flex justify-between items-end mb-1">
                          <span className="text-sm font-medium text-gray-600">{item.name}</span>
                          <span className="text-sm font-bold text-gray-800">{item.Tiendas}</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className="bg-brand-dark h-3 rounded-full" style={{ width: `${Math.min(100, (item.Tiendas / Math.max(1, chartData[0]?.Tiendas)) * 100)}%` }}></div>
                       </div>
                    </div>
                 )) : (
                    <p className="text-gray-400 text-sm italic">Sin datos registrados.</p>
                 )}
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-700 mb-6">Estado General de Visitas</h3>
             <div className="flex flex-col items-center justify-center p-8">
                
                {/* Custom CSS Donut Chart */}
                <div className="relative w-48 h-48 rounded-full bg-gray-100 flex items-center justify-center" 
                     style={{ background: `conic-gradient(#10b981 ${percentDone}%, #f59e0b ${percentDone}% 100%)` }}>
                   <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      <span className="text-3xl font-extrabold text-gray-800">{percentDone}%</span>
                      <span className="text-xs text-gray-500 font-medium uppercase mt-1">Completadas</span>
                   </div>
                </div>

                <div className="flex space-x-6 mt-8">
                   <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                      <span className="text-sm font-medium text-gray-600">Completadas ({stats.visitasDone})</span>
                   </div>
                   <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                      <span className="text-sm font-medium text-gray-600">Pendientes ({stats.visitasPte})</span>
                   </div>
                </div>
             </div>
          </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, bg }: { icon: React.ReactNode, title: string, value: string|number, bg: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className={`p-4 rounded-xl ${bg}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    );
}
