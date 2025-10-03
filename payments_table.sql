-- Tabla de Pagos/Liquidaciones
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Evitar pagos a sí mismo
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_payments_from_user ON payments(from_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_to_user ON payments(to_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer todos los pagos
CREATE POLICY "Allow read access to all users" ON payments
  FOR SELECT
  USING (true);

-- Política: Todos pueden insertar pagos
CREATE POLICY "Allow insert access to all users" ON payments
  FOR INSERT
  WITH CHECK (true);

-- Política: Todos pueden actualizar pagos
CREATE POLICY "Allow update access to all users" ON payments
  FOR UPDATE
  USING (true);

-- Política: Todos pueden eliminar pagos
CREATE POLICY "Allow delete access to all users" ON payments
  FOR DELETE
  USING (true);

-- Comentarios
COMMENT ON TABLE payments IS 'Registra los pagos/liquidaciones entre usuarios';
COMMENT ON COLUMN payments.from_user_id IS 'Usuario que realiza el pago (deudor)';
COMMENT ON COLUMN payments.to_user_id IS 'Usuario que recibe el pago (acreedor)';
COMMENT ON COLUMN payments.amount IS 'Monto del pago';
COMMENT ON COLUMN payments.description IS 'Descripción opcional del pago';
COMMENT ON COLUMN payments.payment_date IS 'Fecha en que se realizó el pago';
