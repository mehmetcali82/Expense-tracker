const STORAGE_KEY = "daybook-expenses-v1";
const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

const form = document.querySelector("#expense-form");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const formMessage = document.querySelector("#form-message");
const expenseList = document.querySelector("#expense-list");
const emptyState = document.querySelector("#empty-state");

const categoryIcons = {
  "Food & drink": "☕",
  Transport: "↗",
  Shopping: "◇",
  Home: "⌂",
  Bills: "▤",
  Health: "✚",
  Entertainment: "♫",
  Other: "✳",
};

function loadExpenses() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("Saved expenses are not a list.");

    return parsed.filter((expense) =>
      expense &&
      typeof expense.id === "string" &&
      typeof expense.description === "string" &&
      typeof expense.amount === "number" &&
      Number.isFinite(expense.amount) &&
      typeof expense.category === "string" &&
      typeof expense.date === "string"
    );
  } catch (error) {
    console.error("Could not load saved expenses:", error);
    formMessage.textContent = "We couldn't read saved expenses from this browser.";
    return [];
  }
}

let expenses = loadExpenses();

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    formMessage.textContent = "";
    return true;
  } catch (error) {
    console.error("Could not save expenses:", error);
    formMessage.textContent = "Couldn't save changes. Check your browser storage settings.";
    return false;
  }
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function render() {
  const now = new Date();
  const monthExpenses = expenses.filter((expense) => {
    const [year, month] = expense.date.split("-").map(Number);
    return year === now.getFullYear() && month === now.getMonth() + 1;
  });

  document.querySelector("#month-total").textContent = currency.format(
    monthExpenses.reduce((total, expense) => total + expense.amount, 0)
  );
  document.querySelector("#all-time-total").textContent = currency.format(
    expenses.reduce((total, expense) => total + expense.amount, 0)
  );
  document.querySelector("#expense-count").textContent = expenses.length.toLocaleString();
  document.querySelector("#history-count").textContent =
    `${expenses.length} ${expenses.length === 1 ? "entry" : "entries"}`;

  expenseList.replaceChildren();
  emptyState.hidden = expenses.length > 0;

  const sortedExpenses = [...expenses].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  );

  for (const expense of sortedExpenses) {
    const item = document.createElement("li");
    item.className = "expense-item";

    const icon = document.createElement("span");
    icon.className = "category-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = categoryIcons[expense.category] || categoryIcons.Other;

    const details = document.createElement("div");
    details.className = "expense-details";

    const title = document.createElement("p");
    title.className = "expense-description";
    title.textContent = expense.description;

    const meta = document.createElement("p");
    meta.className = "expense-meta";
    meta.textContent = `${expense.category} · ${formatDate(expense.date)}`;
    details.append(title, meta);

    const right = document.createElement("div");
    right.className = "expense-right";

    const amount = document.createElement("p");
    amount.className = "expense-amount";
    amount.textContent = `−${currency.format(expense.amount)}`;

    const removeButton = document.createElement("button");
    removeButton.className = "delete-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Delete ${expense.description}`);
    removeButton.addEventListener("click", () => removeExpense(expense.id));

    right.append(amount, removeButton);
    item.append(icon, details, right);
    expenseList.append(item);
  }
}

function removeExpense(id) {
  const previousExpenses = expenses;
  expenses = expenses.filter((expense) => expense.id !== id);
  if (!saveExpenses()) {
    expenses = previousExpenses;
    return;
  }
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const date = dateInput.value;

  if (!description || !Number.isFinite(amount) || amount <= 0 || !date) {
    formMessage.textContent = "Enter a description, a positive amount, and a date.";
    return;
  }

  const expense = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description,
    amount: Math.round(amount * 100) / 100,
    category: categoryInput.value,
    date,
  };
  expenses = [expense, ...expenses];

  if (!saveExpenses()) {
    expenses = expenses.filter((entry) => entry.id !== expense.id);
    return;
  }

  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  descriptionInput.focus();
  render();
});

dateInput.value = new Date().toISOString().slice(0, 10);
render();
