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
let billItemCounter = 0;
let saleItemCounter = 0;

const clinic = {
  name: "Sundari Care & Nursing Home",
  address: "New Bypass Road, East Ashokchak, Patna 800016",
  phones: "9113420207, 9472655788, 6205471960"
};

const doctorOptions = [
  "Dr. Vimal Kumar",
  "Dr. Krishnandan Kumar",
  "Dr. Yogesh Kumar",
  "Dr. RK Ranjan"
];

const billServicePresets = [
  { label: "Nursing charge", rate: 0 },
  { label: "OPD", rate: 0 },
  { label: "Bed charge", rate: 0 },
  { label: "Doctor visit", rate: 0 },
  { label: "Nebulization", rate: 0 },
  { label: "Air bed", rate: 0 },
  { label: "Oxygen", rate: 0 },
  { label: "Infusion", rate: 0 },
  { label: "Dressing", rate: 0 },
  { label: "CVP line", rate: 0 },
  { label: "Ryle's tube", rate: 0 },
  { label: "Foley's catheter", rate: 0 },
  { label: "Tracheostomy tube change", rate: 0 },
  { label: "RBS", rate: 0 }
];

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

function nextPatientId(patients) {
  const maxId = patients.reduce((max, patient) => {
    const numericId = Number(String(patient.id || "").replace("SC-", ""));
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 1000);
  return `SC-${maxId + 1}`;
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

function medicineKey(medicine) {
  return [medicine.name, medicine.batch, medicine.expiry]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

async function syncOfflineMedicines(serverState) {
  const saved = localStorage.getItem(storeKey);
  if (!saved || !currentSession?.token) return serverState;

  let offlineState;
  try {
    offlineState = JSON.parse(saved);
  } catch {
    return serverState;
  }

  const serverMedicineKeys = new Set((serverState.medicines || []).map(medicineKey));
  const offlineMedicines = (offlineState.medicines || []).filter((medicine) => !serverMedicineKeys.has(medicineKey(medicine)));
  if (!offlineMedicines.length) {
    localStorage.removeItem(storeKey);
    return serverState;
  }

  let syncedState = serverState;
  for (const medicine of offlineMedicines) {
    const { id, ...payload } = medicine;
    syncedState = await api("/api/medicines", {
      method: "POST",
      body: JSON.stringify({ ...payload, createdBy: currentUser?.name || "Offline sync" })
    });
  }
  localStorage.removeItem(storeKey);
  return syncedState;
}

async function loadBootstrap() {
  try {
    state = await syncOfflineMedicines(await api("/api/bootstrap"));
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
      return true;
    } catch (error) {
      if (error.status) {
        alert(error.message);
        return false;
      }
      apiOnline = false;
    }
  }
  offlineHandler(enriched);
  saveOffline();
  renderAll();
  return true;
}

async function deletePatient(patientId) {
  if (!confirm("Delete this patient record? Existing bills and pharmacy bills will stay in reports.")) return;

  if (apiOnline) {
    try {
      state = await api(`/api/patients/${encodeURIComponent(patientId)}`, { method: "DELETE" });
      if (selectedPatientId === patientId) selectedPatientId = state.patients[0]?.id || null;
      renderAll();
      return;
    } catch (error) {
      if (error.status) {
        alert(error.message);
        return;
      }
      apiOnline = false;
    }
  }

  state.patients = state.patients.filter((patient) => patient.id !== patientId);
  state.prescriptions = state.prescriptions.filter((prescription) => prescription.patientId !== patientId);
  state.admissions = state.admissions.filter((admission) => admission.patientId !== patientId);
  if (selectedPatientId === patientId) selectedPatientId = state.patients[0]?.id || null;
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

function billServiceOptions() {
  return billServicePresets.map((service) => `<option value="${service.label}" data-rate="${service.rate}">${service.label}</option>`).join("");
}

function renderDoctorOptions() {
  const savedDoctors = [
    ...state.patients.map((patient) => patient.doctor),
    ...state.admissions.map((admission) => admission.doctor)
  ].filter(Boolean);
  const doctors = [...new Set([...doctorOptions, ...savedDoctors])];
  document.getElementById("doctorOptions").innerHTML = doctors.map((doctor) => `<option value="${doctor}"></option>`).join("");
}

function patientDetailDocument(patient) {
  const patientBills = state.bills.filter((bill) => bill.patientId === patient.id);
  const patientSales = (state.pharmacySales || []).filter((sale) => sale.patientId === patient.id);
  const patientAdmissions = state.admissions.filter((admission) => admission.patientId === patient.id);
  return `<div class="print-section">
    <h4>Patient Details</h4>
    <table class="print-table">
      <tr><th>Name</th><td>${patient.name}</td></tr>
      <tr><th>UHID</th><td>${patient.id}</td></tr>
      <tr><th>Age / Gender</th><td>${patient.age} / ${patient.gender}</td></tr>
      <tr><th>Mobile</th><td>${patient.mobile}</td></tr>
      <tr><th>Address</th><td>${patient.address || "-"}</td></tr>
      <tr><th>Doctor</th><td>${patient.doctor || "-"}</td></tr>
      <tr><th>Status</th><td>${patient.status}</td></tr>
      <tr><th>Registered</th><td>${patient.createdAt ? new Date(patient.createdAt).toLocaleString("en-IN") : "-"}</td></tr>
      <tr><th>OPD Bills</th><td>${patientBills.length}</td></tr>
      <tr><th>Pharmacy Bills</th><td>${patientSales.length}</td></tr>
      <tr><th>Admissions</th><td>${patientAdmissions.length}</td></tr>
    </table>
  </div>`;
}

function renderPatients() {
  const query = document.getElementById("patientSearch")?.value?.toLowerCase() || "";
  const patients = state.patients.filter((patient) => `${patient.name} ${patient.mobile} ${patient.id}`.toLowerCase().includes(query));
  document.getElementById("patientList").innerHTML = patients.length
    ? `<table class="table"><thead><tr><th>Patient</th><th>Mobile</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead><tbody>${patients.map((patient) => `
      <tr>
        <td><button class="link-button" data-patient-detail="${patient.id}" type="button"><strong>${patient.name}</strong><span>${patient.id} | ${patient.age}/${patient.gender}</span></button></td>
        <td>${patient.mobile}</td>
        <td>${patient.doctor}</td>
        <td><span class="badge">${patient.status}</span></td>
        <td class="action-cell">
          <button class="mini-button" data-select-patient="${patient.id}" data-go-doctor="true">Consult</button>
          <button class="mini-button danger-button" data-delete-patient="${patient.id}" type="button">Delete</button>
        </td>
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
        <td>${bill.service}<span>${bill.items?.length ? `${bill.items.length} items` : "Single item"}</span></td>
        <td>${currency(bill.total)}</td>
        <td>${currency(bill.paid)}</td>
        <td>${currency(bill.due)}</td>
        <td><button class="mini-button" data-print-bill="${bill.id}">Print</button></td>
      </tr>`).join("")}</tbody></table>`
    : `<div class="empty">No bills generated yet.</div>`;
}

function renderMedicines() {
  document.querySelectorAll(".sale-medicine").forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = medicineOptions();
    if (currentValue) select.value = currentValue;
  });
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
        <td>${sale.medicineName}<span>${sale.items?.length ? `${sale.items.length} items` : `Batch ${sale.batch}`}</span></td>
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
  renderDoctorOptions();
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

function addBillItem(type = "service") {
  const itemId = `bill-item-${++billItemCounter}`;
  const isManual = type === "manual";
  const row = document.createElement("div");
  row.className = "sale-item bill-item";
  row.dataset.billItem = itemId;
  row.dataset.type = type;
  row.innerHTML = isManual
    ? `<label>Manual Item<input data-bill-description placeholder="Item name" required /></label>
      <label>Rate<input data-bill-rate type="number" min="0" value="0" required /></label>
      <label>Qty<input data-bill-qty type="number" min="1" value="1" required /></label>
      <button class="mini-button remove-bill-item" type="button">Remove</button>`
    : `<label>Service<select class="bill-service" data-bill-service required>${billServiceOptions()}</select></label>
      <label>Rate<input data-bill-rate type="number" min="0" value="${billServicePresets[0].rate}" required /></label>
      <label>Qty<input data-bill-qty type="number" min="1" value="1" required /></label>
      <button class="mini-button remove-bill-item" type="button">Remove</button>`;
  document.getElementById("billItems").append(row);
  updateBillItemRate(row);
  updateBillTotalPreview();
}

function updateBillItemRate(row) {
  const select = row.querySelector("[data-bill-service]");
  const rateInput = row.querySelector("[data-bill-rate]");
  if (!select || !rateInput) return;
  const service = billServicePresets.find((item) => item.label === select.value);
  rateInput.value = service?.rate || rateInput.value || 0;
}

function collectBillItems() {
  return [...document.querySelectorAll("[data-bill-item]")].map((row) => {
    const qty = Number(row.querySelector("[data-bill-qty]")?.value || 0);
    const rate = Number(row.querySelector("[data-bill-rate]")?.value || 0);
    const description = row.dataset.type === "manual"
      ? row.querySelector("[data-bill-description]")?.value?.trim()
      : row.querySelector("[data-bill-service]")?.value;
    return { description, qty, rate };
  });
}

function updateBillTotalPreview() {
  const discount = Number(document.querySelector("#billForm [name='discount']")?.value || 0);
  const paidInput = document.querySelector("#billForm [name='paid']");
  const subtotal = collectBillItems().reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0);
  const total = Math.max(subtotal - discount, 0);
  document.getElementById("billTotalPreview").textContent = `Subtotal: ${currency(subtotal)} | Discount: ${currency(discount)} | Total: ${currency(total)}`;
  if (paidInput && (!paidInput.dataset.touched || Number(paidInput.value || 0) === 0)) {
    paidInput.value = total;
  }
}

function resetBillItems() {
  document.getElementById("billItems").innerHTML = "";
  addBillItem("service");
}

function addSaleItem(type = "stock") {
  const itemId = `sale-item-${++saleItemCounter}`;
  const isManual = type === "manual";
  const row = document.createElement("div");
  row.className = "sale-item";
  row.dataset.saleItem = itemId;
  row.dataset.type = type;
  row.innerHTML = isManual
    ? `<label>Manual Medicine<input data-sale-name placeholder="Medicine name" required /></label>
      <label>Batch<input data-sale-batch placeholder="Manual / batch" /></label>
      <label>Rate<input data-sale-rate type="number" min="0" value="0" required /></label>
      <label>Qty<input data-sale-qty type="number" min="1" value="1" required /></label>
      <button class="mini-button remove-sale-item" type="button">Remove</button>`
    : `<label>Stock Medicine<select class="sale-medicine" data-sale-medicine required>${medicineOptions()}</select></label>
      <label>Qty<input data-sale-qty type="number" min="1" value="1" required /></label>
      <button class="mini-button remove-sale-item" type="button">Remove</button>`;
  document.getElementById("saleItems").append(row);
  updateSaleTotalPreview();
}

function collectSaleItems() {
  return [...document.querySelectorAll("[data-sale-item]")].map((row) => {
    const qty = Number(row.querySelector("[data-sale-qty]")?.value || 0);
    if (row.dataset.type === "manual") {
      return {
        type: "manual",
        name: row.querySelector("[data-sale-name]")?.value?.trim(),
        batch: row.querySelector("[data-sale-batch]")?.value?.trim() || "Manual",
        rate: Number(row.querySelector("[data-sale-rate]")?.value || 0),
        qty
      };
    }
    return {
      type: "stock",
      medicine: row.querySelector("[data-sale-medicine]")?.value,
      qty
    };
  });
}

function saleItemAmount(item) {
  if (item.type === "manual") return Number(item.qty || 0) * Number(item.rate || 0);
  const medicine = state.medicines.find((entry) => entry.id === item.medicine);
  return Number(item.qty || 0) * Number(medicine?.rate || 0);
}

function updateSaleTotalPreview() {
  const discount = Number(document.querySelector("#pharmacySaleForm [name='discount']")?.value || 0);
  const subtotal = collectSaleItems().reduce((sum, item) => sum + saleItemAmount(item), 0);
  document.getElementById("saleTotalPreview").textContent = `Subtotal: ${currency(subtotal)} | Discount: ${currency(discount)} | Total: ${currency(Math.max(subtotal - discount, 0))}`;
}

function resetSaleItems() {
  document.getElementById("saleItems").innerHTML = "";
  addSaleItem("stock");
}

function letterhead(title, id, date) {
  return `<div class="print-letterhead">
    <div class="clinic-heading">
      <h2>${clinic.name}</h2>
      <p>${clinic.address}</p>
      <p>Phone: ${clinic.phones}</p>
    </div>
    <div class="print-meta">
      <strong>${title}</strong>
      <p>${id}</p>
      <p>${date || new Date().toLocaleDateString("en-IN")}</p>
    </div>
  </div>`;
}

function openPrintModal(title, html) {
  document.getElementById("printTitle").textContent = title;
  document.getElementById("printDocument").innerHTML = html;
  document.body.classList.add("printing-modal");
  document.getElementById("printModal").classList.add("open");
  document.getElementById("printModal").setAttribute("aria-hidden", "false");
}

function closePrintModal() {
  document.body.classList.remove("printing-modal");
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
  const patient = state.patients.find((item) => item.id === bill.patientId);
  const items = bill.items?.length
    ? bill.items
    : [{
        description: bill.service,
        qty: 1,
        rate: Number(bill.total || 0) + Number(bill.discount || 0),
        total: Number(bill.total || 0) + Number(bill.discount || 0)
      }];
  return `${letterhead("Receipt", bill.id, bill.date)}
    <div class="print-section">
      <h4>Patient Details</h4>
      <table class="print-table patient-summary-table">
        <tr><th>Patient</th><td>${bill.patientName}</td></tr>
        <tr><th>UHID</th><td>${bill.patientId || "-"}</td></tr>
        <tr><th>Age / Gender</th><td>${patient ? `${patient.age} / ${patient.gender}` : "-"}</td></tr>
        <tr><th>Mobile</th><td>${patient?.mobile || "-"}</td></tr>
        <tr><th>Address</th><td>${patient?.address || "-"}</td></tr>
      </table>
    </div>
    <div class="print-section">
      <h4>Bill Items</h4>
      <table class="print-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${items.map((item) => `<tr>
          <td>${item.description}</td>
          <td>${item.qty}</td>
          <td>${currency(item.rate)}</td>
          <td>${currency(item.total)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="print-section">
      <h4>Payment</h4>
      <table class="print-table">
        <tr><th>Subtotal</th><td>${currency(bill.subtotal || items.reduce((sum, item) => sum + Number(item.total || 0), 0))}</td></tr>
        <tr><th>Discount</th><td>${currency(bill.discount)}</td></tr>
        <tr><th>Total</th><td>${currency(bill.total)}</td></tr>
        <tr><th>Paid</th><td>${currency(bill.paid)}</td></tr>
        <tr><th>Due</th><td>${currency(bill.due)}</td></tr>
        <tr><th>Mode</th><td>${bill.mode}</td></tr>
      </table>
    </div>
    <div class="print-section"><p>Authorized by: ${currentUser?.name || "Sundari Care"}</p></div>`;
}

function pharmacyDocument(sale) {
  const patient = state.patients.find((item) => item.id === sale.patientId);
  const items = sale.items?.length
    ? sale.items
    : [{
        medicineName: sale.medicineName,
        batch: sale.batch,
        qty: sale.qty,
        rate: sale.rate,
        total: Number(sale.qty || 0) * Number(sale.rate || 0)
      }];
  return `${letterhead("Pharmacy Bill", sale.id, sale.date)}
    <div class="print-section">
      <h4>Patient Details</h4>
      <table class="print-table patient-summary-table">
        <tr><th>Patient</th><td>${sale.patientName}</td></tr>
        <tr><th>UHID</th><td>${sale.patientId || "-"}</td></tr>
        <tr><th>Age / Gender</th><td>${patient ? `${patient.age} / ${patient.gender}` : "-"}</td></tr>
        <tr><th>Mobile</th><td>${patient?.mobile || "-"}</td></tr>
      </table>
    </div>
    <div class="rx-divider"><span></span><strong>Rx</strong><span></span></div>
    <div class="print-section">
      <h4>Medicines</h4>
      <table class="print-table">
        <thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${items.map((item) => `<tr>
          <td>${item.medicineName}</td>
          <td>${item.batch || "-"}</td>
          <td>${item.qty}</td>
          <td>${currency(item.rate)}</td>
          <td>${currency(item.total)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="print-section">
      <h4>Payment</h4>
      <table class="print-table">
        <tr><th>Subtotal</th><td>${currency(sale.subtotal || items.reduce((sum, item) => sum + Number(item.total || 0), 0))}</td></tr>
        <tr><th>Discount</th><td>${currency(sale.discount)}</td></tr>
        <tr><th>Total</th><td>${currency(sale.total)}</td></tr>
        <tr><th>Mode</th><td>${sale.mode}</td></tr>
      </table>
    </div>`;
}

document.querySelectorAll("[data-view], [data-view-target]").forEach((control) => {
  control.addEventListener("click", () => setView(control.dataset.view || control.dataset.viewTarget));
});

document.querySelectorAll("[data-login-note]").forEach((button) => {
  button.addEventListener("click", () => {
    const note = document.getElementById("loginNote");
    note.textContent = button.dataset.loginNote === "account"
      ? "New staff accounts are created only by Admin from Admin > Create Staff User. Admin can create IDs for doctor, reception, billing, pharmacy, nursing and accounts users."
      : "For password reset, contact Admin. Admin can create a new staff login or update access from the Admin section.";
  });
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
    const patient = { id: nextPatientId(state.patients), ...payload, status: "Waiting", createdAt: new Date().toISOString() };
    state.patients.unshift(patient);
    selectedPatientId = patient.id;
  });
  resetForm(form);
});

document.addEventListener("click", (event) => {
  const deletePatientId = event.target.dataset.deletePatient;
  if (deletePatientId) {
    deletePatient(deletePatientId);
    return;
  }

  const detailPatientId = event.target.closest("[data-patient-detail]")?.dataset.patientDetail;
  if (detailPatientId) {
    const patient = state.patients.find((item) => item.id === detailPatientId);
    if (patient) openPrintModal("Patient Details", patientDetailDocument(patient));
    return;
  }

  if (event.target.classList.contains("remove-bill-item")) {
    event.target.closest("[data-bill-item]")?.remove();
    if (!document.querySelector("[data-bill-item]")) addBillItem("service");
    updateBillTotalPreview();
    return;
  }

  if (event.target.classList.contains("remove-sale-item")) {
    event.target.closest("[data-sale-item]")?.remove();
    if (!document.querySelector("[data-sale-item]")) addSaleItem("stock");
    updateSaleTotalPreview();
    return;
  }

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

document.getElementById("addServiceBillItem").addEventListener("click", () => addBillItem("service"));
document.getElementById("addManualBillItem").addEventListener("click", () => addBillItem("manual"));
document.getElementById("billForm").addEventListener("input", (event) => {
  if (event.target.name === "paid") event.target.dataset.touched = "true";
  updateBillTotalPreview();
});
document.getElementById("billForm").addEventListener("change", (event) => {
  const row = event.target.closest("[data-bill-item]");
  if (row && event.target.matches("[data-bill-service]")) updateBillItemRate(row);
  updateBillTotalPreview();
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
  const data = { ...Object.fromEntries(new FormData(form)), items: collectBillItems() };
  const saved = await postData("/api/bills", data, (payload) => {
    const patient = state.patients.find((item) => item.id === payload.patient);
    const items = payload.items.map((item) => ({
      description: item.description,
      qty: Number(item.qty || 0),
      rate: Number(item.rate || 0),
      total: Number(item.qty || 0) * Number(item.rate || 0)
    }));
    if (items.some((item) => !item.description || item.qty <= 0)) return;
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = Number(payload.discount || 0);
    const total = Math.max(subtotal - discount, 0);
    const paid = Number(payload.paid || 0);
    state.bills.unshift({
      id: `RCPT-${Date.now().toString().slice(-6)}`,
      patientId: payload.patient,
      patientName: patient?.name || "Walk-in",
      service: items.map((item) => item.description).join(", "),
      items,
      subtotal,
      discount,
      total,
      paid,
      due: Math.max(total - paid, 0),
      mode: payload.mode,
      date: new Date().toLocaleDateString("en-IN")
    });
  });
  if (saved) {
    resetForm(form);
    form.querySelector("[name='paid']").dataset.touched = "";
    resetBillItems();
  }
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

document.getElementById("addStockSaleItem").addEventListener("click", () => addSaleItem("stock"));
document.getElementById("addManualSaleItem").addEventListener("click", () => addSaleItem("manual"));
document.getElementById("pharmacySaleForm").addEventListener("input", updateSaleTotalPreview);
document.getElementById("pharmacySaleForm").addEventListener("change", updateSaleTotalPreview);

document.getElementById("pharmacySaleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = { ...Object.fromEntries(new FormData(form)), items: collectSaleItems() };
  if (!data.items.length) return;
  const saved = await postData("/api/pharmacy-sales", data, (payload) => {
    const patient = state.patients.find((item) => item.id === payload.patient);
    const items = payload.items.map((item) => {
      if (item.type === "manual") {
        return {
          type: "manual",
          medicineId: null,
          medicineName: item.name,
          batch: item.batch || "Manual",
          qty: Number(item.qty || 0),
          rate: Number(item.rate || 0),
          total: Number(item.qty || 0) * Number(item.rate || 0)
        };
      }
      const medicine = state.medicines.find((entry) => entry.id === item.medicine);
      return {
        type: "stock",
        medicineId: medicine?.id,
        medicineName: medicine?.name || "Stock medicine",
        batch: medicine?.batch || "-",
        qty: Number(item.qty || 0),
        rate: Number(medicine?.rate || 0),
        total: Number(item.qty || 0) * Number(medicine?.rate || 0),
        medicine
      };
    });
    if (items.some((item) => !item.medicineName || item.qty <= 0)) return;
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = Number(payload.discount || 0);
    items.forEach((item) => {
      if (item.medicine) item.medicine.stock = Math.max(Number(item.medicine.stock) - item.qty, 0);
    });
    state.pharmacySales.unshift({
      id: `PH-${Date.now().toString().slice(-6)}`,
      patientId: payload.patient,
      patientName: patient?.name || "Walk-in",
      medicineId: items[0].medicineId,
      medicineName: items.map((item) => item.medicineName).join(", "),
      batch: items.map((item) => item.batch).join(", "),
      qty: items.reduce((sum, item) => sum + item.qty, 0),
      rate: items.length === 1 ? items[0].rate : 0,
      items: items.map(({ medicine, ...item }) => item),
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
      mode: payload.mode,
      date: new Date().toLocaleDateString("en-IN")
    });
  });
  if (saved) {
    resetForm(form);
    resetSaleItems();
  }
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

resetBillItems();
resetSaleItems();
requireLogin();
loadBootstrap();
