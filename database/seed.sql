INSERT INTO roles (id, name) VALUES
  ('ROLE-ADMIN', 'Admin'),
  ('ROLE-DOCTOR', 'Doctor'),
  ('ROLE-RECEPTION', 'Reception'),
  ('ROLE-PHARMACY', 'Pharmacy'),
  ('ROLE-NURSE', 'Nurse'),
  ('ROLE-ACCOUNTANT', 'Accountant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO patients (id, name, age, gender, mobile, address, doctor, status)
VALUES ('SC-1001', 'Anita Devi', 34, 'Female', '9876543210', 'Patna', 'Dr. Sharma', 'Waiting')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medicines (id, name, batch, expiry, stock, rate, supplier) VALUES
  ('MED-1', 'Paracetamol 650', 'P650A', '2027-04', 18, 24, 'Care Pharma'),
  ('MED-2', 'Azithromycin 500', 'AZ500', '2026-12', 7, 92, 'Medline')
ON CONFLICT (id) DO NOTHING;
