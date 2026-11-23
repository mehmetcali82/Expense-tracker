const createClient = window.supabase?.createClient;
const supabaseUrl = window.EXPSAVE_SUPABASE_URL;
const supabaseKey = window.EXPSAVE_SUPABASE_ANON_KEY;
const supabaseConfigured =
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes("YOUR_SUPABASE") &&
  !supabaseKey.includes("YOUR_SUPABASE");
const supabaseClient = supabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authEmailInput = document.querySelector("#auth-email");
const authPasswordInput = document.querySelector("#auth-password");
const authPasswordToggle = document.querySelector("#auth-password-toggle");
const authConfirmPasswordLabel = document.querySelector("#auth-confirm-password-label");
const authConfirmPasswordField = document.querySelector("#auth-confirm-password-field");
const authConfirmPasswordInput = document.querySelector("#auth-confirm-password");
const authConfirmPasswordToggle = document.querySelector("#auth-confirm-password-toggle");
const authPasswordHint = document.querySelector("#auth-password-hint");
const authSubmit = document.querySelector("#auth-submit");
const authSwitch = document.querySelector("#auth-switch");
const authMessage = document.querySelector("#auth-message");
const authModeLabel = document.querySelector("#auth-mode-label");
const setupMessage = document.querySelector("#setup-message");
const accountEmail = document.querySelector("#account-email");
const signOutButton = document.querySelector("#sign-out");
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

let expenses = [];
let authMode = "signin";
let currentUser = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", Boolean(message) && isError);
  authMessage.classList.toggle("is-success", Boolean(message) && !isError);
}

function setFormMessage(message) {
  formMessage.textContent = message;
}

function setPasswordVisibility(input, toggle, isVisible) {
  input.type = isVisible ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(isVisible));
  toggle.setAttribute(
    "aria-label",
    `${isVisible ? "Hide" : "Show"} ${toggle.dataset.passwordLabel}`
  );
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === "signup";
  authModeLabel.textContent = isSignUp ? "Create your account" : "Welcome back";
  authSubmit.textContent = isSignUp ? "Create account" : "Sign in";
  authSwitch.textContent = isSignUp ? "Already have an account? Sign in" : "New to EXPSAVE? Create an account";
  authPasswordInput.autocomplete = isSignUp ? "new-password" : "current-password";
  authPasswordInput.minLength = isSignUp ? 12 : 1;
  authPasswordHint.hidden = !isSignUp;
  authConfirmPasswordLabel.hidden = !isSignUp;
  authConfirmPasswordField.hidden = !isSignUp;
  authConfirmPasswordInput.disabled = !isSignUp;
  authConfirmPasswordInput.required = isSignUp;
  if (!isSignUp) authConfirmPasswordInput.value = "";
  setPasswordVisibility(authPasswordInput, authPasswordToggle, false);
  setPasswordVisibility(authConfirmPasswordInput, authConfirmPasswordToggle, false);
  setAuthMessage("");
}

function showSignedInView(user) {
  currentUser = user;
  accountEmail.textContent = user.email || "Signed in";
  signOutButton.hidden = false;
  authView.hidden = true;
  appView.hidden = false;
  loadExpenses();
}

function showSignedOutView() {
  currentUser = null;
  expenses = [];
  expenseList.replaceChildren();
  render();
  appView.hidden = true;
  authView.hidden = false;
  accountEmail.textContent = "";
  signOutButton.hidden = true;
  authEmailInput.value = "";
  authPasswordInput.value = "";
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
    removeButton.addEventListener("click", () => removeExpense(expense.id, removeButton));

    right.append(amount, removeButton);
    item.append(icon, details, right);
    expenseList.append(item);
  }
}

async function loadExpenses() {
  if (!supabaseClient || !currentUser) return;

  try {
    const { data, error } = await supabaseClient
      .from("expenses")
      .select("id, description, amount, category, date")
      .order("date", { ascending: false });

    if (error) throw error;

    expenses = data.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
    }));
    setFormMessage("");
    render();
  } catch (error) {
    console.error("Could not load expenses:", error);
    setFormMessage("Couldn't load your expenses. Check your Supabase table and connection.");
  }
}

