import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, MapPin, Search, Package, Download, Upload, XCircle, Filter, FileText, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomSelect } from '../components/CustomSelect';
import { usePaisesTiendas } from '../hooks/usePaisesTiendas';
import { parseCsv } from '../utils/csv';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Tiendas() {
  usePageTitle('Tiendas');
  const { showAlert, showConfirm } = useNotification();
  const { userData, role } = useAuth();
  const { paises } = usePaisesTiendas();
  const navigate = useNavigate();
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTienda, setEditingTienda] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    id_tienda: '', tienda: '', provincia_tienda: '', ciudad_tienda: '', municipio_tienda: '', domicilio_tienda: '', pais_tienda: userData?.pais || '', telefono_tienda: '', correo_tienda: '', estatus: 'Tienda Activa',
    coord_lat: '', coord_lng: '', tipo: 'Tienda'
  });
  
  // Filtering States
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(userData?.pais || '');
  const [filterCity, setFilterCity] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Import Mass CSV States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchTiendas = async () => {
    try {
        const { data, error } = await supabase.from('tiendas').select('*').order('id_tienda', { ascending: true });
        if (error) throw error;
        setTiendas(data || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchTiendas(); }, []);

  const buildTiendaData = () => {
    const { coord_lat, coord_lng, ...rest } = formData;
    const data: any = {
      ...rest,
      id_tienda: parseInt(rest.id_tienda as string, 10)
    };
    if (coord_lat && coord_lng) {
      data.coordenadas_tienda = { lat: parseFloat(coord_lat), lng: parseFloat(coord_lng) };
    }
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = buildTiendaData();
      if (editingTienda) {
        await supabase.from('tiendas').update(data).eq('id', editingTienda.id);
      } else {
        await supabase.from('tiendas').insert(data);
      }
      setIsModalOpen(false);
      fetchTiendas();
      showAlert("Tienda guardada exitosamente", "success");
    } catch (e) { console.error(e); showAlert("Error guardando tienda", "error"); }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm("¿Eliminar tienda?"))) return;
    try {
      await supabase.from('tiendas').delete().eq('id', id);
      fetchTiendas();
      showAlert("Tienda eliminada", "success");
    } catch (e) { console.error(e); showAlert("Error al eliminar tienda", "error"); }
  };

  // Helper arrays for cascaded dropdowns based on existing stores (not all generic ones to avoid empty lists)
  const uniqueCountriesFilter = Array.from(new Set(tiendas.map(t => t.pais_tienda))).filter(Boolean).sort();
  const uniqueCitiesFilter = filterCountry 
    ? Array.from(new Set(tiendas.filter(t => t.pais_tienda === filterCountry).map(t => t.ciudad_tienda))).filter(Boolean).sort()
    : [];

  const filteredTiendas = tiendas.filter(t => {
    const term = globalSearch.toLowerCase();
    const tiendaDisplay = t.tienda || t.domicilio_tienda || ('Tienda ' + t.id_tienda);
    const matchesSearch = !globalSearch || (
      (t.id_tienda?.toString() || '').toLowerCase().includes(term) ||
      (t.pais_tienda || '').toLowerCase().includes(term) ||
      (t.ciudad_tienda || '').toLowerCase().includes(term) ||
      (tiendaDisplay).toLowerCase().includes(term) ||
      (t.domicilio_tienda || '').toLowerCase().includes(term)
    );
    const matchesCountry = !filterCountry || t.pais_tienda === filterCountry;
    const matchesCity = !filterCity || t.ciudad_tienda === filterCity;
    const matchesTipo = !filterTipo || t.tipo === filterTipo;
    
    return matchesSearch && matchesCountry && matchesCity && matchesTipo;
  });

  const clearFilters = () => {
    setGlobalSearch('');
    setFilterCountry('');
    setFilterCity('');
    setFilterTipo('');
  };

  const downloadCSV = () => {
    const headers = ["ID Tienda", "Tipo", "Tienda", "Provincia", "Ciudad", "Municipio", "Domicilio", "País", "Coordenadas", "Teléfono", "Correo", "Estatus"];
    const csvRows = [headers.join(",")];

    filteredTiendas.forEach(t => {
        const coords = t.coordenadas_tienda ? `${t.coordenadas_tienda.lat},${t.coordenadas_tienda.lng}` : '';
        const row = [
            `"${t.id_tienda || ''}"`,
            `"${t.tipo || 'Tienda'}"`,
            `"${t.tienda || ''}"`,
            `"${t.provincia_tienda || ''}"`,
            `"${t.ciudad_tienda || ''}"`,
            `"${t.municipio_tienda || ''}"`,
            `"${t.domicilio_tienda || ''}"`,
            `"${t.pais_tienda || ''}"`,
            `"${coords}"`,
            `"${t.telefono_tienda || ''}"`,
            `"${t.correo_tienda || ''}"`,
            `"${t.estatus || ''}"`
        ];
        csvRows.push(row.join(","));
    });

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' }); // Add BOM for UTF-8 Excel handling
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Directorio_Tiendas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImporting(false);
      return;
    }
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCsv(text);
        if (rows.length < 2) {
          showAlert('El archivo no contiene datos válidos.', 'error');
          return;
        }

        const toInsert = [];
        let importedCount = 0;
        
        for(let i = 1; i < rows.length; i++) {
           const cols = rows[i];
           if(cols.length >= 7) {
             const idNum = parseInt(cols[0], 10);
             if(isNaN(idNum)) continue;

             const hasTipo = cols[1] === 'Tienda' || cols[1] === 'Oficina';
             const offset = hasTipo ? 1 : 0;

             const tiendaData: any = {
                 id_tienda: idNum,
                 tipo: hasTipo ? cols[1] : 'Tienda',
                 tienda: cols[1 + offset] || '',
                 provincia_tienda: cols[2 + offset] || '',
                 ciudad_tienda: cols[3 + offset] || '',
                 municipio_tienda: cols[4 + offset] || '',
                 domicilio_tienda: cols[5 + offset] || '',
                 pais_tienda: cols[6 + offset] || '',
                 telefono_tienda: cols[8 + offset] || '',
                 correo_tienda: cols[9 + offset] || '',
                 estatus: cols[10 + offset] || 'Tienda Activa',
             };
             const coordsRaw = cols[7 + offset] || '';
             const parts = coordsRaw.split(/[;,]/).map(p => parseFloat(p.trim()));
             if (parts.length === 2 && parts.every(n => !isNaN(n))) {
               tiendaData.coordenadas_tienda = { lat: parts[0], lng: parts[1] };
             }
             toInsert.push(tiendaData);
             importedCount++;
           }
        }
        
        if (toInsert.length > 0) {
           const { error } = await supabase.from('tiendas').upsert(toInsert, { onConflict: 'id_tienda' });
           if (error) throw error;
           
           showAlert(`Se importaron ${importedCount} tiendas exitosamente.`, 'success');
           fetchTiendas();
        } else {
           showAlert('No se encontraron filas con el formato mínimo requerido.', 'warning');
        }

      } catch (err) {
        console.error(err);
        showAlert('Ocurrió un error al procesar el archivo CSV.', 'error');
      } finally {
        setShowImportModal(false);
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      showAlert('Hubo un error al leer el archivo.', 'error');
      setImporting(false);
      setShowImportModal(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-800">Directorio de Tiendas</h2>
        
        <div className="flex space-x-2 w-full sm:w-auto">
             <button
               onClick={() => setShowImportModal(true)}
               className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-brand-dark transition-colors whitespace-nowrap text-sm font-semibold shadow-sm"
               title="Importar CSV de Tiendas"
             >
               <Upload className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Importar CSV</span>
             </button>

          {tiendas.length > 0 && (
             <button
               onClick={downloadCSV}
               className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-brand-dark transition-colors whitespace-nowrap text-sm font-semibold shadow-sm"
               title="Exportar listado actual a CSV"
             >
               <Download className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Exportar CSV</span>
             </button>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 cursor-pointer" />
            <input 
              type="text" placeholder="Búsqueda universal..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-dark outline-none text-sm"
            />
            {globalSearch && (
               <XCircle onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer hover:text-gray-600" />
            )}
          </div>

          <button 
             onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
             className={`flex items-center px-4 py-2 border rounded-xl transition-colors whitespace-nowrap text-sm font-semibold shadow-sm ${showAdvancedFilters || filterCountry || filterCity || filterTipo ? 'bg-brand-gray border-brand-dark text-brand-dark' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
             <Filter className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Filtros</span>
          </button>

            <button 
              onClick={() => { setEditingTienda(null); setFormData({id_tienda: '', tienda: '', provincia_tienda: '', ciudad_tienda: '', municipio_tienda: '', domicilio_tienda: '', pais_tienda: '', telefono_tienda: '', correo_tienda: '', estatus: 'Tienda Activa', coord_lat: '', coord_lng: '', tipo: 'Tienda'}); setIsModalOpen(true); }}
              className="flex items-center px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-hover transition-colors whitespace-nowrap text-sm font-semibold shadow-sm"
            >
              <Plus className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Nueva</span>
            </button>
        </div>
      </div>

      {/* Advanced Filters Bar */}
      {(showAdvancedFilters || filterCountry || filterCity) && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-dark/20 flex flex-col md:flex-row gap-4 items-end animate-in fade-in slide-in-from-top-2">
           <div className="w-full md:w-1/3">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Filtrar por País</label>
              <CustomSelect 
                  value={filterCountry} 
                  onChange={(val: string) => { setFilterCountry(val); setFilterCity(''); }} 
                  options={[
                      { value: '', label: 'Cualquier País' },
                      ...uniqueCountriesFilter.map(p => ({ value: p as string, label: p as string }))
                  ]}
                  className="w-full text-sm border-gray-300 border p-2 rounded-lg focus:ring-brand-dark focus:border-brand-dark bg-gray-50"
              />
           </div>
           <div className="w-full md:w-1/4">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Filtrar por Ciudad</label>
              <CustomSelect 
                  value={filterCity} 
                  onChange={(val: string) => setFilterCity(val)} 
                  disabled={!filterCountry} 
                  options={[
                      { value: '', label: filterCountry ? 'Cualquier Ciudad' : 'Primero elige un país' },
                      ...uniqueCitiesFilter.map(c => ({ value: c as string, label: c as string }))
                  ]}
                  className="w-full text-sm border-gray-300 border p-2 rounded-lg focus:ring-brand-dark focus:border-brand-dark disabled:bg-gray-100 disabled:opacity-50 bg-gray-50"
              />
           </div>
           <div className="w-full md:w-1/4">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Tipo</label>
              <CustomSelect 
                  value={filterTipo} 
                  onChange={(val: string) => setFilterTipo(val)} 
                  options={[
                      { value: '', label: 'Cualquier Tipo' },
                      { value: 'Tienda', label: 'Tienda' },
                      { value: 'Oficina', label: 'Oficina' }
                  ]}
                  className="w-full text-sm border-gray-300 border p-2 rounded-lg focus:ring-brand-dark focus:border-brand-dark bg-gray-50"
              />
           </div>
           <div className="w-full md:w-auto">
              <button onClick={clearFilters} disabled={!globalSearch && !filterCountry && !filterCity && !filterTipo} className="w-full md:w-auto px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
                  Limpiar Filtros
              </button>
           </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando tiendas...</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max relative">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-sm font-semibold text-gray-600">ID Tienda</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">País</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Nombre de Tienda</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Domicilio</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Ciudad</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Provincia</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Estatus</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center sticky right-0 bg-gray-50 z-10 border-l border-gray-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTiendas.map((tienda) => {
                      const missingFields = [];
                      if (!tienda.domicilio_tienda) missingFields.push('Domicilio');
                      if (!tienda.ciudad_tienda) missingFields.push('Ciudad');
                      if (!tienda.provincia_tienda) missingFields.push('Provincia');
                      if (!tienda.pais_tienda) missingFields.push('País');
                      if (!tienda.coordenadas_tienda?.lat || !tienda.coordenadas_tienda?.lng) missingFields.push('Coordenadas GPS');
                      const isMissingData = missingFields.length > 0;
                      const tiendaDisplay = tienda.tienda || '—';
                      return (
                      <tr key={tienda.id} className="border-b border-gray-100 group hover:shadow-md transition-all">
                          <td className="p-4 font-mono text-sm group-hover:bg-brand-dark group-hover:text-white transition-colors">
                              <div className="flex items-center gap-2">
                                  {isMissingData && (
                                      <div title={`Faltan datos por completar:\n• ${missingFields.join('\n• ')}`} className="text-yellow-500 group-hover:text-yellow-300 cursor-help flex-shrink-0">
                                          <AlertTriangle className="w-4 h-4" />
                                      </div>
                                  )}
                                  <span>{tienda.id_tienda}</span>
                              </div>
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold transition-colors ${tienda.tipo === 'Oficina' ? 'bg-blue-100 text-blue-800 group-hover:bg-blue-500 group-hover:text-white' : 'bg-gray-100 text-gray-800 group-hover:bg-white group-hover:text-gray-800'}`}>
                              {tienda.tipo || 'Tienda'}
                            </span>
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-gray text-brand-dark group-hover:bg-white group-hover:text-brand-dark border border-brand-dark/15 transition-colors">
                              {tienda.pais_tienda || userData?.pais || '—'}
                            </span>
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <div className="text-sm font-semibold text-gray-700 group-hover:text-white transition-colors">{tiendaDisplay}</div>
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <div className="text-xs text-gray-600 group-hover:text-gray-200 truncate max-w-[200px] transition-colors" title={tienda.domicilio_tienda}>{tienda.domicilio_tienda || '—'}</div>
                            {tienda.coordenadas_tienda?.lat && (
                              <div className="mt-1"><span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 group-hover:bg-green-500 group-hover:text-white transition-colors" title={`GPS: ${tienda.coordenadas_tienda.lat}, ${tienda.coordenadas_tienda.lng}`}>GPS ✓</span></div>
                            )}
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <div className="text-sm text-gray-700 font-medium group-hover:text-white transition-colors">{tienda.ciudad_tienda || '—'}</div>
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <div className="text-sm text-gray-600 group-hover:text-gray-200 transition-colors">{tienda.provincia_tienda || '—'}</div>
                            {tienda.municipio_tienda && <div className="text-xs text-gray-400 group-hover:text-gray-300 mt-0.5 transition-colors">{tienda.municipio_tienda}</div>}
                          </td>
                          <td className="p-4 group-hover:bg-brand-dark transition-colors">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 inline-block text-[10px] sm:text-xs font-semibold rounded-full uppercase tracking-wider transition-colors ${
                                    tienda.estatus === 'Tienda Activa' ? 'bg-green-100 text-green-800 group-hover:bg-green-500 group-hover:text-white' :
                                    tienda.estatus === 'Tienda Existente' ? 'bg-blue-100 text-blue-800 group-hover:bg-blue-500 group-hover:text-white' :
                                    tienda.estatus === 'Tienda No Existe' ? 'bg-red-100 text-red-800 group-hover:bg-red-500 group-hover:text-white' : 'bg-gray-100 text-gray-800 group-hover:bg-white group-hover:text-gray-800'
                                }`}>
                                    {tienda.estatus || 'Sin estatus'}
                                </span>
                            </div>
                          </td>
                          <td className="p-4 text-center space-x-1 sticky right-0 bg-white group-hover:bg-brand-dark z-10 border-l border-gray-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors">
                            <button onClick={() => navigate(`/tiendas/${tienda.id}/inventario`)} className="p-2 text-indigo-600 hover:bg-white/20 group-hover:text-white rounded-lg inline-flex transition-colors" title="Ver Inventario Físico">
                              <Package className="w-5 h-5" />
                            </button>
                            <button onClick={() => { 
                                setEditingTienda(tienda); 
                                setFormData({
                                    ...tienda, 
                                    tipo: tienda.tipo || 'Tienda',
                                    estatus: tienda.estatus || 'Tienda Activa',
                                    coord_lat: tienda.coordenadas_tienda?.lat?.toString() || '', 
                                    coord_lng: tienda.coordenadas_tienda?.lng?.toString() || ''
                                }); 
                                setIsModalOpen(true); 
                            }} className="p-2 text-gray-500 hover:bg-white/20 group-hover:text-white rounded-lg inline-flex transition-colors" title="Editar">
                                <Edit2 className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDelete(tienda.id)} className="p-2 text-gray-500 hover:bg-red-500 hover:text-white group-hover:text-red-200 rounded-lg inline-flex transition-colors" title="Eliminar">
                                <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                      </tr>
                      );
                    })}
                    {filteredTiendas.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-12">
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-sm">
                                        <Search className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">No se encontraron resultados</h3>
                                    <p className="text-sm text-gray-500 max-w-sm">No encontramos registros que coincidan con la búsqueda actual. Intenta con otros términos o limpia los filtros.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative overflow-y-auto max-h-[90vh]">
                <h3 className="text-xl font-bold mb-4">{editingTienda ? 'Editar Tienda' : 'Nueva Tienda'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">Tipo</label>
                          <CustomSelect 
                              value={formData.tipo} 
                              onChange={(val: string) => setFormData({...formData, tipo: val})} 
                              options={[
                                  { value: 'Tienda', label: 'Tienda' },
                                  { value: 'Oficina', label: 'Oficina' }
                              ]}
                              className="w-full border p-2 rounded-lg bg-white"
                              required
                          />
                      </div>
                      <div><label className="block text-sm font-medium mb-1">ID Tienda/Oficina</label><input type="number" required value={formData.id_tienda} onChange={e=>setFormData({...formData, id_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium mb-1">Nombre Tienda/Oficina</label><input value={formData.tienda} onChange={e=>setFormData({...formData, tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                      <div>
                          <label className="block text-sm font-medium mb-1">País</label>
                          <CustomSelect 
                              value={formData.pais_tienda} 
                              onChange={(val: string) => setFormData({...formData, pais_tienda: val})} 
                              options={[
                                  { value: '', label: 'Selecciona País...' },
                                  ...paises.map(p => ({ value: p, label: p }))
                              ]}
                              className="w-full border p-2 rounded-lg bg-white"
                              required
                          />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Provincia</label><input value={formData.provincia_tienda} onChange={e=>setFormData({...formData, provincia_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                        <div><label className="block text-sm font-medium mb-1">Ciudad</label><input value={formData.ciudad_tienda} onChange={e=>setFormData({...formData, ciudad_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Municipio</label><input value={formData.municipio_tienda} onChange={e=>setFormData({...formData, municipio_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    
                    <div><label className="block text-sm font-medium mb-1">Domicilio</label><textarea required value={formData.domicilio_tienda} onChange={e=>setFormData({...formData, domicilio_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Teléfono</label><input value={formData.telefono_tienda} onChange={e=>setFormData({...formData, telefono_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                        <div><label className="block text-sm font-medium mb-1">Correo</label><input value={formData.correo_tienda} onChange={e=>setFormData({...formData, correo_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Latitud GPS</label>
                            <input type="number" step="any" value={formData.coord_lat} onChange={e=>setFormData({...formData, coord_lat: e.target.value})} placeholder="Ej: -12.0464" className="w-full border p-2 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Longitud GPS</label>
                            <input type="number" step="any" value={formData.coord_lng} onChange={e=>setFormData({...formData, coord_lng: e.target.value})} placeholder="Ej: -77.0428" className="w-full border p-2 rounded-lg text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Estatus del Local</label>
                        <CustomSelect 
                            value={formData.estatus || 'Tienda Activa'} 
                            onChange={(val: string) => setFormData({...formData, estatus: val})} 
                            options={[
                                { value: 'Tienda Activa', label: 'Tienda Activa' },
                                { value: 'Tienda Existente', label: 'Tienda Existente' },
                                { value: 'Tienda No Existe', label: 'Tienda No Existe' }
                            ]}
                            className="w-full border p-2 rounded-lg bg-white"
                            required
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-hover">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <ImportCSVModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        onConfirm={() => fileInputRef.current?.click()}
        importing={importing}
        fileInputRef={fileInputRef}
        onFileChange={handleFileUpload}
      />

    </div>
  );
}

function ImportCSVModal({ isOpen, onClose, onConfirm, importing, fileInputRef, onFileChange }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, importing: boolean, fileInputRef: React.RefObject<HTMLInputElement>, onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-hover/10 text-brand-dark mb-4 mx-auto md:mx-0">
           <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 text-center md:text-left">Importación Masiva de Tiendas</h3>
        <p className="text-sm text-gray-600 mb-6 text-center md:text-left leading-relaxed">
          Para importar múltiples tiendas a la vez, tu archivo <strong>.csv</strong> debe contener exactamente las siguientes columnas separadas por comas. Incluye la cabecera en la primera fila.
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 sm:p-5 mb-6 text-sm text-gray-700">
           <p className="font-bold text-gray-800 mb-2">Columnas esperadas (10):</p>
           <ol className="list-decimal pl-5 space-y-1 mb-4 text-xs">
             <li><span className="font-semibold text-brand-dark">ID Tienda</span> (Numérico)</li>
             <li><span className="font-semibold text-brand-dark">Tienda</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Provincia</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Ciudad</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Municipio</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Domicilio</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">País</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Teléfono</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Correo</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Estatus</span> (Texto Ej: Tienda Activa)</li>
           </ol>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end sm:space-x-3 gap-3 sm:gap-0 mt-8">
           <button 
             disabled={importing}
             onClick={onClose} 
             className="w-full sm:w-auto px-6 py-3 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
           >
             Cancelar
           </button>
           <button 
             disabled={importing}
             onClick={onConfirm} 
             className="w-full sm:w-auto px-6 py-3 font-semibold text-white bg-brand-dark hover:bg-brand-hover rounded-xl shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
           >
             {importing ? 'Procesando...' : 'Seleccionar Archivo'}
           </button>
        </div>

        <input 
           type="file" 
           accept=".csv" 
           className="hidden" 
           ref={fileInputRef} 
           onChange={onFileChange} 
        />
      </div>
    </div>
  );
}
