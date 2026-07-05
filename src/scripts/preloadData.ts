import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const PAISES_DATA = [
  {
    id: 'colombia',
    nombre_pais: 'Colombia',
    ciudades_regiones: [
      'Bogotá', 'Chía', 'Soacha', 'Mosquera', 'Facatativá', 'Zipaquirá', 'Fusagasugá', 'Cajicá',
      'Medellín', 'Sabaneta', 'Bello', 'Pereira', 'Dosquebradas', 'Manizales', 'Armenia',
      'Cali', 'Palmira', 'Pasto', 'Popayán', 'Buenaventura', 'Barranquilla', 'Soledad',
      'Cartagena', 'Santa Marta', 'Bucaramanga', 'Barrancabermeja', 'Cúcuta', 'Villavicencio', 'Yopal'
    ]
  },
  {
    id: 'guatemala',
    nombre_pais: 'Guatemala',
    ciudades_regiones: [
      'Ciudad de Guatemala', 'Mixco', 'Villa Nueva', 'Quetzaltenango', 'Escuintla', 'Antigua Guatemala'
    ]
  },
  {
    id: 'ecuador',
    nombre_pais: 'Ecuador',
    ciudades_regiones: [
      'Quito', 'Guayaquil', 'Cuenca', 'Santo Domingo', 'Machala', 'Manta', 'Portoviejo'
    ]
  },
  {
    id: 'dominican_republic',
    nombre_pais: 'República Dominicana',
    ciudades_regiones: [
      'Santo Domingo', 'Santiago', 'San Cristóbal', 'La Vega', 'Puerto Plata', 'San Pedro de Macorís'
    ]
  },
  {
    id: 'mexico',
    nombre_pais: 'México',
    ciudades_regiones: [
      'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Zapopan', 'Mérida', 'Cancún'
    ]
  },
  {
    id: 'peru',
    nombre_pais: 'Perú',
    ciudades_regiones: [
      'Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Cusco', 'Chimbote', 'Huancayo'
    ]
  },
  {
    id: 'costa_rica',
    nombre_pais: 'Costa Rica',
    ciudades_regiones: [
      'San José', 'Alajuela', 'Cartago', 'Heredia', 'Puntarenas', 'Liberia', 'Limón'
    ]
  },
  {
    id: 'panama',
    nombre_pais: 'Panamá',
    ciudades_regiones: [
      'Ciudad de Panamá', 'San Miguelito', 'Tocumen', 'David', 'Colón', 'La Chorrera', 'Santiago'
    ]
  }
];

export const preloadPaisesData = async () => {
  try {
    console.log('Starting to preload Paises_payless data...');
    for (const pais of PAISES_DATA) {
      const docRef = doc(collection(db, 'Paises_payless'), pais.id);
      await setDoc(docRef, {
        nombre_pais: pais.nombre_pais,
        ciudades_regiones: pais.ciudades_regiones
      });
      console.log(`Successfully added ${pais.nombre_pais}`);
    }
    console.log('Finished preloading data.');
    alert('¡Datos cargados exitosamente!');
  } catch (error) {
    console.error('Error preloading data:', error);
    alert('Error al cargar los datos. Revisa la consola para más detalles.');
  }
};
