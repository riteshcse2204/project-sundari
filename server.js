const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const dataFile = path.join(root, "data", "db.json");
const port = Number(process.env.PORT || 4174);
const sessions = new Map();
let writeQueue = Promise.resolve();
let pgPool = null;
let storageMode = "json-file";
let storageError = null;

const permissions = {
  viewDashboard: ["Admin", "Doctor", "Reception", "Pharmacy", "Nurse", "Accountant"],
  managePatients: ["Admin", "Reception"],
  prescribe: ["Admin", "Doctor"],
  bill: ["Admin", "Reception", "Accountant"],
  pharmacy: ["Admin", "Pharmacy"],
  ipd: ["Admin", "Reception", "Nurse"],
  reports: ["Admin", "Accountant"],
  admin: ["Admin"]
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

async function readJsonDb() {
  const text = await fs.readFile(dataFile, "utf-8");
  return JSON.parse(text);
}

async function writeJsonDb(db) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    const tmpFile = `${dataFile}.tmp`;
    await fs.writeFile(tmpFile, `${JSON.stringify(db, null, 2)}\n`);
    await fs.rename(tmpFile, dataFile);
  });
  return writeQueue;
}

async function initStorage() {
  if (!process.env.DATABASE_URL) return;
  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch (error) {
    throw new Error("DATABASE_URL is set but the pg package is not installed. Run npm install before starting the server.");
  }

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 5,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const existing = await pgPool.query("SELECT id FROM app_state WHERE id = $1", ["default"]);
  if (!existing.rowCount) {
    const seed = await readJsonDb();
    await pgPool.query(
      "INSERT INTO app_state (id, data, updated_at) VALUES ($1, $2::jsonb, now())",
      ["default", JSON.stringify(seed)]
    );
  }
  storageMode = "postgresql";
  storageError = null;
}

async function readDb() {
  if (!pgPool) return readJsonDb();
  const result = await pgPool.query("SELECT data FROM app_state WHERE id = $1", ["default"]);
  if (!result.rowCount) {
    const seed = await readJsonDb();
    await writeDb(seed);
    return seed;
  }
  return result.rows[0].data;
}

