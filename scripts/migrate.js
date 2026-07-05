import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 1. Configurar Supabase con el Service Role Key para poder insertar usuarios e ignorar RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan variables de entorno de Supabase (VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. Configurar Firebase Admin
// IMPORTANTE: Debes descargar tu serviceAccountKey.json desde la consola de Firebase
// (Project Settings > Service Accounts > Generate new private key)
const serviceAccountPath = './payless-f078b-firebase-adminsdk-fbsvc-a8fe33c793.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ ERROR: No se encontró serviceAccountKey.json.');
  console.error('Por favor, descarga la clave privada desde Firebase Console y guárdala en la raíz del proyecto como "serviceAccountKey.json".\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();
const db = getFirestore();

// Mapa para guardar los IDs antiguos y nuevos si fueran diferentes (aunque en auth se conservará el mismo UID)
const uidMap = new Map();
const tiendasMap = new Map(); // viejo_id -> nuevo_id (si son UUID generados por Firebase, PostgreSQL los rechazará si no son formato UUID, a menos que generemos nuevos)

async function migrarUsuarios() {
  console.log('--- Iniciando migración de Usuarios ---');
  let pageToken;
  let conteo = 0;

  do {
    const listUsersResult = await auth.listUsers(1000, pageToken);
    
    for (const userRecord of listUsersResult.users) {
      console.log(`Migrando auth para: ${userRecord.email}`);
      // Crear el usuario en Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: userRecord.email,
        email_confirm: true,
        // Firebase no expone las contraseñas en texto plano, por lo que requeriremos que hagan reset de password
        // a menos que generemos un hash compatible, lo cual es complejo. Se asigna una temporal o se envía reset.
        password: 'PasswordTemporal123!', 
      });

      if (error && error.code !== 'user_already_exists') {
        console.error(`Error migrando usuario ${userRecord.email}:`, error);
      } else if (data.user) {
        uidMap.set(userRecord.uid, data.user.id);
        
        // Ahora buscar los datos extendidos en Firestore
        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          
          const { error: dbError } = await supabase.from('users').upsert({
            id: data.user.id,
            email: userRecord.email,
            nombre: userData.nombre || '',
            rol: userData.rol || 'tecnico',
            telefono: userData.telefono || null,
            pais: userData.pais || null,
            direccion: userData.direccion || null,
            jefe_inmediato: userData.jefe_inmediato || null,
            area_trabajo: userData.area_trabajo || null
          });
          
          if (dbError) {
             console.error(`Error guardando perfil en public.users para ${userRecord.email}:`, dbError);
          }
        }
      }
      conteo++;
    }
    pageToken = listUsersResult.pageToken;
  } while (pageToken);

  console.log(`✅ Migración de usuarios completada: ${conteo} usuarios procesados.`);
}

// Función auxiliar para generar un UUID basado en string (opcional) si queremos mantener IDs consistentes
// En este caso simple, dejaremos que Supabase genere UUIDs y mapearemos las relaciones.

async function migrarTiendas() {
  console.log('--- Iniciando migración de Tiendas ---');
  const tiendas = await db.collection('tiendas').get();
  
  for (const doc of tiendas.docs) {
    const data = doc.data();
    const { data: insertData, error } = await supabase.from('tiendas').insert({
      codigo_tienda: data.codigo_tienda,
      pais: data.pais,
      ciudad: data.ciudad,
      region: data.region,
      establecimiento_cc: data.establecimiento_cc,
      direccion: data.direccion,
      referencia: data.referencia
    }).select('id').single();

    if (error) {
      console.error(`Error insertando tienda ${data.codigo_tienda}:`, error);
    } else {
      tiendasMap.set(doc.id, insertData.id);
    }
  }
  console.log(`✅ Tiendas migradas: ${tiendasMap.size}`);
}

async function migrarInventario() {
  console.log('--- Iniciando migración de Inventario ---');
  const inventario = await db.collection('inventario').get();
  let conteo = 0;
  
  for (const doc of inventario.docs) {
    const data = doc.data();
    const newTiendaId = tiendasMap.get(data.id_tienda);
    
    if (!newTiendaId) {
      console.warn(`Tienda no encontrada para el inventario ${doc.id}`);
      continue;
    }

    const { error } = await supabase.from('inventario').insert({
      id_tienda: newTiendaId,
      categoria: data.categoria,
      marca: data.marca,
      modelo: data.modelo,
      serial: data.serial,
      estado_fisico: data.estado_fisico,
      estado_operativo: data.estado_operativo
    });

    if (error) console.error(`Error en inventario ${doc.id}:`, error);
    else conteo++;
  }
  console.log(`✅ Inventario migrado: ${conteo}`);
}

// NOTA: Para las visitas se requiere lógica similar usando uidMap y tiendasMap.

async function main() {
  try {
    // 1. Usuarios
    await migrarUsuarios();
    
    // 2. Tiendas
    await migrarTiendas();
    
    // 3. Inventario
    await migrarInventario();
    
    // Aquí puedes agregar migrarVisitas() y migrarReportesActividades()
    
    console.log('🎉 Migración completada con éxito.');
  } catch (error) {
    console.error('Error durante la migración:', error);
  }
}

main();
