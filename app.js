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

const loadFields =
  "id, broker_id, broker_company, origin_city, origin_state, destination_city, destination_state, pickup_date, delivery_date, equipment_type, weight_lbs, commodity, miles, rate, public_notes, status, booked_by, expired_at, created_at";

const authView = document.querySelector("#auth-view");
const workspaceView = document.querySelector("#workspace-view");
const authForm = document.querySelector("#auth-form");
const authEmailInput = document.querySelector("#auth-email");
const authPasswordInput = document.querySelector("#auth-password");
const authPasswordToggle = document.querySelector("#auth-password-toggle");
const authPasswordHint = document.querySelector("#auth-password-hint");
const authConfirmPasswordGroup = document.querySelector("#auth-confirm-password-group");
const authConfirmPasswordInput = document.querySelector("#auth-confirm-password");
const authConfirmPasswordToggle = document.querySelector("#auth-confirm-password-toggle");
const signupFields = document.querySelector("#signup-fields");
const authFullNameInput = document.querySelector("#auth-full-name");
const authPhoneInput = document.querySelector("#auth-phone");
const authAccountTypeInput = document.querySelector("#auth-account-type");
const companyField = document.querySelector("#company-field");
const authCompanyNameInput = document.querySelector("#auth-company-name");
const authSubmit = document.querySelector("#auth-submit");
const authSwitch = document.querySelector("#auth-switch");
const authMessage = document.querySelector("#auth-message");
const authModeLabel = document.querySelector("#auth-mode-label");
const setupMessage = document.querySelector("#setup-message");
const accountEmail = document.querySelector("#account-email");
const roleBadge = document.querySelector("#role-badge");
const signOutButton = document.querySelector("#sign-out");
const menuWrap = document.querySelector("#menu-wrap");
const menuToggle = document.querySelector("#menu-toggle");
const mainMenu = document.querySelector("#main-menu");
const menuLinks = Array.from(mainMenu.querySelectorAll("a"));
const notificationsWrap = document.querySelector("#notifications-wrap");
const notificationsToggle = document.querySelector("#notifications-toggle");
const notificationsPanel = document.querySelector("#notifications-panel");
const notificationsClose = document.querySelector("#notifications-close");
const notificationCount = document.querySelector("#notification-count");
const notificationList = document.querySelector("#notification-list");
const notificationsEmpty = document.querySelector("#notifications-empty");
const workspaceTitle = document.querySelector("#workspace-title");
const workspaceSubtitle = document.querySelector("#workspace-subtitle");
const workspaceMessage = document.querySelector("#workspace-message");
const brokerPending = document.querySelector("#broker-pending");
const profileId = document.querySelector("#profile-id");
const driverDashboard = document.querySelector("#driver-dashboard");
const brokerDashboard = document.querySelector("#broker-dashboard");
const brokerPostPanel = document.querySelector("#broker-post-panel");
const loadForm = document.querySelector("#load-form");
const loadFormMessage = document.querySelector("#load-form-message");
const privateFields = loadForm.querySelector(".private-fields");
const pickupAddressInput = document.querySelector("#pickup-address");
const deliveryAddressInput = document.querySelector("#delivery-address");
const pickupDateInput = document.querySelector("#pickup-date");
const deliveryDateInput = document.querySelector("#delivery-date");
const loadSearchInput = document.querySelector("#load-search");
const equipmentFilter = document.querySelector("#equipment-filter");
const availableLoadsList = document.querySelector("#available-loads");
const availableCount = document.querySelector("#available-count");
const availableEmpty = document.querySelector("#available-empty");
const driverBookingsList = document.querySelector("#driver-bookings");
const driverBookingCount = document.querySelector("#driver-booking-count");
const driverBookingsEmpty = document.querySelector("#driver-bookings-empty");
const brokerLoadsList = document.querySelector("#broker-loads");
const brokerLoadCount = document.querySelector("#broker-load-count");
const brokerLoadsEmpty = document.querySelector("#broker-loads-empty");