async function writeDb(db) {
  if (!pgPool) return writeJsonDb(db);
  writeQueue = writeQueue.then(() => pgPool.query(
    `INSERT INTO app_state (id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    ["default", JSON.stringify(db)]
  ));
  return writeQueue;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function publicDb(db) {
  return {
    users: db.users.map(({ password, passwordHash, passwordSalt, ...user }) => user),
    patients: db.patients,
    prescriptions: db.prescriptions,
    bills: db.bills,
    medicines: db.medicines,
    pharmacySales: db.pharmacySales || [],
    admissions: db.admissions,
    expenses: db.expenses,
    auditLogs: db.auditLogs.slice(0, 50)
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordSalt: salt, passwordHash: hash };
}

function verifyPassword(user, password) {
  if (user.passwordHash && user.passwordSalt) {
    const { passwordHash } = hashPassword(password, user.passwordSalt);
    return crypto.timingSafeEqual(Buffer.from(passwordHash, "hex"), Buffer.from(user.passwordHash, "hex"));
  }
  return user.password === password;
}

function issueSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    issuedAt: Date.now()
  });
  return token;
}

function authUser(req, db) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) return null;
  const { password, passwordHash, passwordSalt, ...safeUser } = user;
  return safeUser;
}

function requirePermission(req, res, db, permission) {
  const user = authUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: "Please login again" });
    return null;
  }
  if (!permissions[permission]?.includes(user.role)) {
    sendJson(res, 403, { error: "You do not have permission for this action" });
    return null;
  }
  return user;
}

function nextId(prefix, collection) {
  return `${prefix}-${Date.now().toString().slice(-7)}`;
}

function addAudit(db, user, action, entity) {
  db.auditLogs.unshift({
    id: nextId("LOG", db.auditLogs),
    user: user || "System",
    action,
    entity,
    createdAt: new Date().toISOString()
  });
}

function normalizeSaleItems(body, db) {
  const requestedItems = Array.isArray(body.items) && body.items.length ? body.items : [{ medicine: body.medicine, qty: body.qty }];
  return requestedItems.map((item) => {
    const isManual = item.type === "manual" || !item.medicine;
    const stockMedicine = isManual ? null : db.medicines.find((medicine) => medicine.id === item.medicine);
    const qty = Number(item.qty || 0);
    const rate = isManual ? Number(item.rate || 0) : Number(stockMedicine?.rate || item.rate || 0);
    return {
      type: isManual ? "manual" : "stock",
      medicineId: stockMedicine?.id || null,
      medicineName: isManual ? String(item.name || "").trim() : stockMedicine?.name,
      batch: isManual ? String(item.batch || "Manual").trim() : stockMedicine?.batch,
      qty,
      rate,
      total: qty * rate,
      stockMedicine
    };
  });
}

function normalizeBillItems(body) {
  const requestedItems = Array.isArray(body.items) && body.items.length
    ? body.items
    : [{ service: body.service, description: body.service, qty: 1, rate: body.amount }];
  return requestedItems.map((item) => {
    const description = String(item.description || item.service || "").trim();
    const qty = Number(item.qty || 1);
    const rate = Number(item.rate || item.amount || 0);
    return {
      description,
      qty,
      rate,
      total: qty * rate
    };
  });
}

async function handleApi(req, res, pathname) {
  const db = await readDb();

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      app: "Sundari Care & Nursing Home",
      storage: storageMode,
      storageError,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const user = requirePermission(req, res, db, "viewDashboard");
    if (!user) return;
    return sendJson(res, 200, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await collectBody(req);
    const user = db.users.find((item) => item.email === body.email);
    if (!user || !verifyPassword(user, body.password || "")) {
      return sendJson(res, 401, { error: "Invalid email or password" });
    }
    if (!user.passwordHash) {
      Object.assign(user, hashPassword(body.password));
      delete user.password;
      await writeDb(db);
    }
    const token = issueSession(user);
    const { password, passwordHash, passwordSalt, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser, token, permissions });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const user = requirePermission(req, res, db, "admin");
    if (!user) return;
    const body = await collectBody(req);
    if (!body.name || !body.email || !body.role || !body.password) {
      return sendJson(res, 400, { error: "Name, email, role and password are required" });
    }
    if (!Object.values(permissions).some((roles) => roles.includes(body.role))) {
      return sendJson(res, 400, { error: "Invalid role selected" });
    }
    if (db.users.some((item) => item.email.toLowerCase() === body.email.toLowerCase())) {
      return sendJson(res, 409, { error: "A user with this email already exists" });
    }
    if (String(body.password).length < 6) {
      return sendJson(res, 400, { error: "Password must be at least 6 characters" });
    }

    const newUser = {
      id: nextId("USR", db.users),
      name: body.name,
      email: body.email.toLowerCase(),
      role: body.role,
      ...hashPassword(body.password),
      isActive: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    addAudit(db, user.name, "Created user", newUser.email);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/change-password") {
    const user = authUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Please login again" });

    const body = await collectBody(req);
    const dbUser = db.users.find((item) => item.id === user.id);
    if (!dbUser || !verifyPassword(dbUser, body.currentPassword || "")) {
      return sendJson(res, 400, { error: "Current password is incorrect" });
    }
    if (!body.newPassword || String(body.newPassword).length < 6) {
      return sendJson(res, 400, { error: "New password must be at least 6 characters" });
    }
    Object.assign(dbUser, hashPassword(body.newPassword));
    delete dbUser.password;
    addAudit(db, user.name, "Changed password", user.email);
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/patients") {
    const user = requirePermission(req, res, db, "managePatients");
    if (!user) return;
    const body = await collectBody(req);
    if (!body.name || !body.age || !body.mobile) {
      return sendJson(res, 400, { error: "Name, age and mobile are required" });
    }
    const patient = {
      id: `SC-${1001 + db.patients.length}`,
      ...body,
      status: "Waiting",
      createdAt: new Date().toISOString()
    };
    db.patients.unshift(patient);
    addAudit(db, user.name, "Registered patient", patient.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/prescriptions") {
    const user = requirePermission(req, res, db, "prescribe");
    if (!user) return;
    const body = await collectBody(req);
    const prescription = {
      id: nextId("RX", db.prescriptions),
      date: new Date().toLocaleDateString("en-IN"),
      ...body
    };
    db.prescriptions.unshift(prescription);
    const patient = db.patients.find((item) => item.id === body.patientId);
    if (patient) patient.status = "Completed";
    addAudit(db, user.name, "Saved prescription", prescription.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/bills") {
    const user = requirePermission(req, res, db, "bill");
    if (!user) return;
    const body = await collectBody(req);
    const patient = db.patients.find((item) => item.id === body.patient);
    const items = normalizeBillItems(body);
    if (!items.length) return sendJson(res, 400, { error: "Add at least one billing item" });
    for (const item of items) {
      if (!item.description) return sendJson(res, 400, { error: "Billing item name is required" });
      if (item.qty <= 0) return sendJson(res, 400, { error: "Quantity must be greater than zero" });
      if (item.rate < 0) return sendJson(res, 400, { error: "Rate cannot be negative" });
    }
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = Number(body.discount || 0);
    const total = Math.max(subtotal - discount, 0);
    const paid = Number(body.paid || 0);
    const bill = {
      id: nextId("RCPT", db.bills),
      patientId: body.patient,
      patientName: patient?.name || "Walk-in",
      service: items.map((item) => item.description).join(", "),
      items,
      subtotal,
      discount,
      total,
      paid,
      due: Math.max(total - paid, 0),
      mode: body.mode,
      date: new Date().toLocaleDateString("en-IN")
    };
    db.bills.unshift(bill);
    addAudit(db, user.name, "Generated bill", bill.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/medicines") {
    const user = requirePermission(req, res, db, "pharmacy");
    if (!user) return;
    const body = await collectBody(req);
    const medicine = {
      id: nextId("MED", db.medicines),
      ...body,
      stock: Number(body.stock || 0),
      rate: Number(body.rate || 0)
    };
    db.medicines.unshift(medicine);
    addAudit(db, user.name, "Added medicine stock", medicine.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/pharmacy-sales") {
    const user = requirePermission(req, res, db, "pharmacy");
    if (!user) return;
    const body = await collectBody(req);
    const items = normalizeSaleItems(body, db);
    if (!items.length) return sendJson(res, 400, { error: "Add at least one medicine" });
    for (const item of items) {
      if (!item.medicineName) return sendJson(res, 400, { error: "Medicine name is required" });
      if (item.qty <= 0) return sendJson(res, 400, { error: "Quantity must be greater than zero" });
      if (item.rate < 0) return sendJson(res, 400, { error: "Rate cannot be negative" });
      if (item.type === "stock" && !item.stockMedicine) return sendJson(res, 404, { error: "Medicine not found" });
      if (item.type === "stock" && Number(item.stockMedicine.stock) < item.qty) {
        return sendJson(res, 400, { error: `${item.medicineName} does not have enough stock` });
      }
    }

    const patient = db.patients.find((item) => item.id === body.patient);
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = Number(body.discount || 0);
    const total = Math.max(subtotal - discount, 0);
    const sale = {
      id: nextId("PH", db.pharmacySales || []),
      patientId: body.patient,
      patientName: patient?.name || "Walk-in",
      medicineId: items[0].medicineId,
      medicineName: items.map((item) => item.medicineName).join(", "),
      batch: items.map((item) => item.batch).join(", "),
      qty: items.reduce((sum, item) => sum + item.qty, 0),
      rate: items.length === 1 ? items[0].rate : 0,
      items: items.map(({ stockMedicine, ...item }) => item),
      subtotal,
      discount,
      total,
      mode: body.mode,
      date: new Date().toLocaleDateString("en-IN")
    };

    items.forEach((item) => {
      if (item.stockMedicine) item.stockMedicine.stock = Number(item.stockMedicine.stock) - item.qty;
    });
    db.pharmacySales = db.pharmacySales || [];
    db.pharmacySales.unshift(sale);
    addAudit(db, user.name, "Pharmacy sale", sale.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/admissions") {
    const user = requirePermission(req, res, db, "ipd");
    if (!user) return;
    const body = await collectBody(req);
    const patient = db.patients.find((item) => item.id === body.patient);
    const admission = {
      id: nextId("IPD", db.admissions),
      patientId: body.patient,
      patientName: patient?.name || "Unknown patient",
      status: "Admitted",
      admittedAt: new Date().toLocaleDateString("en-IN"),
      ...body
    };
    db.admissions.unshift(admission);
    addAudit(db, user.name, "Admitted patient", admission.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (req.method === "POST" && pathname === "/api/expenses") {
    const user = requirePermission(req, res, db, "reports");
    if (!user) return;
    const body = await collectBody(req);
    const expense = {
      id: nextId("EXP", db.expenses),
      ...body,
      amount: Number(body.amount || 0),
      date: body.date || new Date().toISOString().slice(0, 10)
    };
    db.expenses.unshift(expense);
    addAudit(db, user.name, "Recorded expense", expense.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  /* Legacy route block intentionally kept unreachable during patch migration. */
  if (false && req.method === "POST" && pathname === "/api/login") {
    const body = await collectBody(req);
    const user = db.users.find((item) => item.email === body.email && item.password === body.password);
    if (!user) return sendJson(res, 401, { error: "Invalid email or password" });
    const { password, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser, token: `${safeUser.id}.${Date.now()}.sundari` });
  }

  if (false && req.method === "POST" && pathname === "/api/patients") {
    const body = await collectBody(req);
    const patient = {
      id: `SC-${1001 + db.patients.length}`,
      ...body,
      status: "Waiting",
      createdAt: new Date().toISOString()
    };
    db.patients.unshift(patient);
    addAudit(db, body.createdBy, "Registered patient", patient.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (false && req.method === "POST" && pathname === "/api/prescriptions") {
    const body = await collectBody(req);
    const prescription = {
      id: nextId("RX", db.prescriptions),
      date: new Date().toLocaleDateString("en-IN"),
      ...body
    };
    db.prescriptions.unshift(prescription);
    const patient = db.patients.find((item) => item.id === body.patientId);
    if (patient) patient.status = "Completed";
    addAudit(db, body.createdBy, "Saved prescription", prescription.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (false && req.method === "POST" && pathname === "/api/bills") {
    const body = await collectBody(req);
    const patient = db.patients.find((item) => item.id === body.patient);
    const total = Math.max(Number(body.amount) - Number(body.discount || 0), 0);
    const paid = Number(body.paid || 0);
    const bill = {
      id: nextId("RCPT", db.bills),
      patientId: body.patient,
      patientName: patient?.name || "Walk-in",
      service: body.service,
      total,
      paid,
      due: Math.max(total - paid, 0),
      mode: body.mode,
      date: new Date().toLocaleDateString("en-IN")
    };
    db.bills.unshift(bill);
    addAudit(db, body.createdBy, "Generated bill", bill.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (false && req.method === "POST" && pathname === "/api/medicines") {
    const body = await collectBody(req);
    const medicine = {
      id: nextId("MED", db.medicines),
      ...body,
      stock: Number(body.stock || 0),
      rate: Number(body.rate || 0)
    };
    db.medicines.unshift(medicine);
    addAudit(db, body.createdBy, "Added medicine stock", medicine.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (false && req.method === "POST" && pathname === "/api/pharmacy-sales") {
    const body = await collectBody(req);
    const medicine = db.medicines.find((item) => item.id === body.medicine);
    if (!medicine) return sendJson(res, 404, { error: "Medicine not found" });

    const qty = Number(body.qty || 0);
    if (qty <= 0) return sendJson(res, 400, { error: "Quantity must be greater than zero" });
    if (Number(medicine.stock) < qty) return sendJson(res, 400, { error: "Not enough stock available" });

    const patient = db.patients.find((item) => item.id === body.patient);
    const subtotal = qty * Number(medicine.rate || 0);
    const discount = Number(body.discount || 0);
    const total = Math.max(subtotal - discount, 0);
    const sale = {
      id: nextId("PH", db.pharmacySales || []),
      patientId: body.patient,
      patientName: patient?.name || "Walk-in",
      medicineId: medicine.id,
      medicineName: medicine.name,
      batch: medicine.batch,
      qty,
      rate: Number(medicine.rate || 0),
      discount,
      total,
      mode: body.mode,
      date: new Date().toLocaleDateString("en-IN")
    };

    medicine.stock = Number(medicine.stock) - qty;
    db.pharmacySales = db.pharmacySales || [];
    db.pharmacySales.unshift(sale);
    addAudit(db, body.createdBy, "Pharmacy sale", sale.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (false && req.method === "POST" && pathname === "/api/admissions") {
    const body = await collectBody(req);
    const patient = db.patients.find((item) => item.id === body.patient);
    const admission = {
      id: nextId("IPD", db.admissions),
      patientId: body.patient,
      patientName: patient?.name || "Unknown patient",
      status: "Admitted",
      admittedAt: new Date().toLocaleDateString("en-IN"),
      ...body
    };
    db.admissions.unshift(admission);
    addAudit(db, body.createdBy, "Admitted patient", admission.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  if (false && req.method === "POST" && pathname === "/api/expenses") {
    const body = await collectBody(req);
    const expense = {
      id: nextId("EXP", db.expenses),
      ...body,
      amount: Number(body.amount || 0),
      date: body.date || new Date().toISOString().slice(0, 10)
    };
    db.expenses.unshift(expense);
    addAudit(db, body.createdBy, "Recorded expense", expense.id);
    await writeDb(db);
    return sendJson(res, 201, publicDb(db));
  }

  return sendJson(res, 404, { error: "API route not found" });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, safePath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url.pathname);
    }
    return await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

initStorage()
  .catch((error) => {
    storageMode = "postgresql-error";
    storageError = error.message;
    pgPool = null;
    console.error("Failed to initialize PostgreSQL storage. Falling back to json-file storage:", error.message);
  })
  .finally(() => {
    server.listen(port, () => {
      console.log(`Sundari Care server running at http://localhost:${port} using ${storageMode} storage`);
    });
  });