async function removeExpense(id, button) {
  button.disabled = true;
  try {
    const { error } = await supabaseClient
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) throw error;

    expenses = expenses.filter((expense) => expense.id !== id);
    setFormMessage("");
    render();
  } catch (error) {
    console.error("Could not delete expense:", error);
    setFormMessage("Couldn't delete that expense. Please try again.");
    button.disabled = false;
  }
}

authSwitch.addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});

authPasswordToggle.addEventListener("click", () => {
  setPasswordVisibility(
    authPasswordInput,
    authPasswordToggle,
    authPasswordInput.type === "password"
  );
});

authConfirmPasswordToggle.addEventListener("click", () => {
  setPasswordVisibility(
    authConfirmPasswordInput,
    authConfirmPasswordToggle,
    authConfirmPasswordInput.type === "password"
  );
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthMessage("Add your Supabase project URL and publishable key in supabase-config.js.");
    return;
  }

  authSubmit.disabled = true;
  setAuthMessage("");

  try {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (authMode === "signup") {
      if (password.length < 12) {
        setAuthMessage("Use a password with at least 12 characters.");
        return;
      }
      if (!/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
        setAuthMessage("Include at least one number and one special character in your password.");
        return;
      }
      if (password !== authConfirmPasswordInput.value) {
        setAuthMessage("The passwords don't match.");
        return;
      }
    }

    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });

    if (result.error) {
      console.error("Authentication failed:", result.error);
      setAuthMessage(result.error.message);
      return;
    }

    if (authMode === "signup" && !result.data.session) {
      setAuthMessage("Check your email to confirm your account, then sign in.", false);
      authForm.reset();
    }
  } catch (error) {
    console.error("Authentication request failed:", error);
    setAuthMessage("Couldn't reach Supabase. Check your connection and try again.");
  } finally {
    authSubmit.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Could not sign out:", error);
    setFormMessage("Couldn't sign out. Please try again.");
  } finally {
    signOutButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormMessage("");

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const date = dateInput.value;

  if (!description || !Number.isFinite(amount) || amount <= 0 || !date) {
    setFormMessage("Enter a description, a positive amount, and a date.");
    return;
  }

  const submitButton = form.querySelector(".submit-button");
  submitButton.disabled = true;
  try {
    const { data, error } = await supabaseClient
      .from("expenses")
      .insert({
        description,
        amount: Math.round(amount * 100) / 100,
        category: categoryInput.value,
        date,
      })
      .select("id, description, amount, category, date")
      .single();

    if (error) throw error;

    expenses = [{ ...data, amount: Number(data.amount) }, ...expenses];
    form.reset();
    dateInput.value = localDateString();
    descriptionInput.focus();
    setFormMessage("");
    render();
  } catch (error) {
    console.error("Could not save expense:", error);
    setFormMessage("Couldn't save that expense. Please try again.");
  } finally {
    submitButton.disabled = false;
  }
});

dateInput.value = localDateString();
render();

if (!createClient) {
  setupMessage.hidden = false;
  setupMessage.textContent = "Supabase couldn't load. Check your internet connection and reload the page.";
  authSubmit.disabled = true;
  setAuthMessage("The login service is unavailable right now.");
} else if (!supabaseConfigured) {
  setupMessage.hidden = false;
  authSubmit.disabled = true;
  setAuthMessage("Configure Supabase to enable account sign-in.");
} else {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showSignedInView(session.user);
    } else {
      showSignedOutView();
    }
  });

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Could not restore the Supabase session:", error);
      setAuthMessage("Couldn't restore your session. Refresh the page or sign in again.");
      return;
    }
    if (data.session?.user) showSignedInView(data.session.user);
  });
}
