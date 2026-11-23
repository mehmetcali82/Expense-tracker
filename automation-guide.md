# HaulBoard automation

## Supabase setup

1. Run the updated `supabase-schema.sql` in the Supabase SQL Editor.
2. Run `supabase-cron.sql` to schedule hourly expiration. It cancels open loads whose pickup date is before the database's current date and adds an in-app notification for the broker. Booked loads are not expired.
3. In Supabase, manually approve each verified broker before they post loads.

Notifications are stored in the database and shown in the app's Updates menu. The app checks for new notifications once per minute; it does not send email.

## Import loads from CSV

Use the approved broker's account. The importer signs in with that account and calls the same `create_load` RPC as the app; it does not use a service-role key.

Set these variables in the current PowerShell session, then import:

```powershell
$env:SUPABASE_URL = "your project URL"
$env:SUPABASE_PUBLISHABLE_KEY = "your publishable key"
$env:SUPABASE_EMAIL = "approved broker email"
$env:SUPABASE_PASSWORD = "approved broker password"
npm run import:loads -- .\loads.csv
```

Required CSV headers:

```text
origin_city,origin_state,destination_city,destination_state,pickup_date,delivery_date,equipment_type,commodity,miles,rate,pickup_address,delivery_address
```

Dates must be `YYYY-MM-DD`; miles and rate must be positive, and weight (if supplied) must be a positive whole number. Optional columns are `weight_lbs`, `public_notes`, and `instructions`. Quote CSV values containing commas or newlines.

To create one clearly labeled sample load with dates a week ahead, run:

```powershell
npm run import:loads -- --demo
```

This inserts a real load into the configured Supabase project. Use a test project if you do not want the sample visible to drivers.

## Tests

```powershell
npm start
```

Open `http://127.0.0.1:4173/` in your browser. Stop the local server with `Ctrl+C`.

Run the automated checks separately:

```powershell
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` opens a visible Chromium window and pauses 700 ms between browser actions so you can follow along. The browser tests use a mocked Supabase client, so they do not create accounts or change live marketplace data.
