import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const testData = JSON.parse(
  await readFile(new URL("../testdata/marketplace.json", import.meta.url), "utf8")
);

function futureDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function installSupabaseMock(page, role, loads = [], signedOut = false) {
  const signedInUser = { ...testData.users[role] };
  const profile = {
    ...testData.profiles[role],
    id: signedInUser.id,
    email: signedInUser.email,
  };
  const data = {
    user: signedOut ? null : signedInUser,
    profile,
    loads,
    bookings: [],
    privateDetails: loads.map((load) => ({
      ...testData.private_details,
      load_id: load.id,
    })),
    notifications: [],
  };
  await page.addInitScript((initialData) => {
    window.__haulboardTestData = initialData;
  }, data);
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `(() => {
        const state = window.__haulboardTestData;
        const session = state.user ? { user: state.user } : null;
        let authListener;
        let nextLoadId = 1;
        const notification = (userId, load, title, message) => state.notifications.unshift({
          id: "notification-" + Date.now() + "-" + Math.random(),
          user_id: userId,
          load_id: load.id,
          title,
          message,
          created_at: new Date().toISOString(),
          read_at: null
        });
        class Query {
          constructor(table) { this.table = table; this.filters = []; }
          select() { return this; }
          eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
          in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
          order() { return this; }
          limit() { return this; }
          rows() {
            const key = this.table === "load_private_details" ? "privateDetails" : this.table;
            const source = state[key] || [];
            return source.filter((row) => this.filters.every((filter) => filter(row)));
          }
          async maybeSingle() {
            if (this.table === "profiles") return { data: state.profile, error: null };
            return { data: this.rows()[0] || null, error: null };
          }
          then(resolve, reject) {
            return Promise.resolve({ data: this.rows(), error: null }).then(resolve, reject);
          }
        }
        const client = {
          auth: {
            onAuthStateChange(callback) {
              authListener = callback;
              queueMicrotask(() => callback("INITIAL_SESSION", session));
              return { data: { subscription: { unsubscribe() {} } } };
            },
            async getSession() { return { data: { session }, error: null }; },
            async signUp() { return { data: { session: null }, error: null }; },
            async signInWithPassword() {
              queueMicrotask(() => authListener?.("SIGNED_IN", session));
              return { data: { session }, error: null };
            },
            async signOut() {
              state.user = null;
              queueMicrotask(() => authListener?.("SIGNED_OUT", null));
              return { error: null };
            }
          },
          from(table) { return new Query(table); },
          async rpc(name, parameters) {
            if (name === "create_load") {
              const load = {
                id: "created-load-" + nextLoadId++,
                broker_id: state.user.id,
                broker_company: state.profile.company_name,
                origin_city: parameters.p_origin_city,
                origin_state: parameters.p_origin_state,
                destination_city: parameters.p_destination_city,
                destination_state: parameters.p_destination_state,
                pickup_date: parameters.p_pickup_date,
                delivery_date: parameters.p_delivery_date,
                equipment_type: parameters.p_equipment_type,
                weight_lbs: parameters.p_weight_lbs,
                commodity: parameters.p_commodity,
                miles: parameters.p_miles,
                rate: parameters.p_rate,
                public_notes: parameters.p_public_notes,
                status: "open",
                booked_by: null,
                created_at: new Date().toISOString()
              };
              state.loads.unshift(load);
              state.privateDetails.push({
                load_id: load.id,
                pickup_address: parameters.p_pickup_address,
                delivery_address: parameters.p_delivery_address,
                broker_contact_name: state.profile.full_name,
                broker_contact_phone: state.profile.phone,
                broker_contact_email: state.profile.email,
                instructions: parameters.p_instructions
              });
              return { data: load.id, error: null };
            }
            if (name === "book_load") {
              const load = state.loads.find((item) => item.id === parameters.p_load_id && item.status === "open");
              if (!load) return { data: null, error: { message: "This load is no longer available." } };
              load.status = "booked";
              load.booked_by = state.user.id;
              state.bookings.unshift({
                id: "booking-" + Date.now(),
                load_id: load.id,
                driver_id: state.user.id,
                driver_name: state.profile.full_name,
                driver_phone: state.profile.phone,
                driver_email: state.profile.email,
                status: "booked",
                created_at: new Date().toISOString()
              });
              notification(state.user.id, load, "Booking confirmed", "Your test booking is confirmed.");
              notification(load.broker_id, load, "Load booked", "A test driver booked the load.");
              return { data: "booking-test-id", error: null };
            }
            if (name === "set_load_status") {
              const load = state.loads.find((item) => item.id === parameters.p_load_id);
              if (!load) return { data: null, error: { message: "Load not found." } };
              const previousStatus = load.status;
              load.status = parameters.p_new_status;
              if (parameters.p_new_status === "open") load.booked_by = null;
              const booking = state.bookings.find((item) => item.load_id === load.id && item.status === previousStatus);
              if (booking) booking.status = parameters.p_new_status === "open" ? "cancelled" : parameters.p_new_status;
              if (load.broker_id !== state.user.id) {
                notification(load.broker_id, load, "Load status updated", "The test driver updated this load.");
              }
              return { data: null, error: null };
            }
            if (name === "mark_notification_read") {
              const item = state.notifications.find((notification) =>
                notification.id === parameters.p_notification_id && notification.user_id === state.user.id
              );
              if (!item) return { data: null, error: { message: "Notification not found." } };
              item.read_at = new Date().toISOString();
              return { data: null, error: null };
            }
            return { data: null, error: { message: "Unexpected RPC: " + name } };
          }
        };
        window.supabase = { createClient: () => client };
      })();`,
    })
  );
}

