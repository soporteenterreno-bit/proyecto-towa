import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan credenciales (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parser de CSV respetuoso de comillas (RFC 4180 simplificado). Espejo de src/utils/csv.ts
// (duplicado intencionalmente: este es un script Node standalone, no comparte bundler con el frontend).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') pushField();
    else if (char === '\r') { /* ignore */ }
    else if (char === '\n') pushRow();
    else field += char;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function parseCoordenadas(raw) {
  const value = (raw || '').trim();
  if (!value) return null;
  const parts = value.split(/[;,]/).map(p => parseFloat(p.trim()));
  if (parts.length === 2 && parts.every(n => !isNaN(n))) {
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
}

function nullIfEmpty(value) {
  const v = (value || '').trim();
  return v === '' ? null : v;
}

async function seedTiendas() {
  const csvPath = join(__dirname, '../csv/tiendas_payless.csv');
  const text = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(text);
  const [, ...dataRows] = rows; // descarta la fila de encabezado

  const seen = new Set();
  const tiendas = [];

  for (const cols of dataRows) {
    const [id_tienda, tienda, provincia_tienda, ciudad_tienda, municipio_tienda, domicilio_tienda, pais_tienda, coordenadas_tienda, telefono_tienda, correo_tienda] = cols;
    const idNum = parseInt(id_tienda, 10);
    if (isNaN(idNum)) continue;
    if (seen.has(idNum)) {
      console.log(`Descartando duplicado id_tienda=${idNum} ("${tienda}")`);
      continue;
    }
    seen.add(idNum);

    tiendas.push({
      id_tienda: idNum,
      tienda: nullIfEmpty(tienda),
      provincia_tienda: nullIfEmpty(provincia_tienda),
      ciudad_tienda: nullIfEmpty(ciudad_tienda),
      municipio_tienda: nullIfEmpty(municipio_tienda),
      domicilio_tienda: nullIfEmpty(domicilio_tienda),
      pais_tienda: nullIfEmpty(pais_tienda),
      coordenadas_tienda: parseCoordenadas(coordenadas_tienda),
      telefono_tienda: nullIfEmpty(telefono_tienda),
      correo_tienda: nullIfEmpty(correo_tienda),
    });
  }

  console.log(`Importando ${tiendas.length} tiendas...`);

  const BATCH_SIZE = 200;
  let imported = 0;
  for (let i = 0; i < tiendas.length; i += BATCH_SIZE) {
    const batch = tiendas.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('tiendas').upsert(batch, { onConflict: 'id_tienda' });
    if (error) {
      console.error(`Error importando lote ${i}-${i + batch.length}:`, error);
      process.exit(1);
    }
    imported += batch.length;
    console.log(`  ${imported}/${tiendas.length}`);
  }

  console.log(`\n¡Listo! ${imported} tiendas importadas desde ${csvPath}`);
}

seedTiendas();
