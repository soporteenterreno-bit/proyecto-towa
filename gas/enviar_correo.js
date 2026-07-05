// Archivo para copiar y pegar en Google Apps Script
// Implementa un endpoint POST que recibe los datos y manda el correo con diseño corporativo Towa.

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // Extraer datos del request
    const {
      to_email,
      fecha_programada,
      prioridad,
      tipo_visita,
      tienda_codigo,
      tienda_nombre,
      tienda_ciudad,
      tecnico_nombre
    } = postData;
    
    if (!to_email) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "to_email es requerido"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const subject = `Asignación de Visita Técnica [${tipo_visita}] - ${tienda_codigo} ${tienda_nombre}`;
    
    // Plantilla HTML con diseño Towa (Verde Corporativo #163f3a, Naranja #F97316)
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-w-xl; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background-color: #163f3a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">Plataforma Towa</h1>
          <p style="color: #a7f3d0; margin: 5px 0 0 0; font-size: 14px;">Notificación de Visita Técnica</p>
        </div>
        
        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="color: #374151; font-size: 16px; margin-top: 0;">Se ha programado una nueva visita técnica en el sistema. A continuación se detallan los datos de la asignación:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; width: 35%; font-weight: bold; color: #4b5563;">Destino (Tienda):</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${tienda_codigo} - ${tienda_nombre} (${tienda_ciudad})</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Técnico Asignado:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${tecnico_nombre || 'Pendiente de asignación / Pool'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Fecha Programada:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${fecha_programada}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Tipo de Visita:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; background-color: #e0f2fe; color: #0369a1;">
                  ${tipo_visita}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Prioridad:</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">
                <span style="color: #ea580c; font-weight: bold;">${prioridad || 'Media'}</span>
              </td>
            </tr>
          </table>
          
          <div style="margin-top: 30px; text-align: center;">
             <p style="color: #6b7280; font-size: 13px; margin-bottom: 0;">Por favor, acceda a la plataforma web para gestionar o visualizar más detalles de esta visita.</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Documento Automático - Sistema Towa TechManager</p>
        </div>
      </div>
    `;

    // Enviar el correo
    MailApp.sendEmail({
      to: to_email,
      subject: subject,
      htmlBody: htmlBody
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Correo enviado correctamente."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Para permitir pre-flight (CORS) desde el frontend
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}
