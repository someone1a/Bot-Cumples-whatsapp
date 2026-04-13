const currentYear = new Date().getFullYear();
let allBirthdays = [];

const birthdayGrid = document.getElementById("birthdayGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const groupFilter = document.getElementById("groupFilter");
const statusFilter = document.getElementById("statusFilter");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const birthdayForm = document.getElementById("birthdayForm");
const editId = document.getElementById("editId");
const fieldName = document.getElementById("fieldName");
const fieldDate = document.getElementById("fieldDate");
const fieldGroupName = document.getElementById("fieldGroupName");
const fieldGroupId = document.getElementById("fieldGroupId");
const fieldMessage = document.getElementById("fieldMessage");
const submitBtn = document.getElementById("submitBtn");
const errorName = document.getElementById("errorName");
const errorDate = document.getElementById("errorDate");

document.getElementById("openAddModal").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });

searchInput.addEventListener("input", renderGrid);
groupFilter.addEventListener("change", renderGrid);
statusFilter.addEventListener("change", renderGrid);

birthdayForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    name: fieldName.value.trim(),
    date: fieldDate.value.trim(),
    groupName: fieldGroupName.value.trim(),
    groupId: fieldGroupId.value.trim(),
    message: fieldMessage.value.trim() || null,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  try {
    if (editId.value) {
      await api("PUT", `/api/birthdays/${editId.value}`, payload);
      showToast("Cumpleaños actualizado", "success");
    } else {
      await api("POST", "/api/birthdays", payload);
      showToast("Cumpleaños agregado", "success");
    }
    closeModal();
    await loadBirthdays();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar";
  }
});

async function loadBirthdays() {
  try {
    allBirthdays = await api("GET", "/api/birthdays");
    updateStats();
    updateGroupFilter();
    renderGrid();
  } catch (err) {
    showToast("Error cargando datos: " + err.message, "error");
  }
}

function updateStats() {
  const total = allBirthdays.length;
  const sent = allBirthdays.filter(b => b._meta?.lastReminderYear === currentYear).length;
  const pending = total - sent;
  const groups = new Set(allBirthdays.map(b => b.groupName).filter(Boolean)).size;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statSent").textContent = sent;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statGroups").textContent = groups;
}

function updateGroupFilter() {
  const groups = [...new Set(allBirthdays.map(b => b.groupName).filter(Boolean))].sort();
  const current = groupFilter.value;
  groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
  groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    if (g === current) opt.selected = true;
    groupFilter.appendChild(opt);
  });
}

function renderGrid() {
  const search = searchInput.value.toLowerCase().trim();
  const group = groupFilter.value;
  const status = statusFilter.value;

  let filtered = allBirthdays.filter(b => {
    const matchSearch = !search ||
      b.name.toLowerCase().includes(search) ||
      (b.groupName || "").toLowerCase().includes(search);
    const matchGroup = !group || b.groupName === group;
    const sent = b._meta?.lastReminderYear === currentYear;
    const matchStatus = !status ||
      (status === "sent" && sent) ||
      (status === "pending" && !sent);
    return matchSearch && matchGroup && matchStatus;
  });

  filtered.sort((a, b) => {
    const [dayA, monthA] = a.date.split("-").map(Number);
    const [dayB, monthB] = b.date.split("-").map(Number);
    return monthA === monthB ? dayA - dayB : monthA - monthB;
  });

  birthdayGrid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    birthdayGrid.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  birthdayGrid.classList.remove("hidden");

  filtered.forEach(b => {
    const card = createCard(b);
    birthdayGrid.appendChild(card);
  });
}

function createCard(b) {
  const sent = b._meta?.lastReminderYear === currentYear;
  const lastYear = b._meta?.lastReminderYear;
  const initials = b.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const card = document.createElement("div");
  card.className = "birthday-card";
  card.innerHTML = `
    <div class="card-top">
      <div class="card-avatar">${initials}</div>
      <div class="card-name-wrap">
        <div class="card-name">${escHtml(b.name)}</div>
        <div class="card-date">${b.date}</div>
      </div>
      <div class="card-actions">
        <button class="btn-icon btn-edit" title="Editar" data-id="${b.id}">&#9998;</button>
        <button class="btn-icon btn-delete" title="Eliminar" data-id="${b.id}">&#128465;</button>
      </div>
    </div>
    <div class="card-divider"></div>
    <div class="card-meta">
      ${b.groupName ? `<div class="card-meta-row"><span class="meta-icon">&#128101;</span><span>${escHtml(b.groupName)}</span></div>` : ""}
      <div class="card-meta-row">
        <span class="meta-icon">&#128197;</span>
        <span class="status-badge ${sent ? "sent" : "pending"}">
          ${sent ? "Enviado " + currentYear : lastYear ? "Ultimo: " + lastYear : "Pendiente"}
        </span>
      </div>
      ${b.message ? `<div class="card-message">"${escHtml(b.message)}"</div>` : ""}
    </div>
  `;

  card.querySelector(".btn-edit").addEventListener("click", () => openModal(b));
  card.querySelector(".btn-delete").addEventListener("click", () => confirmDelete(b));

  return card;
}

function openModal(birthday) {
  birthdayForm.reset();
  errorName.textContent = "";
  errorDate.textContent = "";
  fieldName.classList.remove("error");
  fieldDate.classList.remove("error");

  if (birthday) {
    modalTitle.textContent = "Editar cumpleaños";
    editId.value = birthday.id;
    fieldName.value = birthday.name;
    fieldDate.value = birthday.date;
    fieldGroupName.value = birthday.groupName || "";
    fieldGroupId.value = birthday.groupId || "";
    fieldMessage.value = birthday.message || "";
  } else {
    modalTitle.textContent = "Agregar cumpleaños";
    editId.value = "";
  }

  modalBackdrop.classList.remove("hidden");
  fieldName.focus();
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
}

function validateForm() {
  let valid = true;
  errorName.textContent = "";
  errorDate.textContent = "";
  fieldName.classList.remove("error");
  fieldDate.classList.remove("error");

  if (!fieldName.value.trim()) {
    errorName.textContent = "El nombre es requerido";
    fieldName.classList.add("error");
    valid = false;
  }

  const dateVal = fieldDate.value.trim();
  if (!dateVal) {
    errorDate.textContent = "La fecha es requerida";
    fieldDate.classList.add("error");
    valid = false;
  } else if (!/^\d{2}-\d{2}$/.test(dateVal)) {
    errorDate.textContent = "Formato inválido, usar DD-MM (ejemplo: 17-08)";
    fieldDate.classList.add("error");
    valid = false;
  }

  return valid;
}

async function confirmDelete(b) {
  if (!confirm(`¿Eliminar el cumpleaños de "${b.name}"?`)) return;
  try {
    await api("DELETE", `/api/birthdays/${b.id}`);
    showToast("Cumpleaños eliminado", "success");
    await loadBirthdays();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function api(method, url, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error desconocido");
  return data;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

loadBirthdays();