let authMode = "signin";
let currentUser = null;
let currentProfile = null;
let workspaceRequestId = 0;
let notificationTimer = null;
let notifications = [];
let availableLoads = [];
let driverBookings = [];
let brokerLoads = [];
let brokerBookings = [];

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

function setWorkspaceMessage(message, isError = true) {
  workspaceMessage.textContent = message;
  workspaceMessage.classList.toggle("is-error", Boolean(message) && isError);
  workspaceMessage.classList.toggle("is-success", Boolean(message) && !isError);
}

function setLoadFormMessage(message, isError = true) {
  loadFormMessage.textContent = message;
  loadFormMessage.classList.toggle("is-error", Boolean(message) && isError);
  loadFormMessage.classList.toggle("is-success", Boolean(message) && !isError);
}

function setMenuOpen(isOpen) {
  mainMenu.hidden = !isOpen;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Close navigation menu" : "Open navigation menu"
  );
}

function configureMenu(profile) {
  setMenuOpen(false);
  menuToggle.hidden = false;
  for (const link of menuLinks) {
    const role = link.dataset.menuRole;
    const requiresApproval = link.dataset.menuApproved === "true";
    link.hidden =
      (role !== "all" && role !== profile.account_type) ||
      (requiresApproval && !profile.broker_approved);
  }
}

function setNotificationsOpen(isOpen) {
  notificationsPanel.hidden = !isOpen;
  notificationsToggle.setAttribute("aria-expanded", String(isOpen));
}

function renderNotifications() {
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  notificationCount.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  notificationCount.hidden = unreadCount === 0;
  notificationsEmpty.hidden = notifications.length > 0;

  notificationList.replaceChildren(
    ...notifications.map((notification) => {
      const item = element("li", "notification-entry");
      const button = element(
        "button",
        `notification-item${notification.read_at ? "" : " is-unread"}`
      );
      button.type = "button";
      button.disabled = Boolean(notification.read_at);
      button.append(
        element("strong", "notification-title", notification.title),
        element("span", "notification-message", notification.message),
        element("time", "notification-date", formatNotificationDate(notification.created_at))
      );
      if (!notification.read_at) {
        button.addEventListener("click", () => markNotificationRead(notification.id, button));
      }
      item.append(button);
      return item;
    })
  );
}

function formatNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function loadNotifications(reportError = false) {
  if (!currentUser) return;
  const userId = currentUser.id;
  try {
    const { data, error } = await supabaseClient
      .from("notifications")
      .select("id, load_id, title, message, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    if (!currentUser || currentUser.id !== userId) return;
    notifications = data || [];
    renderNotifications();
  } catch (error) {
    console.error("Could not load notifications:", error);
    if (reportError) {
      setWorkspaceMessage(`Notifications couldn't load. ${friendlyDatabaseError(error)}`);
    }
  }
}

async function markNotificationRead(notificationId, button) {
  button.disabled = true;
  try {
    const { error } = await supabaseClient.rpc("mark_notification_read", {
      p_notification_id: notificationId,
    });
    if (error) throw error;
    notifications = notifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, read_at: new Date().toISOString() }
        : notification
    );
    renderNotifications();
  } catch (error) {
    console.error("Could not mark notification as read:", error);
    setWorkspaceMessage(friendlyDatabaseError(error));
    button.disabled = false;
  }
}

function startNotificationPolling() {
  if (notificationTimer) window.clearInterval(notificationTimer);
  notificationTimer = window.setInterval(() => loadNotifications(), 60_000);
}

function friendlyDatabaseError(error) {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return "The marketplace database is not installed yet. Run the updated supabase-schema.sql in the Supabase SQL Editor, then sign out and back in.";
  }
  return error?.message || "An unexpected database error occurred.";
}

function setPasswordVisibility(input, toggle, isVisible) {
  input.type = isVisible ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(isVisible));
  toggle.setAttribute(
    "aria-label",
    `${isVisible ? "Hide" : "Show"} ${toggle.dataset.passwordLabel}`
  );
}

