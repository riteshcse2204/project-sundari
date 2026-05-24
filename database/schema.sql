CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_id TEXT REFERENCES roles(id),
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0),
  gender TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address TEXT,
  doctor TEXT,
  status TEXT NOT NULL DEFAULT 'Waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  symptoms TEXT,
  diagnosis TEXT,
  vitals TEXT,
  medicines TEXT,
  tests TEXT,
  followup DATE,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  service TEXT NOT NULL,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mode TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medicines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  batch TEXT NOT NULL,
  expiry TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pharmacy_sales (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  medicine_name TEXT NOT NULL,
  batch TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mode TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admissions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  ward TEXT NOT NULL,
  bed TEXT NOT NULL,
  doctor TEXT,
  reason TEXT,
  deposit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Admitted',
  admitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT REFERENCES users(id)
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_mobile ON patients(mobile);
CREATE INDEX idx_patients_created_at ON patients(created_at);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_bills_patient_id ON bills(patient_id);
CREATE INDEX idx_pharmacy_sales_patient_id ON pharmacy_sales(patient_id);
CREATE INDEX idx_admissions_patient_id ON admissions(patient_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
