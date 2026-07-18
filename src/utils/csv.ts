/**
 * Parser de CSV respetuoso de comillas (RFC 4180 simplificado): soporta comas y saltos de línea
 * dentro de campos entre comillas dobles, y comillas escapadas ("").
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

    if (char === '"') { inQuotes = true; }
    else if (char === ',') { pushField(); }
    else if (char === '\r') { /* ignore, \n handles the break */ }
    else if (char === '\n') { pushRow(); }
    else { field += char; }
  }

  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}