function updateCompanyField() {
  const isBrokerSignup = authMode === "signup" && authAccountTypeInput.value === "broker";
  companyField.hidden = !isBrokerSignup;
  authCompanyNameInput.disabled = !isBrokerSignup;
  authCompanyNameInput.required = isBrokerSignup;
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === "signup";
  authModeLabel.textContent = isSignUp ? "Create your account" : "Welcome back";
  authSubmit.textContent = isSignUp ? "Create account" : "Sign in";
  authSwitch.textContent = isSignUp
    ? "Already have an account? Sign in"
    : "New to HaulBoard? Create an account";
  signupFields.hidden = !isSignUp;
  for (const input of [authFullNameInput, authPhoneInput, authAccountTypeInput]) {
    input.disabled = !isSignUp;
    input.required = isSignUp;
  }
  authPasswordInput.autocomplete = isSignUp ? "new-password" : "current-password";
  authPasswordInput.minLength = isSignUp ? 12 : 1;
  authPasswordHint.hidden = !isSignUp;
  authConfirmPasswordGroup.hidden = !isSignUp;
  authConfirmPasswordInput.disabled = !isSignUp;
  authConfirmPasswordInput.required = isSignUp;
  if (!isSignUp) authConfirmPasswordInput.value = "";
  updateCompanyField();
  setPasswordVisibility(authPasswordInput, authPasswordToggle, false);
  setPasswordVisibility(authConfirmPasswordInput, authConfirmPasswordToggle, false);
  setAuthMessage("");
}

function showSignedOutView() {
  workspaceRequestId += 1;
  if (notificationTimer) window.clearInterval(notificationTimer);
  notificationTimer = null;
  currentUser = null;
  currentProfile = null;
  notifications = [];
  availableLoads = [];
  driverBookings = [];
  brokerLoads = [];
  brokerBookings = [];
  authView.hidden = false;
  workspaceView.hidden = true;
  signOutButton.hidden = true;
  roleBadge.hidden = true;
  menuToggle.hidden = true;
  notificationsWrap.hidden = true;
  setMenuOpen(false);
  setNotificationsOpen(false);
  renderNotifications();
  authForm.reset();
  setAuthMode("signin");
}

async function showSignedInView(user) {
  const requestId = ++workspaceRequestId;
  currentUser = user;
  accountEmail.textContent = user.email || "Signed in";
  signOutButton.hidden = false;
  roleBadge.hidden = true;
  menuToggle.hidden = true;
  notificationsWrap.hidden = true;
  setMenuOpen(false);
  setNotificationsOpen(false);
  authView.hidden = true;
  workspaceView.hidden = false;
  brokerPending.hidden = true;
  driverDashboard.hidden = true;
  brokerDashboard.hidden = true;
  setWorkspaceMessage("");
  workspaceTitle.textContent = "Your freight workspace.";
  workspaceSubtitle.textContent = "Loading your marketplace profile...";

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, account_type, full_name, company_name, phone, email, broker_approved")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (requestId !== workspaceRequestId) return;
    if (!data) {
      setWorkspaceMessage(
        "Your marketplace profile is missing. Run the updated supabase-schema.sql in Supabase, then sign out and back in."
      );
      workspaceSubtitle.textContent = "Your account needs a marketplace profile.";
      return;
    }

    currentProfile = data;
    roleBadge.textContent = data.account_type === "broker" ? "Load provider" : "Driver";
    roleBadge.hidden = false;
    configureMenu(data);
    notificationsWrap.hidden = false;
    await loadNotifications(true);
    if (requestId !== workspaceRequestId) return;
    startNotificationPolling();
    workspaceTitle.textContent =
      data.account_type === "broker" ? "Manage your freight." : "Find your next load.";
    workspaceSubtitle.textContent = `Welcome, ${data.full_name}. ${
      data.account_type === "broker"
        ? "Post loads and keep track of your booked freight."
        : "Compare rates and manage your bookings."
    }`;

    if (data.account_type === "broker" && !data.broker_approved) {
      brokerPending.hidden = false;
      profileId.textContent = data.id;
      setSummaryMode("broker");
      return;
    }

    if (data.account_type === "broker") {
      brokerDashboard.hidden = false;
      brokerPostPanel.hidden = false;
      setSummaryMode("broker");
      await loadBrokerWorkspace(requestId);
    } else {
      driverDashboard.hidden = false;
      setSummaryMode("driver");
      await loadDriverWorkspace(requestId);
    }
  } catch (error) {
    if (requestId !== workspaceRequestId) return;
    console.error("Could not load the marketplace profile:", error);
    workspaceSubtitle.textContent = "Your marketplace could not be loaded.";
    setWorkspaceMessage(friendlyDatabaseError(error));
  }
}

