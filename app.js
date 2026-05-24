const storeKey = "sundari-care-offline-v2";
const sessionKey = "sundari-care-session";

const fallbackData = {
  users: [{ id: "USR-1", name: "Sundari Admin", email: "admin@sundaricare.local", role: "Admin" }],
  patients: [
    {
      id: "SC-1001",
      name: "Anita Devi",
      age: 34,
      gender: "Female",
      mobile: "9876543210",
      address: "Patna",
      doctor: "Dr. Sharma",
      status: "Waiting",
      createdAt: new Date().toISOString()
    }
  ],
  prescriptions: [],
  bills: [],
  pharmacySales: [],
  medicines: [
    { id: "MED-1", name: "Paracetamol 650", batch: "P650A", expiry: "2027-04", stock: 18, rate: 24, supplier: "Care Pharma" },
    { id: "MED-2", name: "Azithromycin 500", batch: "AZ500", expiry: "2026-12", stock: 7, rate: 92, supplier: "Medline" }
  ],
  admissions: [],
  expenses: [],
  auditLogs: []
};

let state = structuredClone(fallbackData);
let currentSession = JSON.parse(localStorage.getItem(sessionKey) || "null");
let currentUser = currentSession?.user || currentSession || null;
let selectedPatientId = null;
let apiOnline = true;

const rolePermissions = {
  viewDashboard: ["Admin", "Doctor", "Reception", "Pharmacy", "Nurse", "Accountant"],
  managePatients: ["Admin", "Reception"],
  prescribe: ["Admin", "Doctor"],
  bill: ["Admin", "Reception", "Accountant"],
  pharmacy: ["Admin", "Pharmacy"],
  ipd: ["Admin", "Reception", "Nurse"],
  reports: ["Admin", "Accountant"],
  admin: ["Admin"]
};

const viewPermissions = {
  dashboard: "viewDashboard",
  patients: "managePatients",
  doctor: "prescribe",
  billing: "bill",
  pharmacy: "pharmacy",
  ipd: "ipd",
  reports: "reports",
  admin: "admin"
};

