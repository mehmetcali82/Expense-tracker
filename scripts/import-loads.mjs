import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const requiredColumns = [
  "origin_city",
  "origin_state",
  "destination_city",
  "destination_state",
  "pickup_date",
  "delivery_date",
  "equipment_type",
  "commodity",
  "miles",
  "rate",
  "pickup_address",
  "delivery_address",
];
const optionalColumns = ["weight_lbs", "public_notes", "instructions"];
const allowedColumns = new Set([...requiredColumns, ...optionalColumns]);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inQuotes) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === " " || character === "\t") continue;
      if (character !== "," && character !== "\n" && character !== "\r") {
        throw new Error("CSV contains unexpected text after a closing quote.");
      }
      afterQuote = false;
    }

    if (character === '"') {
      if (field.length !== 0) throw new Error("CSV contains a quote inside an unquoted field.");
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function positiveNumber(value, column, rowNumber, integer = false) {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number <= 0 ||
    (integer && !Number.isInteger(number))
  ) {
    throw new Error(`Row ${rowNumber}: ${column} must be a positive ${integer ? "integer" : "number"}.`);
  }
  return number;
}

function createLoadParameters(record, rowNumber) {
  for (const column of requiredColumns) {
    if (!record[column]?.trim()) {
      throw new Error(`Row ${rowNumber}: ${column} is required.`);
    }
  }
  if (!isValidDate(record.pickup_date) || !isValidDate(record.delivery_date)) {
    throw new Error(`Row ${rowNumber}: dates must use YYYY-MM-DD and be valid calendar dates.`);
  }
  if (record.delivery_date < record.pickup_date) {
    throw new Error(`Row ${rowNumber}: delivery_date must be on or after pickup_date.`);
  }

  const weight = record.weight_lbs?.trim()
    ? positiveNumber(record.weight_lbs, "weight_lbs", rowNumber, true)
    : null;

  return {
    p_origin_city: record.origin_city.trim(),
    p_origin_state: record.origin_state.trim(),
    p_destination_city: record.destination_city.trim(),
    p_destination_state: record.destination_state.trim(),
    p_pickup_date: record.pickup_date,
    p_delivery_date: record.delivery_date,
    p_equipment_type: record.equipment_type.trim(),
    p_weight_lbs: weight,
    p_commodity: record.commodity.trim(),
    p_miles: positiveNumber(record.miles, "miles", rowNumber, true),
    p_rate: positiveNumber(record.rate, "rate", rowNumber),
    p_public_notes: record.public_notes?.trim() || null,
    p_pickup_address: record.pickup_address.trim(),
    p_delivery_address: record.delivery_address.trim(),
    p_instructions: record.instructions?.trim() || null,
  };
}

export function parseLoadRecords(text) {
  const [headerRow, ...dataRows] = parseCsv(text);
  if (!headerRow) throw new Error("CSV file is empty.");
  const headers = headerRow.map((header) => header.trim().toLowerCase());

  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate column names.");
  }
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`CSV is missing required columns: ${missing.join(", ")}.`);
  }
  const unsupported = headers.filter((header) => !allowedColumns.has(header));
  if (unsupported.length) {
    throw new Error(`Unsupported CSV columns: ${unsupported.join(", ")}.`);
  }
  if (!dataRows.length) throw new Error("CSV has a header but no load rows.");

  return dataRows.map((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== headers.length) {
      throw new Error(`Row ${rowNumber}: expected ${headers.length} columns, found ${row.length}.`);
    }
    const record = Object.fromEntries(headers.map((header, column) => [header, row[column]]));
    return createLoadParameters(record, rowNumber);
  });
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDemoLoadParameters() {
  return [
    createLoadParameters(
      {
        origin_city: "Denver",
        origin_state: "CO",
        destination_city: "Dallas",
        destination_state: "TX",
        pickup_date: dateOffset(7),
        delivery_date: dateOffset(8),
        equipment_type: "Dry van",
        weight_lbs: "38000",
        commodity: "Demo palletized goods",
        miles: "794",
        rate: "2250",
        public_notes: "Sample load only. Confirm all details before dispatch.",
        pickup_address: "123 Demo Warehouse Road, Denver, CO",
        delivery_address: "456 Demo Distribution Lane, Dallas, TX",
        instructions: "Demo details only; replace before using this as a real load.",
      },
      1
    ),
  ];
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error("Usage: node scripts/import-loads.mjs <loads.csv|--demo>");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;
  if (!supabaseUrl || !publishableKey || !email || !password) {
    throw new Error(
      "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_EMAIL, and SUPABASE_PASSWORD."
    );
  }

  const loadParameters =
    csvPath === "--demo"
      ? createDemoLoadParameters()
      : parseLoadRecords(await readFile(path.resolve(csvPath), "utf8"));
  const supabase = createClient(supabaseUrl, publishableKey);
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Sign-in failed: ${signInError.message}`);

  let imported = 0;
  const failures = [];
  for (let index = 0; index < loadParameters.length; index += 1) {
    const rowNumber = index + 2;
    const { data, error } = await supabase.rpc("create_load", loadParameters[index]);
    if (error) {
      failures.push(`Row ${rowNumber}: ${error.message}`);
      console.error(`Import failed for CSV row ${rowNumber}: ${error.message}`);
      continue;
    }
    imported += 1;
    console.log(`Imported CSV row ${rowNumber} (load ${data}).`);
  }

  console.log(`Import finished: ${imported} imported, ${failures.length} failed.`);
  if (failures.length) process.exitCode = 1;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
