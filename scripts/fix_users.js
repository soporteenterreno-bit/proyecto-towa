import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan credenciales');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUsers() {
  console.log("Buscando usuarios faltantes en la base de datos...");
  
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Error obteniendo auth users:", authError);
    return;
  }
  
  let fixed = 0;
  for (const user of authData.users) {
     const { data, error } = await supabase.from('users').select('id').eq('id', user.id).single();
     
     if (error && error.code === 'PGRST116') {
        const isDefaultAdmin = user.email === 'jhan.rocker@gmail.com';
        const role = isDefaultAdmin ? 'administrador' : 'tecnico';
        
        console.log(`Insertando perfil para: ${user.email} con rol: ${role}`);
        
        const { error: insertError } = await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            nombre: user.user_metadata?.full_name || user.email.split('@')[0],
            rol: role
        });
        
        if (insertError) {
           console.error(`Error insertando ${user.email}:`, insertError);
        } else {
           fixed++;
        }
     }
  }
  
  console.log(`\n¡Proceso terminado! Se corrigieron ${fixed} usuarios.`);
}

fixUsers();
