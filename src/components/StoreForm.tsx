import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Country, State } from 'country-state-city';

export default function StoreForm() {
  const [countries] = useState(Country.getAllCountries());
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [states, setStates] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    ciudad_region: '',
    establecimiento_tienda: '',
    direccion_referencia: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (selectedCountryCode) {
      setStates(State.getStatesOfCountry(selectedCountryCode));
      setFormData(prev => ({ ...prev, ciudad_region: '' }));
    } else {
      setStates([]);
    }
  }, [selectedCountryCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const countryName = Country.getCountryByCode(selectedCountryCode)?.name || '';
      const stateName = State.getStateByCodeAndCountry(formData.ciudad_region, selectedCountryCode)?.name || formData.ciudad_region;

      const { error } = await supabase.from('tiendas').insert({
        pais: countryName,
        ciudad: stateName,
        establecimiento_cc: formData.establecimiento_tienda,
        direccion: formData.direccion_referencia,
        estatus: 'Tienda Activa'
      });
      
      if (error) throw error;
      
      setMessage({ type: 'success', text: '¡Tienda registrada exitosamente!' });
      setFormData({
        ciudad_region: '',
        establecimiento_tienda: '',
        direccion_referencia: ''
      });
      setSelectedCountryCode('');
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error al registrar la tienda.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Registrar Nueva Tienda</h2>
        <p className="text-sm text-gray-600 mt-1">Completa el formulario a continuación para agregar una nueva ubicación de tienda.</p>
      </div>
      
      <div className="p-6">
        {message.text && (
          <div className={`mb-4 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="pais" className="block text-sm font-medium text-gray-700">País</label>
              <select
                id="pais"
                required
                value={selectedCountryCode}
                onChange={(e) => setSelectedCountryCode(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#1c322e] focus:border-[#1c322e] sm:text-sm rounded-md border"
              >
                <option value="">Selecciona un país</option>
                {countries.map((country) => (
                  <option key={country.isoCode} value={country.isoCode}>{country.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ciudad" className="block text-sm font-medium text-gray-700">Ciudad / Región</label>
              <select
                id="ciudad"
                required
                value={formData.ciudad_region}
                onChange={(e) => setFormData({...formData, ciudad_region: e.target.value})}
                disabled={!selectedCountryCode}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#1c322e] focus:border-[#1c322e] sm:text-sm rounded-md border disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Selecciona una ciudad/región</option>
                {states.map((state) => (
                  <option key={state.isoCode} value={state.isoCode}>{state.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="establecimiento" className="block text-sm font-medium text-gray-700">Establecimiento / Centro Comercial</label>
              <input
                type="text"
                id="establecimiento"
                required
                value={formData.establecimiento_tienda}
                onChange={(e) => setFormData({...formData, establecimiento_tienda: e.target.value})}
                className="mt-1 focus:ring-[#1c322e] focus:border-[#1c322e] block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2"
                placeholder="ej. Centro Comercial Andino"
              />
            </div>

            <div>
              <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">Dirección / Referencia</label>
              <input
                type="text"
                id="direccion"
                required
                value={formData.direccion_referencia}
                onChange={(e) => setFormData({...formData, direccion_referencia: e.target.value})}
                className="mt-1 focus:ring-[#1c322e] focus:border-[#1c322e] block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2"
                placeholder="ej. Carrera 11 # 82-71"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto flex justify-center py-2 px-8 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#1c322e] hover:bg-[#2a4a44] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1c322e] disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Tienda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
