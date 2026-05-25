-- Agrega estado para solicitudes generadas por IA pendientes de revisión comercial.
ALTER TYPE "EstadoPresupuesto" ADD VALUE IF NOT EXISTS 'PENDIENTE_AUDITORIA_IA';
