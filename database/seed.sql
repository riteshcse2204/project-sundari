INSERT INTO roles (id, name) VALUES
  ('ROLE-ADMIN', 'Admin'),
  ('ROLE-DOCTOR', 'Doctor'),
  ('ROLE-RECEPTION', 'Reception'),
  ('ROLE-PHARMACY', 'Pharmacy'),
  ('ROLE-NURSE', 'Nurse'),
  ('ROLE-ACCOUNTANT', 'Accountant')
ON CONFLICT (id) DO NOTHING;
