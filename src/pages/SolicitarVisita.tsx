import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, MapPin } from 'lucide-react';

export default function SolicitarVisita() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    tipo: 'Programada',
    id_tienda: '',
    fecha_programada: '',
    tt_number: '',
    notas_coordinador: ''
  });

  const paisTecnico = userData?.pais || '';

  useEffect(() => {
    if (!paisTecnico) return;
    const fetchTiendas = async () => {
      const snap = await getDocs(query(collection(db, 'tiendas'), where('pais', '==', paisTecnico)));
      setTiendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchTiendas();
  }, [paisTecnico]);

  const getMinDate = () => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const yyyy = tmr.getFullYear();
    const mm = String(tmr.getMonth() + 1).padStart(2, '0');
    const dd = String(tmr.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_tienda || !formData.fecha_programada) return alert('Selecciona una tienda y una fecha.');
    if (formData.tipo === 'Falla' && !formData.tt_number) return alert('Para visitas de Falla es obligatorio el Número de TT.');
    if (formData.fecha_programada < getMinDate()) return alert('La fecha de la visita debe ser posterior a hoy.');

    setLoading(true);
    try {
      await addDoc(collection(db, 'visitas'), {
        tipo: formData.tipo,
        tecnico_uid: user?.uid,
        coordinador_uid: null,
        id_tienda: formData.id_tienda,
        status: 'Pendiente',
        fecha_programada: formData.fecha_programada,
        tt_number: formData.tt_number || null,
        notas_coordinador: formData.notas_coordinador,
        createdAt: new Date().toISOString()
      });
      alert('Visita registrada exitosamente');
      navigate('/visitas/mis-visitas');
    } catch (error) {
      console.error(error);
      alert('Error al registrar la visita');
    } finally {
      setLoading(false);
    }
  };

  if (!paisTecnico) {
    return (
      <div className="max-w-lg mx-auto mt-8 bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <h3 className="font-bold text-lg text-yellow-800 mb-2">País no configurado</h3>
        <p className="text-yellow-700 text-sm">Debes completar tu perfil con tu país asignado antes de solicitar visitas.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-brand-dark p-6 text-white">
          <h2 className="text-2xl font-bold">Solicitar Nueva Visita</h2>
          <p className="text-gray-300 mt-1">La visita quedará registrada y asignada directamente a ti.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

          {/* País del técnico (solo lectura) */}
          <div className="flex items-center gap-3 p-4 bg-brand-gray rounded-xl border border-brand-dark/15">
            <MapPin className="w-5 h-5 text-brand-dark flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tiendas disponibles en tu país</p>
              <p className="font-bold text-brand-dark">{paisTecnico}</p>
            </div>
            <span className="ml-auto text-xs text-gray-400">{tiendas.length} tienda{tiendas.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Tipo de visita */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Visita</label>
              <div className="flex space-x-4">
                <label className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Programada' ? 'border-brand-dark bg-brand-gray text-brand-dark' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <input type="radio" name="tipo" value="Programada" checked={formData.tipo === 'Programada'} onChange={e => setFormData({...formData, tipo: e.target.value})} className="sr-only"/>
                  <Calendar className="w-8 h-8 mb-2" />
                  <span className="font-semibold">Mantenimiento Programado</span>
                </label>
                <label className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Falla' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <input type="radio" name="tipo" value="Falla" checked={formData.tipo === 'Falla'} onChange={e => setFormData({...formData, tipo: e.target.value})} className="sr-only"/>
                  <AlertTriangle className="w-8 h-8 mb-2" />
                  <span className="font-semibold">Atención de Falla</span>
                </label>
              </div>
            </div>

            {formData.tipo === 'Falla' && (
              <div className="col-span-1 md:col-span-2 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="w-full">
                  <label className="block text-sm font-bold text-orange-800 mb-1">Número de Trouble Ticket (TT) *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: TT-2024-001"
                    value={formData.tt_number}
                    onChange={e => setFormData({...formData, tt_number: e.target.value})}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada</label>
              <input
                min={getMinDate()}
                required
                type="date"
                value={formData.fecha_programada}
                onChange={e => setFormData({...formData, fecha_programada: e.target.value})}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tienda a Visitar</label>
              <select
                required
                value={formData.id_tienda}
                onChange={e => setFormData({...formData, id_tienda: e.target.value})}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark"
              >
                <option value="">Selecciona una tienda...</option>
                {tiendas.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.codigo_tienda} — {t.establecimiento_cc} ({t.ciudad})
                  </option>
                ))}
              </select>
              {tiendas.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay tiendas registradas para {paisTecnico}.</p>
              )}
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Descripción</label>
              <textarea
                rows={3}
                placeholder="Describe brevemente el motivo o instrucciones de la visita..."
                value={formData.notas_coordinador}
                onChange={e => setFormData({...formData, notas_coordinador: e.target.value})}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark"
              />
            </div>

          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-brand-dark hover:bg-brand-hover text-white font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Visita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