test("signup validates matching passwords and displays the confirmation state", async ({ page }) => {
  await installSupabaseMock(page, "driver", [], true);
  await page.goto("/");
  await page.getByRole("button", { name: "New to HaulBoard? Create an account" }).click();
  await page.getByLabel("Full name").fill(testData.signup.full_name);
  await page.getByLabel("Phone").fill(testData.signup.phone);
  await page.getByLabel("Email").fill(testData.signup.email);
  await page.getByLabel("Password", { exact: true }).fill(testData.signup.password);
  await page
    .getByRole("textbox", { name: "Confirm password" })
    .fill(testData.signup.mismatched_password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();

  await page.getByRole("textbox", { name: "Confirm password" }).fill(testData.signup.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Check your email to confirm your account/)).toBeVisible();
});

test("driver books a load, advances status, and reads an in-app notification", async ({ page }) => {
  const load = { ...testData.driver_load };
  load.pickup_date = futureDate(load.pickup_days_from_today);
  load.delivery_date = futureDate(load.delivery_days_from_today);
  delete load.pickup_days_from_today;
  delete load.delivery_days_from_today;
  load.created_at = new Date().toISOString();
  await installSupabaseMock(page, "driver", [load]);
  await page.goto("/");
  await expect(page.locator("#available-loads .load-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.locator('#main-menu a[data-menu-role="driver"]').first()).toBeVisible();
  await expect(page.locator('#main-menu a[data-menu-role="broker"]').first()).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await page.getByRole("button", { name: "Book this load" }).click();
  await expect(page.locator("#driver-bookings")).toContainText("booked");
  await page.getByRole("button", { name: "Show full details" }).click();
  await expect(page.locator("#driver-bookings")).toContainText(
    testData.private_details.pickup_address
  );

  await page.getByRole("button", { name: "Mark picked up" }).click();
  await expect(page.locator("#driver-bookings")).toContainText("in transit");
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.locator("#driver-bookings")).toContainText("delivered");

  await page.getByRole("button", { name: "Open in-app notifications" }).click();
  await expect(page.locator("#notifications-panel")).toContainText("Booking confirmed");
  await page.getByRole("button", { name: /Booking confirmed/ }).click();
  await expect(page.locator("#notification-count")).toBeHidden();
});

test("approved broker can create a load", async ({ page }) => {
  const load = testData.broker_load_form;
  await installSupabaseMock(page, "broker");
  await page.goto("/");
  await expect(page.locator("#broker-dashboard")).toBeVisible();

  await page.getByLabel("Origin city").fill(load.origin_city);
  await page.getByLabel("State / province").nth(0).fill(load.origin_state);
  await page.getByLabel("Destination city").fill(load.destination_city);
  await page.getByLabel("State / province").nth(1).fill(load.destination_state);
  await page.getByLabel("Pickup date").fill(futureDate(load.pickup_days_from_today));
  await page.getByLabel("Delivery date").fill(futureDate(load.delivery_days_from_today));
  await page.getByLabel("Equipment", { exact: true }).selectOption(load.equipment_type);
  await page.getByLabel("Commodity", { exact: true }).fill(load.commodity);
  await page.getByLabel("Weight (lb)").fill(load.weight_lbs);
  await page.getByLabel("Estimated miles").fill(load.miles);
  await page.getByLabel("Driver rate (USD)").fill(load.rate);
  await page.getByLabel("Load notes shown before booking").fill(load.public_notes);
  await page.locator(".private-fields summary").click();
  await page.getByLabel("Pickup address").fill(load.pickup_address);
  await page.getByLabel("Delivery address").fill(load.delivery_address);
  await page.getByLabel("Private instructions").fill(load.instructions);
  await page.getByRole("button", { name: "Post load" }).click();
  await expect(page.getByText("Load posted to the driver board.")).toBeVisible();
  await expect(page.locator("#broker-loads")).toContainText(
    `${load.origin_city}, ${load.origin_state}`
  );
  await expect(page.locator("#broker-loads")).toContainText("$2,250.00");
});
