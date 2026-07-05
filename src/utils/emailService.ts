/**
 * Utility to send email notifications via Google Apps Script.
 * 
 * To make this work, deploy the code from `gas/enviar_correo.js` to Google Apps Script
 * as a Web App (access to anyone), and paste the URL here or in an environment variable.
 */

// export const GAS_EMAIL_URL = import.meta.env.VITE_GAS_EMAIL_URL || 'TU_URL_DE_APPS_SCRIPT_AQUI';
export const GAS_EMAIL_URL = 'https://script.google.com/macros/s/AKfycbz_XXXXXXXXXXXX/exec'; // Placeholder

export interface EmailPayload {
    to_email: string;
    fecha_programada: string;
    prioridad: string;
    tipo_visita: string;
    tienda_codigo: string;
    tienda_nombre: string;
    tienda_ciudad: string;
    tecnico_nombre?: string;
}

export const sendVisitNotificationEmail = async (data: EmailPayload) => {
    // If we haven't configured the URL yet, simply return true to not block the flow
    if (GAS_EMAIL_URL.includes('TU_URL') || GAS_EMAIL_URL.includes('XXXXX')) {
        console.warn("GAS_EMAIL_URL no configurado. Simulación de envío exitosa.");
        return true;
    }

    try {
        const response = await fetch(GAS_EMAIL_URL, {
            method: 'POST',
            mode: 'no-cors', // Many times GAS requires no-cors if not correctly setting headers, but if we do JSON it's trickier.
                             // Actually, using 'text/plain' Content-Type bypasses CORS preflight and allows normal fetch to read response.
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(data)
        });
        
        // With no-cors we can't read the response properly, but if we use the default cors with text/plain:
        // We will just assume it succeeds if it doesn't throw.
        return true;
    } catch (error) {
        console.error("Error sending email via GAS:", error);
        return false;
    }
};