function setSummaryMode(mode) {
  if (mode === "broker") {
    document.querySelector("#summary-first-label").textContent = "Posted loads";
    document.querySelector("#summary-first-foot").textContent = "All loads from your brokerage";
    document.querySelector("#summary-second-label").textContent = "Open loads";
    document.querySelector("#summary-second-foot").textContent = "Available for drivers to book";
    document.querySelector("#summary-third-label").textContent = "Booked / moving";
    document.querySelector("#summary-third-foot").textContent = "Assigned or in transit";
  } else {
    document.querySelector("#summary-first-label").textContent = "Available loads";
    document.querySelector("#summary-first-foot").textContent = "Loads ready to book";
    document.querySelector("#summary-second-label").textContent = "Active bookings";
    document.querySelector("#summary-second-foot").textContent = "Booked or in transit";
    document.querySelector("#summary-third-label").textContent = "Delivered";
    document.querySelector("#summary-third-foot").textContent = "Completed loads";
  }
  setSummaryValues(0, 0, 0);
}

function setSummaryValues(first, second, third) {
  document.querySelector("#summary-first-value").textContent = Number(first).toLocaleString();
  document.querySelector("#summary-second-value").textContent = Number(second).toLocaleString();
  document.querySelector("#summary-third-value").textContent = Number(third).toLocaleString();
}

