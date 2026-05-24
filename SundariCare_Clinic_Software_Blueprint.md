# Sundari Care & Nursing Home - Premium Software Blueprint

## Goal

Sundari Care & Nursing Home ke liye ek all-in-one premium clinic/hospital management software banana hai jisme billing, pharmacy, admin panel, doctor prescription, patient records aur daily operations ek hi jagah manage ho sakein.

## Recommended Software Type

Best option: web-based software.

Iska matlab:
- Reception, doctor, pharmacy, admin sab apne login se use kar sakte hain.
- Laptop/desktop par browser se chalega.
- Future me mobile app ya patient portal add kiya ja sakta hai.
- Data centralized rahega aur backup easy hoga.

## Main User Roles

1. Admin / Owner
   - Full control
   - Users create/manage
   - Reports dekhna
   - Settings, charges, departments manage karna

2. Reception / Billing Staff
   - Patient registration
   - Appointment booking
   - OPD/IPD billing
   - Payment collection
   - Receipt print

3. Doctor
   - Patient history dekhna
   - Prescription likhna
   - Diagnosis, vitals, notes add karna
   - Lab tests aur medicines prescribe karna
   - Follow-up date set karna

4. Pharmacy Staff
   - Medicine stock manage
   - Prescription ke basis par medicine issue
   - Pharmacy billing
   - Expiry alerts
   - Low stock alerts

5. Nurse / Ward Staff
   - Vitals entry
   - Patient care notes
   - IPD patient updates
   - Medication administration record

6. Accountant / Manager
   - Daily collection
   - Expense tracking
   - Due payments
   - Financial reports

## Core Modules

### 1. Patient Management
- Patient registration with UHID
- Name, age, gender, mobile, address
- Emergency contact
- Patient photo optional
- Visit history
- Medical history
- Allergies
- Previous prescriptions

### 2. Appointment / OPD Module
- Appointment booking
- Doctor-wise schedule
- Token number
- Waiting, in consultation, completed status
- Follow-up visit tracking
- OPD slip print

### 3. Doctor Panel / EMR
- Today's patient queue
- Patient profile
- Symptoms / complaints
- Vitals: BP, pulse, temperature, weight, SPO2
- Diagnosis
- Prescription writing
- Medicine dosage, duration, frequency
- Lab test advice
- Procedure advice
- Follow-up date
- Prescription print/share

### 4. Billing Module
- OPD billing
- IPD billing
- Consultation fees
- Procedure charges
- Lab/test charges
- Pharmacy billing
- Discount and tax settings
- Partial payment
- Due management
- Receipt generation
- Daily cash report

### 5. Pharmacy Module
- Medicine master
- Batch number
- Expiry date
- Purchase rate and sale rate
- Stock in / stock out
- Supplier management
- Prescription-linked sale
- Manual pharmacy sale
- Return management
- Expiry and low-stock alerts

### 6. Admin Panel
- Staff/user management
- Role-based permission
- Doctor setup
- Service charge setup
- Department setup
- Print template setup
- Clinic profile and logo
- Backup settings
- Audit logs

### 7. IPD / Nursing Home Module
- Admission
- Bed/room management
- Ward management
- Daily bed charges
- Nursing notes
- Doctor rounds
- Medication chart
- Discharge summary
- IPD final bill

### 8. Reports
- Daily OPD report
- Daily billing collection
- Doctor-wise collection
- Pharmacy sales report
- Medicine stock report
- Expiry report
- Patient visit report
- Due payment report
- Monthly revenue report
- Expense and profit summary

## Premium Features To Add

1. WhatsApp/SMS integration
   - Appointment reminder
   - Prescription share
   - Payment reminder
   - Follow-up reminder

2. Digital prescription
   - Clinic logo and branding
   - Doctor signature
   - QR code for verification

3. Smart dashboards
   - Today's appointments
   - Revenue summary
   - Pharmacy alerts
   - Pending dues
   - Admissions count

4. Role-based security
   - Staff ko sirf unka required access mile
   - Admin ko full control

5. Backup and data safety
   - Daily automatic backup
   - Export reports to Excel/PDF

6. Multi-printer support
   - Receipt printer
   - A4 prescription printer
   - Pharmacy bill printer

7. Audit log
   - Kis user ne kya change kiya, sab record rahe

8. Expense management
   - Salary, rent, purchase, utilities
   - Profit/loss view

9. Inventory purchase module
   - Pharmacy purchase entry
   - Supplier bills
   - Payment status

10. Discharge summary builder
   - Diagnosis
   - Treatment given
   - Medicines on discharge
   - Follow-up instructions

## Suggested Technology Stack

### Web App
- Frontend: React / Next.js
- Backend: Node.js / NestJS or Next.js API
- Database: PostgreSQL
- UI: Tailwind CSS
- PDF/Print: HTML print templates or PDF generator

### Deployment Options
- Local clinic server with LAN access
- Cloud hosting with secure login
- Hybrid model with daily backup

Recommended for premium software: cloud-first with strong backups, plus optional local export.

## Important Screens

1. Login screen
2. Admin dashboard
3. Patient registration
4. Appointment list
5. Doctor consultation screen
6. Prescription print preview
7. Billing screen
8. Pharmacy sale screen
9. Medicine stock screen
10. IPD admission screen
11. Bed management
12. Discharge summary
13. Reports dashboard
14. Settings panel

## MVP Phase 1

Build these first:
- Login and role system
- Patient registration
- Appointment/OPD queue
- Doctor prescription
- OPD billing
- Pharmacy medicine master
- Pharmacy sale
- Basic reports

## Phase 2

- IPD admission
- Bed/ward management
- Nursing notes
- Discharge summary
- Advanced pharmacy purchase/stock
- Expense tracking

## Phase 3

- WhatsApp/SMS integration
- Advanced analytics
- QR prescription
- Cloud backup
- Patient portal
- Mobile-friendly doctor panel

## Recommended Database Tables

- users
- roles
- patients
- appointments
- visits
- vitals
- prescriptions
- prescription_medicines
- medicines
- medicine_batches
- pharmacy_sales
- pharmacy_sale_items
- invoices
- invoice_items
- payments
- admissions
- beds
- wards
- nursing_notes
- discharge_summaries
- suppliers
- purchases
- expenses
- audit_logs

## Print Templates Needed

- OPD slip
- Prescription
- Billing receipt
- Pharmacy bill
- IPD admission form
- Discharge summary
- Due payment receipt

## Legal / Practical Notes

- Patient data private hota hai, isliye access control aur backup zaroori hai.
- Prescription templates me doctor registration number, clinic address, date/time hona chahiye.
- Pharmacy stock me batch number aur expiry date maintain karna chahiye.
- Financial data ke liye audit log useful rahega.

## Next Step

Recommended next step: Phase 1 ka working web app banana.

Suggested first version screens:
- Admin login
- Dashboard
- Patient registration
- Doctor prescription
- Billing
- Pharmacy stock and sale

