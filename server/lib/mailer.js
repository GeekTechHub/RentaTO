// Lightweight email helper using Resend's HTTP API (no SDK needed).
// Configure in Render:
//   RESEND_API_KEY   — your Resend API key (re_...)
//   MAIL_FROM        — verified sender, e.g. "RentaTO <noreply@tudominio.com>"
//                      (while testing without a domain, use "onboarding@resend.dev")
//   APP_URL          — public frontend URL, e.g. https://renta-to.vercel.app
//
// If RESEND_API_KEY is missing, every send is a no-op that just logs — so the app
// never crashes and you can wire email whenever you're ready.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'RentaTO <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://renta-to.vercel.app';

const mailEnabled = () => !!RESEND_API_KEY;

const wrap = (title, bodyHtml) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="font-size:20px;font-weight:700;margin-bottom:4px;">RentaTO</div>
    <div style="height:3px;background:linear-gradient(90deg,#2563eb,#06b6d4);border-radius:2px;margin-bottom:20px;"></div>
    <h2 style="font-size:18px;margin:0 0 12px;">${title}</h2>
    ${bodyHtml}
    <div style="margin-top:24px;font-size:12px;color:#888;">
      Renta de vehículos entre personas en República Dominicana.<br/>
      <a href="${APP_URL}" style="color:#2563eb;">${APP_URL}</a>
    </div>
  </div>`;

// Fire-and-forget. Never throws into the request path.
async function sendEmail({ to, subject, html }) {
    if (!mailEnabled()) {
        console.log(`[mail] (deshabilitado) Habría enviado a ${to}: ${subject}`);
        return { skipped: true };
    }
    if (!to) return { skipped: true };
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from: MAIL_FROM, to, subject, html })
        });
        if (!res.ok) {
            const t = await res.text();
            console.error(`[mail] Resend error ${res.status}: ${t.slice(0, 200)}`);
            return { ok: false };
        }
        return { ok: true };
    } catch (err) {
        console.error('[mail] Falló el envío:', err.message);
        return { ok: false };
    }
}

// ── Templated notifications ──

const notifyNewBooking = ({ ownerEmail, renterName, carName, startDate, endDate }) => {
    const html = wrap('Tienes una nueva reserva 🚗', `
        <p><b>${renterName}</b> reservó tu <b>${carName}</b>.</p>
        <p style="background:#f3f4f6;padding:12px;border-radius:8px;">
            Del <b>${startDate}</b> al <b>${endDate}</b>
        </p>
        <p>Entra a tu cuenta para ver los detalles y coordinar la entrega por el chat.</p>
        <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-top:8px;">Ver mi cuenta</a>
    `);
    return sendEmail({ to: ownerEmail, subject: `Nueva reserva de tu ${carName}`, html });
};

const notifyKycApproved = ({ email, name }) => {
    const html = wrap('¡Identidad verificada! ✅', `
        <p>Hola ${name || ''}, tu identidad fue verificada con éxito.</p>
        <p>Ya apareces como usuario verificado, lo que genera más confianza con los dueños y rentadores.</p>
        <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-top:8px;">Ir a RentaTO</a>
    `);
    return sendEmail({ to: email, subject: 'Tu identidad fue verificada', html });
};

const notifyKycRejected = ({ email, name, reason }) => {
    const html = wrap('Tu verificación necesita atención', `
        <p>Hola ${name || ''}, no pudimos verificar tu identidad esta vez.</p>
        ${reason ? `<p style="background:#fef3c7;padding:12px;border-radius:8px;"><b>Motivo:</b> ${reason}</p>` : ''}
        <p>Puedes volver a enviar tus documentos desde tu cuenta. Asegúrate de que las fotos sean claras y completas.</p>
        <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-top:8px;">Reenviar documentos</a>
    `);
    return sendEmail({ to: email, subject: 'Tu verificación de identidad', html });
};

module.exports = {
    mailEnabled,
    sendEmail,
    notifyNewBooking,
    notifyKycApproved,
    notifyKycRejected
};