function currency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function setView(viewId) {
  if (!canOpenView(viewId)) {
    viewId = firstAllowedView();
  }
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  const title = document.querySelector(`[data-view="${viewId}"]`)?.textContent || "Dashboard";
  document.getElementById("page-title").textContent = title;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(currentSession?.token ? { authorization: `Bearer ${currentSession.token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return body;
}

function hasPermission(permission) {
  if (!currentUser) return false;
  return rolePermissions[permission]?.includes(currentUser.role);
}

function canOpenView(viewId) {
  return hasPermission(viewPermissions[viewId] || "viewDashboard");
}

function firstAllowedView() {
  return Object.keys(viewPermissions).find(canOpenView) || "dashboard";
}

function applyRoleAccess() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.hidden = !canOpenView(item.dataset.view);
  });

  document.querySelectorAll("[data-view-target]").forEach((item) => {
    item.hidden = !canOpenView(item.dataset.viewTarget);
  });

  const active = document.querySelector(".view.active")?.id || "dashboard";
  if (currentUser && !canOpenView(active)) {
    setView(firstAllowedView());
  }
}

function loadOffline() {
  const saved = localStorage.getItem(storeKey);
  state = saved ? JSON.parse(saved) : structuredClone(fallbackData);
  apiOnline = false;
}

function saveOffline() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

async function loadBootstrap() {
  try {
    state = await api("/api/bootstrap");
    apiOnline = true;
  } catch (error) {
    if (error.status === 401 && currentUser) {
      currentSession = null;
      currentUser = null;
      localStorage.removeItem(sessionKey);
      apiOnline = true;
      requireLogin();
      return;
    }
    loadOffline();
  }
  selectedPatientId = state.patients[0]?.id || null;
  renderAll();
}

async function postData(path, payload, offlineHandler) {
  const enriched = { ...payload, createdBy: currentUser?.name || "Demo user" };
  if (apiOnline) {
    try {
      state = await api(path, { method: "POST", body: JSON.stringify(enriched) });
      renderAll();
      return;
    } catch {
      apiOnline = false;
    }
  }
  offlineHandler(enriched);
  saveOffline();
  renderAll();
}

function requireLogin() {
  document.getElementById("loginScreen").classList.toggle("hidden", Boolean(currentUser));
  document.querySelector(".app-shell").classList.toggle("locked", !currentUser);
  if (currentUser) {
    document.querySelector(".profile-card strong").textContent = currentUser.name;
    document.getElementById("userRoleLabel").textContent = `${currentUser.role} access`;
  }
  applyRoleAccess();
}

function renderDashboard() {
  const revenue = state.bills.reduce((sum, bill) => sum + Number(bill.paid), 0);
  const expenses = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const due = state.bills.reduce((sum, bill) => sum + Number(bill.due), 0);
  const lowStock = state.medicines.filter((medicine) => Number(medicine.stock) <= 10);

  document.getElementById("metricVisits").textContent = state.patients.length;
  document.getElementById("metricRevenue").textContent = currency(revenue - expenses);
  document.getElementById("metricDue").textContent = currency(due);
  document.getElementById("metricLowStock").textContent = lowStock.length;

  document.getElementById("queueList").innerHTML = state.patients.length
    ? state.patients.map(patientQueueItem).join("")
    : `<div class="empty">No patients registered today.</div>`;

  document.getElementById("stockAlerts").innerHTML = lowStock.length
    ? lowStock.map((medicine) => `<div class="list-item"><div><strong>${medicine.name}</strong><span>Batch ${medicine.batch} | Stock ${medicine.stock}</span></div><span class="badge">Low</span></div>`).join("")
    : `<div class="empty">No low stock alerts.</div>`;
}

function patientQueueItem(patient) {
  return `<div class="list-item">
    <div><strong>${patient.name}</strong><span>${patient.id} | ${patient.age}/${patient.gender} | ${patient.doctor}</span></div>
    <span class="badge">${patient.status}</span>
  </div>`;
}

function patientOptions() {
  return state.patients.map((patient) => `<option value="${patient.id}">${patient.name} (${patient.id})</option>`).join("");
}

function medicineOptions() {
  return state.medicines.map((medicine) => `<option value="${medicine.id}">${medicine.name} | ${medicine.stock} in stock | ${currency(medicine.rate)}</option>`).join("");
}

function renderPatients() {
  const query = document.getElementById("patientSearch")?.value?.toLowerCase() || "";
  const patients = state.patients.filter((patient) => `${patient.name} ${patient.mobile} ${patient.id}`.toLowerCase().includes(query));
  document.getElementById("patientList").innerHTML = patients.length
    ? `<table class="table"><thead><tr><th>Patient</th><th>Mobile</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead><tbody>${patients.map((patient) => `
      <tr>
        <td><strong>${patient.name}</strong><span>${patient.id} | ${patient.age}/${patient.gender}</span></td>
        <td>${patient.mobile}</td>
        <td>${patient.doctor}</td>
        <td><span class="badge">${patient.status}</span></td>
        <td><button class="mini-button" data-select-patient="${patient.id}" data-go-doctor="true">Consult</button></td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No patient found.</div>`;

  document.getElementById("billPatient").innerHTML = patientOptions();
  document.getElementById("admissionPatient").innerHTML = patientOptions();
  document.getElementById("pharmacyPatient").innerHTML = patientOptions();
}

function renderDoctor() {
  document.getElementById("doctorQueue").innerHTML = state.patients.length
    ? state.patients.map((patient) => `<div class="list-item">
      <div><strong>${patient.name}</strong><span>${patient.id} | ${patient.mobile}</span></div>
      <button class="mini-button" data-select-patient="${patient.id}">Open</button>
    </div>`).join("")
    : `<div class="empty">Queue is empty.</div>`;

  const patient = state.patients.find((item) => item.id === selectedPatientId);
  document.getElementById("selectedPatientBadge").textContent = patient ? `${patient.name} | ${patient.id}` : "Select patient";

  document.getElementById("prescriptionList").innerHTML = state.prescriptions.length
    ? `<table class="table"><thead><tr><th>Prescription</th><th>Patient</th><th>Diagnosis</th><th>Follow-up</th><th>Action</th></tr></thead><tbody>${state.prescriptions.map((prescription) => {
      const rxPatient = state.patients.find((item) => item.id === prescription.patientId);
      return `<tr>
        <td><strong>${prescription.id}</strong><span>${prescription.date}</span></td>
        <td>${rxPatient?.name || prescription.patientId}</td>
        <td>${prescription.diagnosis || "-"}</td>
        <td>${prescription.followup || "-"}</td>
        <td><button class="mini-button" data-print-prescription="${prescription.id}">Print</button></td>
      </tr>`;
    }).join("")}</tbody></table>`
    : `<div class="empty">No prescriptions saved yet.</div>`;
}

function renderBills() {
  document.getElementById("billList").innerHTML = state.bills.length
    ? `<table class="table"><thead><tr><th>Receipt</th><th>Patient</th><th>Service</th><th>Total</th><th>Paid</th><th>Due</th><th>Action</th></tr></thead><tbody>${state.bills.map((bill) => `
      <tr>
        <td><strong>${bill.id}</strong><span>${bill.date}</span></td>
        <td>${bill.patientName}</td>
        <td>${bill.service}</td>
        <td>${currency(bill.total)}</td>
        <td>${currency(bill.paid)}</td>
        <td>${currency(bill.due)}</td>
        <td><button class="mini-button" data-print-bill="${bill.id}">Print</button></td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No bills generated yet.</div>`;
}

function renderMedicines() {
  document.getElementById("saleMedicine").innerHTML = medicineOptions();
  document.getElementById("medicineList").innerHTML = state.medicines.length
    ? `<table class="table"><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Stock</th><th>Rate</th><th>Supplier</th></tr></thead><tbody>${state.medicines.map((medicine) => `
      <tr>
        <td><strong>${medicine.name}</strong><span>${medicine.id}</span></td>
        <td>${medicine.batch}</td>
        <td>${medicine.expiry}</td>
        <td><span class="badge">${medicine.stock}</span></td>
        <td>${currency(medicine.rate)}</td>
        <td>${medicine.supplier || "-"}</td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No medicine stock available.</div>`;
}

function renderPharmacySales() {
  document.getElementById("pharmacySaleList").innerHTML = state.pharmacySales?.length
    ? `<table class="table"><thead><tr><th>Bill</th><th>Patient</th><th>Medicine</th><th>Qty</th><th>Total</th><th>Action</th></tr></thead><tbody>${state.pharmacySales.map((sale) => `
      <tr>
        <td><strong>${sale.id}</strong><span>${sale.date}</span></td>
        <td>${sale.patientName}</td>
        <td>${sale.medicineName}<span>Batch ${sale.batch}</span></td>
        <td>${sale.qty}</td>
        <td>${currency(sale.total)}</td>
        <td><button class="mini-button" data-print-pharmacy="${sale.id}">Print</button></td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No pharmacy sale generated yet.</div>`;
}

function renderAdmissions() {
  document.getElementById("admissionList").innerHTML = state.admissions.length
    ? `<table class="table"><thead><tr><th>Admission</th><th>Patient</th><th>Ward / Bed</th><th>Doctor</th><th>Deposit</th></tr></thead><tbody>${state.admissions.map((admission) => `
      <tr>
        <td><strong>${admission.id}</strong><span>${admission.admittedAt}</span></td>
        <td>${admission.patientName}</td>
        <td>${admission.ward} / ${admission.bed}</td>
        <td>${admission.doctor}</td>
        <td>${currency(admission.deposit)}</td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No active admissions.</div>`;
}

function renderReports() {
  const revenue = state.bills.reduce((sum, bill) => sum + Number(bill.paid), 0);
  const pharmacyRevenue = (state.pharmacySales || []).reduce((sum, sale) => sum + Number(sale.total), 0);
  const expenses = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const due = state.bills.reduce((sum, bill) => sum + Number(bill.due), 0);
  const pharmacyValue = state.medicines.reduce((sum, medicine) => sum + Number(medicine.stock) * Number(medicine.rate), 0);
  document.getElementById("financialReport").innerHTML = [
    ["Gross Collection", currency(revenue)],
    ["Pharmacy Sales", currency(pharmacyRevenue)],
    ["Expenses", currency(expenses)],
    ["Net Collection", currency(revenue + pharmacyRevenue - expenses)],
    ["Pending Due", currency(due)],
    ["Pharmacy Stock Value", currency(pharmacyValue)],
    ["Active Admissions", state.admissions.length]
  ].map(([label, value]) => `<div class="report-item"><span>${label}</span><strong>${value}</strong></div>`).join("");

  document.getElementById("auditList").innerHTML = state.auditLogs.length
    ? `<table class="table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Record</th></tr></thead><tbody>${state.auditLogs.map((log) => `
      <tr>
        <td>${new Date(log.createdAt).toLocaleString("en-IN")}</td>
        <td>${log.user}</td>
        <td>${log.action}</td>
        <td>${log.entity}</td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">Audit log will appear after new records are saved.</div>`;
}

function renderUsers() {
  const list = document.getElementById("userList");
  if (!list) return;
  list.innerHTML = state.users?.length
    ? `<table class="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${state.users.map((user) => `
      <tr>
        <td><strong>${user.name}</strong><span>${user.id}</span></td>
        <td>${user.email}</td>
        <td><span class="badge">${user.role}</span></td>
        <td>${user.isActive === false ? "Inactive" : "Active"}</td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No users available.</div>`;
}

function renderAll() {
  renderDashboard();
  renderPatients();
  renderDoctor();
  renderBills();
  renderMedicines();
  renderPharmacySales();
  renderAdmissions();
  renderReports();
  renderUsers();
  requireLogin();
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function resetForm(form) {
  form.reset();
  const dateInput = form.querySelector('input[type="date"]');
  if (dateInput) dateInput.value = today();
}

function letterhead(title, id, date) {
  return `<div class="print-letterhead">
    <div>
      <h2>Sundari Care & Nursing Home</h2>
      <p>Premium Clinic Management | OPD, IPD, Pharmacy</p>
      <p>Clinic Road, Patna | Phone: 9876543210</p>
    </div>
    <div>
      <strong>${title}</strong>
      <p>${id}</p>
      <p>${date || new Date().toLocaleDateString("en-IN")}</p>
    </div>
  </div>`;
}

function openPrintModal(title, html) {
  document.getElementById("printTitle").textContent = title;
  document.getElementById("printDocument").innerHTML = html;
  document.getElementById("printModal").classList.add("open");
  document.getElementById("printModal").setAttribute("aria-hidden", "false");
}

function closePrintModal() {
  document.getElementById("printModal").classList.remove("open");
  document.getElementById("printModal").setAttribute("aria-hidden", "true");
}

function prescriptionDocument(prescription) {
  const patient = state.patients.find((item) => item.id === prescription.patientId);
  return `${letterhead("Prescription", prescription.id, prescription.date)}
    <div class="print-section">
      <h4>Patient Details</h4>
      <p><strong>${patient?.name || prescription.patientId}</strong> | ${patient?.age || "-"} / ${patient?.gender || "-"} | ${patient?.mobile || "-"}</p>
    </div>
    <div class="print-section">
      <h4>Clinical Notes</h4>
      <table class="print-table">
        <tr><th>Symptoms</th><td>${prescription.symptoms || "-"}</td></tr>
        <tr><th>Vitals</th><td>${prescription.vitals || "-"}</td></tr>
        <tr><th>Diagnosis</th><td>${prescription.diagnosis || "-"}</td></tr>
        <tr><th>Medicines</th><td>${String(prescription.medicines || "-").replace(/\n/g, "<br>")}</td></tr>
        <tr><th>Tests</th><td>${prescription.tests || "-"}</td></tr>
        <tr><th>Follow-up</th><td>${prescription.followup || "-"}</td></tr>
      </table>
    </div>
    <div class="print-section"><p>Doctor Signature: ____________________</p></div>`;
}

function billDocument(bill) {
  return `${letterhead("Receipt", bill.id, bill.date)}
    <div class="print-section">
      <h4>Billing Details</h4>
      <table class="print-table">
        <tr><th>Patient</th><td>${bill.patientName}</td></tr>
        <tr><th>Service</th><td>${bill.service}</td></tr>
        <tr><th>Total</th><td>${currency(bill.total)}</td></tr>
        <tr><th>Paid</th><td>${currency(bill.paid)}</td></tr>
        <tr><th>Due</th><td>${currency(bill.due)}</td></tr>
        <tr><th>Mode</th><td>${bill.mode}</td></tr>
      </table>
    </div>
    <div class="print-section"><p>Authorized by: ${currentUser?.name || "Sundari Care"}</p></div>`;
}

function pharmacyDocument(sale) {
  return `${letterhead("Pharmacy Bill", sale.id, sale.date)}
    <div class="print-section">
      <h4>Sale Details</h4>
      <table class="print-table">
        <tr><th>Patient</th><td>${sale.patientName}</td></tr>
        <tr><th>Medicine</th><td>${sale.medicineName}</td></tr>
        <tr><th>Batch</th><td>${sale.batch}</td></tr>
        <tr><th>Qty</th><td>${sale.qty}</td></tr>
        <tr><th>Rate</th><td>${currency(sale.rate)}</td></tr>
        <tr><th>Discount</th><td>${currency(sale.discount)}</td></tr>
        <tr><th>Total</th><td>${currency(sale.total)}</td></tr>
        <tr><th>Mode</th><td>${sale.mode}</td></tr>
      </table>
    </div>`;
}

document.querySelectorAll("[data-view], [data-view-target]").forEach((control) => {
  control.addEventListener("click", () => setView(control.dataset.view || control.dataset.viewTarget));
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const error = document.getElementById("loginError");
  error.textContent = "";
  try {
    const session = await api("/api/login", { method: "POST", body: JSON.stringify(data) });
    currentSession = session;
    currentUser = session.user;
    localStorage.setItem(sessionKey, JSON.stringify(session));
    await loadBootstrap();
  } catch {
    if (data.email === "admin@sundaricare.local" && data.password === "demo123") {
      currentSession = { user: fallbackData.users[0], token: null };
      currentUser = currentSession.user;
      localStorage.setItem(sessionKey, JSON.stringify(currentSession));
      loadOffline();
      renderAll();
    } else {
      error.textContent = "Login failed. Please check email and password.";
    }
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (apiOnline && currentSession?.token) {
    api("/api/logout", { method: "POST" }).catch(() => {});
  }
  currentSession = null;
  currentUser = null;
  localStorage.removeItem(sessionKey);
  requireLogin();
});

document.getElementById("backupBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sundari-care-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("patientSearch").addEventListener("input", renderPatients);

document.getElementById("patientForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await postData("/api/patients", data, (payload) => {
    const patient = { id: `SC-${1001 + state.patients.length}`, ...payload, status: "Waiting", createdAt: new Date().toISOString() };
    state.patients.unshift(patient);
    selectedPatientId = patient.id;
  });
  resetForm(form);
});

document.addEventListener("click", (event) => {
  const patientId = event.target.dataset.selectPatient;
  if (patientId) {
    selectedPatientId = patientId;
    if (event.target.dataset.goDoctor) setView("doctor");
    renderDoctor();
    return;
  }

  const prescriptionId = event.target.dataset.printPrescription;
  if (prescriptionId) {
    const prescription = state.prescriptions.find((item) => item.id === prescriptionId);
    if (prescription) openPrintModal("Prescription Print Preview", prescriptionDocument(prescription));
    return;
  }

  const billId = event.target.dataset.printBill;
  if (billId) {
    const bill = state.bills.find((item) => item.id === billId);
    if (bill) openPrintModal("Receipt Print Preview", billDocument(bill));
    return;
  }

  const pharmacyId = event.target.dataset.printPharmacy;
  if (pharmacyId) {
    const sale = state.pharmacySales.find((item) => item.id === pharmacyId);
    if (sale) openPrintModal("Pharmacy Bill Print Preview", pharmacyDocument(sale));
  }
});

document.getElementById("prescriptionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedPatientId) return;
  const form = event.currentTarget;
  const data = { patientId: selectedPatientId, ...Object.fromEntries(new FormData(form)) };
  await postData("/api/prescriptions", data, (payload) => {
    state.prescriptions.unshift({ id: `RX-${Date.now()}`, date: new Date().toLocaleDateString("en-IN"), ...payload });
    const patient = state.patients.find((item) => item.id === selectedPatientId);
    if (patient) patient.status = "Completed";
  });
  resetForm(form);
});

document.getElementById("billForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await postData("/api/bills", data, (payload) => {
    const patient = state.patients.find((item) => item.id === payload.patient);
    const total = Math.max(Number(payload.amount) - Number(payload.discount || 0), 0);
    const paid = Number(payload.paid || 0);
    state.bills.unshift({
      id: `RCPT-${Date.now().toString().slice(-6)}`,
      patientId: payload.patient,
      patientName: patient?.name || "Walk-in",
      service: payload.service,
      total,
      paid,
      due: Math.max(total - paid, 0),
      mode: payload.mode,
      date: new Date().toLocaleDateString("en-IN")
    });
  });
});

document.getElementById("medicineForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await postData("/api/medicines", data, (payload) => {
    state.medicines.unshift({ id: `MED-${Date.now().toString().slice(-5)}`, ...payload, stock: Number(payload.stock), rate: Number(payload.rate) });
  });
  resetForm(form);
});

document.getElementById("pharmacySaleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await postData("/api/pharmacy-sales", data, (payload) => {
    const medicine = state.medicines.find((item) => item.id === payload.medicine);
    const patient = state.patients.find((item) => item.id === payload.patient);
    if (!medicine) return;
    const qty = Number(payload.qty || 0);
    const subtotal = qty * Number(medicine.rate || 0);
    const discount = Number(payload.discount || 0);
    medicine.stock = Math.max(Number(medicine.stock) - qty, 0);
    state.pharmacySales.unshift({
      id: `PH-${Date.now().toString().slice(-6)}`,
      patientId: payload.patient,
      patientName: patient?.name || "Walk-in",
      medicineId: medicine.id,
      medicineName: medicine.name,
      batch: medicine.batch,
      qty,
      rate: Number(medicine.rate || 0),
      discount,
      total: Math.max(subtotal - discount, 0),
      mode: payload.mode,
      date: new Date().toLocaleDateString("en-IN")
    });
  });
  resetForm(form);
});

document.getElementById("admissionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await postData("/api/admissions", data, (payload) => {
    const patient = state.patients.find((item) => item.id === payload.patient);
    state.admissions.unshift({
      id: `IPD-${Date.now().toString().slice(-6)}`,
      patientId: payload.patient,
      patientName: patient?.name || "Unknown patient",
      status: "Admitted",
      admittedAt: new Date().toLocaleDateString("en-IN"),
      ...payload
    });
  });
  resetForm(form);
});

document.getElementById("expenseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  await postData("/api/expenses", data, (payload) => {
    state.expenses.unshift({ id: `EXP-${Date.now().toString().slice(-6)}`, ...payload, amount: Number(payload.amount), date: payload.date || today() });
  });
  resetForm(form);
});

document.getElementById("userForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  showMessage("userFormMessage", "");
  try {
    state = await api("/api/users", { method: "POST", body: JSON.stringify(data) });
    resetForm(form);
    renderAll();
    showMessage("userFormMessage", "User created successfully.");
  } catch (error) {
    showMessage("userFormMessage", error.message, true);
  }
});

document.getElementById("passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  showMessage("passwordFormMessage", "");
  try {
    await api("/api/change-password", { method: "POST", body: JSON.stringify(data) });
    resetForm(form);
    showMessage("passwordFormMessage", "Password updated. Use the new password next time.");
  } catch (error) {
    showMessage("passwordFormMessage", error.message, true);
  }
});

document.getElementById("seedMeds").addEventListener("click", () => {
  state.medicines = structuredClone(fallbackData.medicines);
  saveOffline();
  renderAll();
});

document.getElementById("printBtn").addEventListener("click", () => window.print());
document.getElementById("modalPrintBtn").addEventListener("click", () => window.print());
document.getElementById("modalCloseBtn").addEventListener("click", closePrintModal);
document.getElementById("printModal").addEventListener("click", (event) => {
  if (event.target.id === "printModal") closePrintModal();
});

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = today();
});

requireLogin();
loadBootstrap();
