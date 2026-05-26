const nodemailer = require('nodemailer');

function parseAdminMails(raw = '') {
  return String(raw || '')
    .split(',')
    .map((mail) => mail.trim())
    .filter(Boolean);
}

function formatNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(date);
}

function createTransporter() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendNuevaCotizacionSemillasYaEmail(payload = {}) {
  const transporter = createTransporter();
  const from = String(process.env.MAIL_FROM || '').trim();
  const to = parseAdminMails(process.env.MAIL_TO_ADMIN);

  if (!transporter || !from || !to.length) {
    console.error('[emailService] configuración SMTP incompleta; no se envía notificación de cotización');
    return { sent: false, reason: 'smtp-config-missing' };
  }

  const variedades = Array.isArray(payload.variedades) ? payload.variedades.filter(Boolean) : [];

  const lines = [
    'Se generó una nueva cotización en SemillasYa.',
    '',
    `Productor: ${payload.productor || 'No informado'}`,
    `Teléfono: ${payload.telefono || 'No informado'}`,
    `Provincia: ${payload.provincia || 'No informada'}`,
    `Cultivo: ${payload.cultivo || 'No informado'}`,
    `Variedades cotizadas: ${variedades.length ? variedades.join(', ') : 'No informadas'}`,
    `Superficie: ${payload.superficie || 'No informada'}`,
    `Total estimado: $ ${formatNumber(payload.totalEstimado)}`,
    `Fecha y hora: ${formatDateTime(payload.fechaHora || new Date())}`,
    'Origen: SemillasYa'
  ];

  await transporter.sendMail({
    from,
    to,
    subject: 'Nueva cotización SemillasYa',
    text: lines.join('\n')
  });

  return { sent: true };
}

module.exports = {
  sendNuevaCotizacionSemillasYaEmail
};
