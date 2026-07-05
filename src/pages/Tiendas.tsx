import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, MapPin, Search, Package, Download, Upload, XCircle, Filter, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PAISES_LATAM } from '../constants';

export default function Tiendas() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTienda, setEditingTienda] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    codigo_tienda: '', pais: '', ciudad: '', region: '', establecimiento_cc: '', direccion: '', referencia: '', estatus: 'Tienda Activa',
    correos_tienda: '', coord_lat: '', coord_lng: ''
  });
  
  // Filtering States
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Import Mass CSV States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchTiendas = async () => {
    try {
        const { data, error } = await supabase.from('tiendas').select('*');
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
    const { correos_tienda, coord_lat, coord_lng, ...rest } = formData;
    const data: any = {
      ...rest,
      correos_tienda: correos_tienda
        ? correos_tienda.split(',').map((e: string) => e.trim()).filter(Boolean)
        : [],
    };
    if (coord_lat && coord_lng) {
      data.coordenadas = { lat: parseFloat(coord_lat), lng: parseFloat(coord_lng) };
    }
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'tecnico') return;
    try {
      const data = buildTiendaData();
      if (editingTienda) {
        await supabase.from('tiendas').update(data).eq('id', editingTienda.id);
      } else {
        await supabase.from('tiendas').insert(data);
      }
      setIsModalOpen(false);
      fetchTiendas();
    } catch (e) { console.error(e); alert("Error guardando tienda"); }
  };

  const handleDelete = async (id: string) => {
    if (role === 'tecnico' || !window.confirm("¿Eliminar tienda?")) return;
    try {
      await supabase.from('tiendas').delete().eq('id', id);
      fetchTiendas();
    } catch (e) { console.error(e); }
  };

  // Helper arrays for cascaded dropdowns based on existing stores (not all generic ones to avoid empty lists)
  const uniqueCountriesFilter = Array.from(new Set(tiendas.map(t => t.pais))).filter(Boolean).sort();
  const uniqueCitiesFilter = filterCountry 
    ? Array.from(new Set(tiendas.filter(t => t.pais === filterCountry).map(t => t.ciudad))).filter(Boolean).sort()
    : [];

  const filteredTiendas = tiendas.filter(t => {
    const term = globalSearch.toLowerCase();
    const matchesSearch = !globalSearch || (
      (t.codigo_tienda || '').toLowerCase().includes(term) ||
      (t.pais || '').toLowerCase().includes(term) ||
      (t.ciudad || '').toLowerCase().includes(term) ||
      (t.region || '').toLowerCase().includes(term) ||
      (t.establecimiento_cc || '').toLowerCase().includes(term) ||
      (t.direccion || '').toLowerCase().includes(term)
    );
    const matchesCountry = !filterCountry || t.pais === filterCountry;
    const matchesCity = !filterCity || t.ciudad === filterCity;
    
    return matchesSearch && matchesCountry && matchesCity;
  });

  const clearFilters = () => {
    setGlobalSearch('');
    setFilterCountry('');
    setFilterCity('');
  };

  const downloadCSV = () => {
    const headers = ["ID", "Código", "País", "Ciudad", "Región", "Establecimiento/Centro Comercial", "Dirección", "Referencia", "Estatus", "Correos", "Latitud", "Longitud"];
    const csvRows = [headers.join(",")];

    filteredTiendas.forEach(t => {
        const correos = Array.isArray(t.correos_tienda) ? t.correos_tienda.join('; ') : (t.correos_tienda || '');
        const row = [
            `"${t.id}"`,
            `"${t.codigo_tienda || ''}"`,
            `"${t.pais || ''}"`,
            `"${t.ciudad || ''}"`,
            `"${t.region || ''}"`,
            `"${t.establecimiento_cc || ''}"`,
            `"${t.direccion || ''}"`,
            `"${t.referencia || ''}"`,
            `"${t.estatus || ''}"`,
            `"${correos}"`,
            `"${t.coordenadas?.lat || ''}"`,
            `"${t.coordenadas?.lng || ''}"`
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
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length < 2) {
          alert('El archivo no contiene datos válidos.');
          return;
        }

        const toInsert = [];
        let importedCount = 0;
        
        // Loop over rows starting from 1 (ignore header)
        for(let i = 1; i < rows.length; i++) {
           const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
           // Requires at least codigo, pais, ciudad, establecimiento, direccion
           if(cols.length >= 6) {
             const correoRaw = cols[9] || '';
             const correos = correoRaw ? correoRaw.split(';').map((e: string) => e.trim()).filter(Boolean) : [];
             const lat = cols[10] ? parseFloat(cols[10]) : NaN;
             const lng = cols[11] ? parseFloat(cols[11]) : NaN;
             const tiendaData: any = {
                 codigo_tienda: cols[0] || '',
                 pais: cols[1] || '',
                 ciudad: cols[2] || '',
                 region: cols[3] || '',
                 establecimiento_cc: cols[4] || '',
                 direccion: cols[5] || '',
                 referencia: cols[6] || '',
                 estatus: cols[7] || 'Tienda Activa',
                 correos_tienda: correos,
             };
             if (!isNaN(lat) && !isNaN(lng)) {
               tiendaData.coordenadas = { lat, lng };
             }
             toInsert.push(tiendaData);
             importedCount++;
           }
        }
        
        if (toInsert.length > 0) {
           const { error } = await supabase.from('tiendas').insert(toInsert);
           if (error) throw error;
           
           alert(`Se importaron ${importedCount} tiendas exitosamente.`);
           fetchTiendas();
        } else {
           alert('No se encontraron filas con el formato mínimo requerido.');
        }

      } catch (err) {
        console.error(err);
        alert('Ocurrió un error al procesar el archivo CSV.');
      } finally {
        setShowImportModal(false);
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert('Hubo un error al leer el archivo.');
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
          {role !== 'tecnico' && (
             <button
               onClick={() => setShowImportModal(true)}
               className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-brand-dark transition-colors whitespace-nowrap text-sm font-semibold shadow-sm"
               title="Importar CSV de Tiendas"
             >
               <Upload className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Importar CSV</span>
             </button>
          )}

          {role !== 'tecnico' && tiendas.length > 0 && (
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
             className={`flex items-center px-4 py-2 border rounded-xl transition-colors whitespace-nowrap text-sm font-semibold shadow-sm ${showAdvancedFilters || filterCountry || filterCity ? 'bg-brand-gray border-brand-dark text-brand-dark' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
             <Filter className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Filtros</span>
          </button>

          {role !== 'tecnico' && (
            <button 
              onClick={() => { setEditingTienda(null); setFormData({codigo_tienda: '', pais: '', ciudad: '', region: '', establecimiento_cc: '', direccion: '', referencia: '', estatus: 'Tienda Activa', correos_tienda: '', coord_lat: '', coord_lng: ''}); setIsModalOpen(true); }}
              className="flex items-center px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-hover transition-colors whitespace-nowrap text-sm font-semibold shadow-sm"
            >
              <Plus className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Nueva</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Bar */}
      {(showAdvancedFilters || filterCountry || filterCity) && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-dark/20 flex flex-col md:flex-row gap-4 items-end animate-in fade-in slide-in-from-top-2">
           <div className="w-full md:w-1/3">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Filtrar por País</label>
              <select value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setFilterCity(''); }} className="w-full text-sm border-gray-300 border p-2 rounded-lg focus:ring-brand-dark focus:border-brand-dark bg-gray-50">
                  <option value="">Cualquier País</option>
                  {uniqueCountriesFilter.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
              </select>
           </div>
           <div className="w-full md:w-1/3">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Filtrar por Ciudad</label>
              <select value={filterCity} onChange={e => setFilterCity(e.target.value)} disabled={!filterCountry} className="w-full text-sm border-gray-300 border p-2 rounded-lg focus:ring-brand-dark focus:border-brand-dark disabled:bg-gray-100 disabled:opacity-50 bg-gray-50">
                  <option value="">{filterCountry ? 'Cualquier Ciudad' : 'Primero elige un país'}</option>
                  {uniqueCitiesFilter.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
              </select>
           </div>
           <div className="w-full md:w-auto">
              <button onClick={clearFilters} disabled={!globalSearch && !filterCountry && !filterCity} className="w-full md:w-auto px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
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
                    <th className="p-4 text-sm font-semibold text-gray-600">Código</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">País</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Ciudad / Región</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 w-1/3">Establecimiento & Dirección</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Estatus</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center sticky right-0 bg-gray-50 z-10 border-l border-gray-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTiendas.map((tienda) => (
                    <tr key={tienda.id} className="border-b border-gray-100 group">
                        <td className="p-4 font-mono text-sm group-hover:bg-gray-50 transition-colors">{tienda.codigo_tienda}</td>
                        <td className="p-4 group-hover:bg-gray-50 transition-colors">
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-gray text-brand-dark border border-brand-dark/15">
                            {tienda.pais || '—'}
                          </span>
                        </td>
                        <td className="p-4 group-hover:bg-gray-50 transition-colors">
                           <div className="flex items-center text-gray-800 font-medium">
                               <MapPin className="w-4 h-4 mr-1 text-gray-400 flex-shrink-0" />
                               {tienda.ciudad}
                               {tienda.coordenadas?.lat ? (
                                 <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700" title={`GPS: ${tienda.coordenadas.lat}, ${tienda.coordenadas.lng}`}>GPS ✓</span>
                               ) : (
                                 <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-400">Sin GPS</span>
                               )}
                           </div>
                           <div className="text-xs text-gray-500 mt-1">{tienda.region}</div>
                        </td>
                        <td className="p-4 group-hover:bg-gray-50 transition-colors">
                           <div className="text-sm font-semibold text-gray-700">{tienda.establecimiento_cc}</div>
                           <div className="text-xs text-gray-500 mt-1 truncate max-w-sm" title={tienda.direccion}>{tienda.direccion}</div>
                        </td>
                        <td className="p-4 group-hover:bg-gray-50 transition-colors">
                            <span className={`px-2 py-1 inline-block text-[10px] sm:text-xs font-semibold rounded-full uppercase tracking-wider ${
                                tienda.estatus === 'Tienda Activa' ? 'bg-green-100 text-green-800' :
                                tienda.estatus === 'Tienda Existente' ? 'bg-blue-100 text-blue-800' :
                                tienda.estatus === 'Tienda No Existe' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                                {tienda.estatus || 'Sin estatus'}
                            </span>
                        </td>
                        <td className="p-4 text-center space-x-1 sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors">
                           <button onClick={() => navigate(`/tiendas/${tienda.id}/inventario`)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-flex" title="Ver Inventario Físico">
                             <Package className="w-5 h-5" />
                           </button>
                           {role !== 'tecnico' && (
                             <>
                                <button onClick={() => { setEditingTienda(tienda); setFormData({...tienda, estatus: tienda.estatus || 'Tienda Activa', correos_tienda: Array.isArray(tienda.correos_tienda) ? tienda.correos_tienda.join(', ') : (tienda.correos_tienda || ''), coord_lat: tienda.coordenadas?.lat?.toString() || '', coord_lng: tienda.coordenadas?.lng?.toString() || ''}); setIsModalOpen(true); }} className="p-2 text-gray-500 hover:text-brand-dark hover:bg-gray-100 rounded-lg inline-flex" title="Editar">
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDelete(tienda.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg inline-flex" title="Eliminar">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                             </>
                           )}
                        </td>
                    </tr>
                    ))}
                    {filteredTiendas.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-gray-500">No se encontraron tiendas que coincidan con la búsqueda.</td></tr>
                    )}
                </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative overflow-y-auto max-h-[90vh]">
                <h3 className="text-xl font-bold mb-4">{editingTienda ? 'Editar Tienda' : 'Nueva Tienda'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Código</label><input required value={formData.codigo_tienda} onChange={e=>setFormData({...formData, codigo_tienda: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">País</label>
                            <select required value={formData.pais} onChange={e=>setFormData({...formData, pais: e.target.value})} className="w-full border p-2 rounded-lg bg-white">
                                <option value="">Selecciona País...</option>
                                {PAISES_LATAM.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Ciudad</label><input required value={formData.ciudad} onChange={e=>setFormData({...formData, ciudad: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Región</label><input value={formData.region} onChange={e=>setFormData({...formData, region: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium mb-1">Centro Comercial / Establecimiento</label><input required value={formData.establecimiento_cc} onChange={e=>setFormData({...formData, establecimiento_cc: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium mb-1">Dirección Exacta</label><textarea required value={formData.direccion} onChange={e=>setFormData({...formData, direccion: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium mb-1">Referencia</label><input value={formData.referencia} onChange={e=>setFormData({...formData, referencia: e.target.value})} className="w-full border p-2 rounded-lg" /></div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Correos de la Tienda</label>
                        <input value={formData.correos_tienda} onChange={e=>setFormData({...formData, correos_tienda: e.target.value})} placeholder="correo1@towa.com, correo2@towa.com" className="w-full border p-2 rounded-lg text-sm" />
                        <p className="text-xs text-gray-400 mt-1">Separar múltiples correos con coma</p>
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
                        <select required value={formData.estatus || 'Tienda Activa'} onChange={e=>setFormData({...formData, estatus: e.target.value})} className="w-full border p-2 rounded-lg bg-white">
                            <option value="Tienda Activa">Tienda Activa</option>
                            <option value="Tienda Existente">Tienda Existente</option>
                            <option value="Tienda No Existe">Tienda No Existe</option>
                        </select>
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
           <p className="font-bold text-gray-800 mb-2">Columnas esperadas (8):</p>
           <ol className="list-decimal pl-5 space-y-1 mb-4">
             <li><span className="font-semibold text-brand-dark">Código</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">País</span> (Texto Ej: Peru)</li>
             <li><span className="font-semibold text-brand-dark">Ciudad</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Región</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Establecimiento</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Dirección</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Referencia</span> (Texto)</li>
             <li><span className="font-semibold text-brand-dark">Estatus</span> (Texto Ej: Tienda Activa)</li>
           </ol>
           
           <div className="mt-4">
             <p className="font-bold text-gray-800 mb-1">Ejemplo de Fila:</p>
             <div className="bg-gray-800 text-green-400 font-mono text-xs p-3 rounded-xl overflow-x-auto whitespace-nowrap">
                T-001,Peru,Lima,Lima Sur,Plaza Lima,Av Principal 123,Frente al parque,Tienda Activa
             </div>
           </div>
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

        {/* Hidden File Input */}
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
