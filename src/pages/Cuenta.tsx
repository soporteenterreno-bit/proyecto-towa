import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Save, User, Phone, MapPin, Briefcase } from 'lucide-react';
import { PAISES_LATAM } from '../constants';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function Cuenta() {
  const { userData, user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [jefeNombre, setJefeNombre] = useState('');
  const [formData, setFormData] = useState({
    telefono: '',
    pais: '',
    direccion: '',
  });


  useEffect(() => {
    if (userData) {
      setFormData({
        telefono: userData.telefono || '',
        pais: userData.pais || '',
        direccion: userData.direccion || '',
      });
      
      const fetchJefe = async () => {
         if (userData.jefe_inmediato) {
             try {
                const jSnap = await getDoc(doc(db, 'users', userData.jefe_inmediato));
                if (jSnap.exists()) {
                    setJefeNombre(jSnap.data().nombre);
                }
             } catch(e) {}
         }
      };
      fetchJefe();
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handlePhoneChange = (value: string | undefined) => {
    setFormData({ ...formData, telefono: value || '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setSuccess(false);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        telefono: formData.telefono,
        pais: formData.pais,
        direccion: formData.direccion
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      alert("No se pudo actualizar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  const currentDisplayName = userData?.nombre || user?.displayName || 'Usuario';
  const initial = currentDisplayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-gray-100">
           <div className="w-16 h-16 rounded-full bg-brand-dark flex items-center justify-center text-white text-2xl font-bold">
              {initial}
           </div>
           <div>
             <h2 className="text-2xl font-bold text-gray-800">{currentDisplayName}</h2>
             <p className="text-gray-500 flex items-center mt-1">
                <Briefcase className="w-4 h-4 mr-1"/>
                <span className="capitalize">{role}</span>
             </p>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                Correo Electrónico
              </label>
              <input 
                type="email" 
                value={userData?.email || ''} 
                disabled 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Phone className="w-4 h-4 mr-2 text-brand-dark" />
                Número de Contacto
              </label>
              <PhoneInput
                international
                defaultCountry="CO"
                value={formData.telefono}
                onChange={handlePhoneChange}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus-within:ring-2 focus-within:ring-brand-hover focus-within:border-transparent outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-brand-dark" />
                País
              </label>
              <select
                name="pais"
                required
                value={formData.pais}
                onChange={handleChange}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-hover focus:border-transparent outline-none transition-all"
              >
                <option value="">Selecciona un país</option>
                {PAISES_LATAM.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                Dirección de Domicilio
              </label>
              <input 
                type="text" 
                name="direccion"
                value={formData.direccion} 
                onChange={handleChange}
                placeholder="Ej: Calle 50, Edificio..."
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-hover focus:border-transparent outline-none transition-all"
              />
            </div>
            
            {/* Read-only info visible to techs who have been assigned a boss/area */}
            {(role === 'tecnico' || userData?.jefe_inmediato || userData?.area_trabajo) && (
              <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col md:flex-row gap-4 justify-between mt-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Área de Trabajo</p>
                    <p className={`font-medium ${userData?.area_trabajo ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                        {userData?.area_trabajo || 'Pendiente por asignar'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Jefe Inmediato Asignado</p>
                    <p className={`font-medium ${userData?.jefe_inmediato ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                        {userData?.jefe_inmediato ? (jefeNombre || 'Cargando...') : 'Pendiente por asignar'}
                    </p>
                  </div>
              </div>
            )}
            
          </div>

          <div className="pt-4 flex items-center justify-between">
            {success ? (
              <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                Perfil actualizado exitosamente
              </span>
            ) : <span/>}
            
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-6 py-2.5 bg-brand-dark hover:bg-brand-hover text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