async function loadDriverWorkspace(requestId) {
  const [availableResult, bookingResult] = await Promise.all([
    supabaseClient
      .from("loads")
      .select(loadFields)
      .eq("status", "open")
      .order("pickup_date", { ascending: true })
      .limit(100),
    supabaseClient
      .from("bookings")
      .select("id, load_id, driver_id, driver_name, driver_phone, driver_email, status, created_at")
      .eq("driver_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (availableResult.error) throw availableResult.error;
  if (bookingResult.error) throw bookingResult.error;
  if (requestId !== workspaceRequestId) return;

  const bookings = bookingResult.data || [];
  const loadIds = [...new Set(bookings.map((booking) => booking.load_id))];
  let bookingLoads = [];
  if (loadIds.length) {
    const loadResult = await supabaseClient
      .from("loads")
      .select(loadFields)
      .in("id", loadIds);
    if (loadResult.error) throw loadResult.error;
    bookingLoads = loadResult.data || [];
  }

  if (requestId !== workspaceRequestId) return;
  const loadsById = new Map(bookingLoads.map((load) => [load.id, load]));
  availableLoads = availableResult.data || [];
  driverBookings = bookings.map((booking) => ({
    ...booking,
    load: loadsById.get(booking.load_id) || null,
  }));
  renderAvailableLoads();
  renderDriverBookings();
  setSummaryValues(
    availableLoads.length,
    driverBookings.filter((booking) => ["booked", "in_transit"].includes(booking.status)).length,
    driverBookings.filter((booking) => booking.status === "delivered").length
  );
}

async function loadBrokerWorkspace(requestId) {
  const loadResult = await supabaseClient
    .from("loads")
    .select(loadFields)
    .eq("broker_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (loadResult.error) throw loadResult.error;
  if (requestId !== workspaceRequestId) return;

  brokerLoads = loadResult.data || [];
  const loadIds = brokerLoads.map((load) => load.id);
  let bookings = [];
  if (loadIds.length) {
    const bookingResult = await supabaseClient
      .from("bookings")
      .select("id, load_id, driver_id, driver_name, driver_phone, driver_email, status, created_at")
      .in("load_id", loadIds)
      .order("created_at", { ascending: false });
    if (bookingResult.error) throw bookingResult.error;
    bookings = bookingResult.data || [];
  }
  if (requestId !== workspaceRequestId) return;

  brokerBookings = bookings;
  renderBrokerLoads();
  setSummaryValues(
    brokerLoads.length,
    brokerLoads.filter((load) => load.status === "open").length,
    brokerLoads.filter((load) => ["booked", "in_transit"].includes(load.status)).length
  );
}

function element(tagName, className = "", text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate(dateString) {
  if (!dateString) return "Not set";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatStatus(status) {
  return status.replaceAll("_", " ");
}

function createStatusBadge(status) {
  return element("span", `status-badge status-${status}`, formatStatus(status));
}

function addMetaItem(container, label, value) {
  if (value === null || value === undefined || value === "") return;
  container.append(element("span", "", `${label}: ${value}`));
}

function createLoadCard(load, options = {}) {
  const item = element("li", "load-card");
  const top = element("div", "load-card-top");
  const identity = element("div");
  identity.append(
    element(
      "p",
      "load-route",
      `${load.origin_city}, ${load.origin_state} → ${load.destination_city}, ${load.destination_state}`
    )
  );
  identity.append(element("p", "load-provider", load.broker_company || "Load provider"));
  const cardStatus =
    options.status || (load.expired_at ? "expired" : load.status || "open");
  top.append(identity, createStatusBadge(cardStatus));

  const meta = element("div", "load-meta");
  addMetaItem(meta, "Pickup", formatDate(load.pickup_date));
  addMetaItem(meta, "Delivery", formatDate(load.delivery_date));
  addMetaItem(meta, "Equipment", load.equipment_type);
  addMetaItem(meta, "Commodity", load.commodity);
  addMetaItem(meta, "Weight", load.weight_lbs ? `${Number(load.weight_lbs).toLocaleString()} lb` : "Not listed");
  addMetaItem(meta, "Distance", `${Number(load.miles).toLocaleString()} mi`);

  const rate = element("div", "rate-block");
  rate.append(element("strong", "rate-value", currency.format(Number(load.rate))));
  rate.append(
    element(
      "span",
      "rate-caption",
      `${currency.format(Number(load.rate) / Number(load.miles))} / mile`
    )
  );

  item.append(top, meta);
  if (load.public_notes) item.append(element("p", "load-notes", load.public_notes));

  const bottom = element("div", "load-card-bottom");
  const actions = element("div", "load-card-actions");

  if (options.context === "available") {
    const bookButton = element("button", "primary-button", "Book this load");
    bookButton.type = "button";
    bookButton.addEventListener("click", () => bookLoad(load.id, bookButton));
    actions.append(bookButton);
    bottom.append(element("span", "rate-caption", "First confirmed booking reserves it."));
  } else if (options.context === "driver-booking") {
    const booking = options.booking;
    if (booking.status === "booked") {
      const pickupButton = element("button", "action-button", "Mark picked up");
      pickupButton.type = "button";
      pickupButton.addEventListener("click", () =>
        updateLoadStatus(load.id, "in_transit", pickupButton)
      );
      const cancelButton = element("button", "action-button is-danger", "Cancel booking");
      cancelButton.type = "button";
      cancelButton.addEventListener("click", () =>
        updateLoadStatus(load.id, "open", cancelButton)
      );
      actions.append(pickupButton, cancelButton);
    } else if (booking.status === "in_transit") {
      const deliveredButton = element("button", "action-button", "Mark delivered");
      deliveredButton.type = "button";
      deliveredButton.addEventListener("click", () =>
        updateLoadStatus(load.id, "delivered", deliveredButton)
      );
      actions.append(deliveredButton);
    } else {
      bottom.append(element("span", "rate-caption", `Booking ${booking.status}.`));
    }
  } else if (options.context === "broker") {
    if (load.status === "open") {
      const cancelButton = element("button", "action-button is-danger", "Cancel load");
      cancelButton.type = "button";
      cancelButton.addEventListener("click", () =>
        updateLoadStatus(load.id, "cancelled", cancelButton)
      );
      actions.append(cancelButton);
    }
    if (options.booking && options.booking.status !== "cancelled") {
      const contact = element(
        "span",
        "driver-contact",
        `Booked by ${options.booking.driver_name}${options.booking.driver_phone ? ` · ${options.booking.driver_phone}` : ""}`
      );
      bottom.append(contact);
    }
  }

  const privateDetails = element("div", "private-details");
  privateDetails.hidden = true;
  if (options.context === "broker" || options.canViewPrivateDetails) {
    const detailsButton = element("button", "action-button", "Show full details");
    detailsButton.type = "button";
    detailsButton.addEventListener("click", () =>
      togglePrivateDetails(load.id, detailsButton, privateDetails)
    );
    actions.append(detailsButton);
  }
  bottom.append(actions, rate);
  item.append(bottom, privateDetails);
  return item;
}

async function togglePrivateDetails(loadId, button, container) {
  if (container.dataset.loaded === "true") {
    container.hidden = !container.hidden;
    button.textContent = container.hidden ? "Show full details" : "Hide full details";
    return;
  }

  button.disabled = true;
  try {
    const { data, error } = await supabaseClient
      .from("load_private_details")
      .select("pickup_address, delivery_address, broker_contact_name, broker_contact_phone, broker_contact_email, instructions")
      .eq("load_id", loadId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Private load details were not found.");

    container.replaceChildren();
    container.append(element("p", "", `Pickup address: ${data.pickup_address}`));
    container.append(element("p", "", `Delivery address: ${data.delivery_address}`));
    container.append(
      element(
        "p",
        "",
        `Provider contact: ${data.broker_contact_name} · ${data.broker_contact_email}${data.broker_contact_phone ? ` · ${data.broker_contact_phone}` : ""}`
      )
    );
    if (data.instructions) {
      container.append(element("p", "", `Instructions: ${data.instructions}`));
    }
    container.dataset.loaded = "true";
    container.hidden = false;
    button.textContent = "Hide full details";
  } catch (error) {
    console.error("Could not load private load details:", error);
    setWorkspaceMessage(friendlyDatabaseError(error));
  } finally {
    button.disabled = false;
  }
}

function renderAvailableLoads() {
  const search = loadSearchInput.value.trim().toLowerCase();
  const equipment = equipmentFilter.value;
  const filtered = availableLoads.filter((load) => {
    const matchesEquipment = !equipment || load.equipment_type === equipment;
    const haystack = [
      load.origin_city,
      load.origin_state,
      load.destination_city,
      load.destination_state,
      load.commodity,
      load.broker_company,
    ]
      .join(" ")
      .toLowerCase();
    return matchesEquipment && (!search || haystack.includes(search));
  });

  availableLoadsList.replaceChildren(
    ...filtered.map((load) => createLoadCard(load, { context: "available" }))
  );
  availableCount.textContent = `${filtered.length} ${filtered.length === 1 ? "load" : "loads"}`;
  availableEmpty.hidden = filtered.length > 0;
}

function renderDriverBookings() {
  const cards = [];
  for (const booking of driverBookings) {
    if (!booking.load) continue;
    cards.push(
      createLoadCard(booking.load, {
        context: "driver-booking",
        booking,
        status: booking.status,
        canViewPrivateDetails: booking.status !== "cancelled",
      })
    );
  }
  driverBookingsList.replaceChildren(...cards);
  driverBookingCount.textContent =
    `${cards.length} ${cards.length === 1 ? "booking" : "bookings"}`;
  driverBookingsEmpty.hidden = cards.length > 0;
}

function renderBrokerLoads() {
  const latestBookingByLoad = new Map();
  for (const booking of brokerBookings) {
    if (!latestBookingByLoad.has(booking.load_id)) {
      latestBookingByLoad.set(booking.load_id, booking);
    }
  }
  const cards = brokerLoads.map((load) =>
    createLoadCard(load, {
      context: "broker",
      booking: latestBookingByLoad.get(load.id),
    })
  );
  brokerLoadsList.replaceChildren(...cards);
  brokerLoadCount.textContent = `${cards.length} ${cards.length === 1 ? "load" : "loads"}`;
  brokerLoadsEmpty.hidden = cards.length > 0;
}

async function bookLoad(loadId, button) {
  button.disabled = true;
  setWorkspaceMessage("");
  try {
    const { error } = await supabaseClient.rpc("book_load", { p_load_id: loadId });
    if (error) throw error;
    setWorkspaceMessage("Load booked. Pickup, delivery, and provider contact details are now available.", false);
    await loadNotifications();
  } catch (error) {
    console.error("Could not book load:", error);
    setWorkspaceMessage(friendlyDatabaseError(error));
    button.disabled = false;
    return;
  }

  button.disabled = false;
  try {
    await loadDriverWorkspace(workspaceRequestId);
  } catch (error) {
    console.error("Load booked, but the driver board could not be refreshed:", error);
    setWorkspaceMessage("Load booked, but the board could not refresh. Reload to see the latest status.");
  }
}

async function updateLoadStatus(loadId, status, button) {
  button.disabled = true;
  setWorkspaceMessage("");
  let successMessage;
  try {
    const { error } = await supabaseClient.rpc("set_load_status", {
      p_load_id: loadId,
      p_new_status: status,
    });
    if (error) throw error;
    successMessage =
      status === "open"
        ? "Booking cancelled. The load is available to other drivers."
        : `Load status updated to ${formatStatus(status)}.`;
  } catch (error) {
    console.error("Could not update load status:", error);
    setWorkspaceMessage(friendlyDatabaseError(error));
    button.disabled = false;
    return;
  }

  setWorkspaceMessage(successMessage, false);
  button.disabled = false;
  try {
    await loadNotifications();
    if (currentProfile.account_type === "broker") {
      await loadBrokerWorkspace(workspaceRequestId);
    } else {
      await loadDriverWorkspace(workspaceRequestId);
    }
  } catch (error) {
    console.error("Load status updated, but the workspace could not be refreshed:", error);
    setWorkspaceMessage("Load status updated, but the board could not refresh. Reload to see the latest status.");
  }
}

async function submitLoad(event) {
  event.preventDefault();
  setLoadFormMessage("");
  if (deliveryDateInput.value < pickupDateInput.value) {
    setLoadFormMessage("Delivery date must be on or after pickup date.");
    return;
  }
  if (!pickupAddressInput.value.trim() || !deliveryAddressInput.value.trim()) {
    privateFields.open = true;
    setLoadFormMessage("Enter both pickup and delivery addresses in the private details section.");
    return;
  }

  const submitButton = loadForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const formData = new FormData(loadForm);
  try {
    const { error } = await supabaseClient.rpc("create_load", {
      p_origin_city: formData.get("origin-city").trim(),
      p_origin_state: formData.get("origin-state").trim(),
      p_destination_city: formData.get("destination-city").trim(),
      p_destination_state: formData.get("destination-state").trim(),
      p_pickup_date: formData.get("pickup-date"),
      p_delivery_date: formData.get("delivery-date"),
      p_equipment_type: formData.get("equipment-type"),
      p_weight_lbs: formData.get("weight-lbs") ? Number(formData.get("weight-lbs")) : null,
      p_commodity: formData.get("commodity").trim(),
      p_miles: Number(formData.get("miles")),
      p_rate: Number(formData.get("rate")),
      p_public_notes: formData.get("public-notes").trim(),
      p_pickup_address: formData.get("pickup-address").trim(),
      p_delivery_address: formData.get("delivery-address").trim(),
      p_instructions: formData.get("instructions").trim(),
    });
    if (error) throw error;

    loadForm.reset();
    privateFields.open = false;
    pickupDateInput.value = today;
    deliveryDateInput.value = today;
    setLoadFormMessage("Load posted to the driver board.", false);
  } catch (error) {
    console.error("Could not post load:", error);
    setLoadFormMessage(friendlyDatabaseError(error));
    return;
  } finally {
    submitButton.disabled = false;
  }

  try {
    await loadBrokerWorkspace(workspaceRequestId);
  } catch (error) {
    console.error("Load posted, but the broker board could not be refreshed:", error);
    setLoadFormMessage("Load posted, but the board could not refresh. Reload to see the latest status.");
  }
}

authSwitch.addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});

menuToggle.addEventListener("click", () => {
  setNotificationsOpen(false);
  setMenuOpen(mainMenu.hidden);
});

notificationsToggle.addEventListener("click", () => {
  setMenuOpen(false);
  const isOpening = notificationsPanel.hidden;
  setNotificationsOpen(isOpening);
  if (isOpening) loadNotifications();
});

notificationsClose.addEventListener("click", () => {
  setNotificationsOpen(false);
  notificationsToggle.focus();
});

for (const link of menuLinks) {
  link.addEventListener("click", () => setMenuOpen(false));
}

document.addEventListener("click", (event) => {
  if (!menuWrap.contains(event.target)) setMenuOpen(false);
  if (!notificationsWrap.contains(event.target)) setNotificationsOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mainMenu.hidden) {
    setMenuOpen(false);
    menuToggle.focus();
  } else if (event.key === "Escape" && !notificationsPanel.hidden) {
    setNotificationsOpen(false);
    notificationsToggle.focus();
  }
});

authAccountTypeInput.addEventListener("change", updateCompanyField);

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
    setAuthMessage("Configure your Supabase URL and publishable key in supabase-config.js.");
    return;
  }

  authSubmit.disabled = true;
  setAuthMessage("");

  try {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    let result;

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

      result = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            account_type: authAccountTypeInput.value,
            full_name: authFullNameInput.value.trim(),
            phone: authPhoneInput.value.trim(),
            company_name:
              authAccountTypeInput.value === "broker"
                ? authCompanyNameInput.value.trim()
                : null,
          },
        },
      });
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
    }

    if (result.error) {
      console.error("Authentication failed:", result.error);
      setAuthMessage(result.error.message);
      return;
    }

    if (authMode === "signup" && !result.data.session) {
      const brokerNote =
        authAccountTypeInput.value === "broker"
          ? " After confirming your email, your broker account will need approval before you can post loads."
          : "";
      authForm.reset();
      setAuthMode("signup");
      setAuthMessage(`Check your email to confirm your account, then sign in.${brokerNote}`, false);
    }
  } catch (error) {
    console.error("Authentication request failed:", error);
    setAuthMessage(error?.message || "Couldn't reach Supabase. Check your connection and try again.");
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
    setWorkspaceMessage(error?.message || "Couldn't sign out. Please try again.");
  } finally {
    signOutButton.disabled = false;
  }
});

loadForm.addEventListener("submit", submitLoad);
loadSearchInput.addEventListener("input", renderAvailableLoads);
equipmentFilter.addEventListener("change", renderAvailableLoads);

const today = localDateString();
pickupDateInput.min = today;
deliveryDateInput.min = today;
pickupDateInput.value = today;
deliveryDateInput.value = today;
pickupDateInput.addEventListener("change", () => {
  deliveryDateInput.min = pickupDateInput.value || today;
  if (deliveryDateInput.value < deliveryDateInput.min) {
    deliveryDateInput.value = deliveryDateInput.min;
  }
});

if (!createClient) {
  setupMessage.hidden = false;
  setupMessage.textContent = "Supabase couldn't load. Check your connection and reload the page.";
  authSubmit.disabled = true;
  setAuthMessage("The login service is unavailable right now.");
} else if (!supabaseConfigured) {
  setupMessage.hidden = false;
  authSubmit.disabled = true;
  setAuthMessage("Configure Supabase to enable accounts.");
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
