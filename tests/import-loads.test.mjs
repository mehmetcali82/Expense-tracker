import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, parseLoadRecords } from "../scripts/import-loads.mjs";

test("CSV parser supports quoted commas, escaped quotes, and embedded newlines", () => {
  assert.deepEqual(parseCsv('city,notes\r\n"New York","Dock, bay 2"\r\n"Austin","Line 1\nLine ""2"""'), [
    ["city", "notes"],
    ["New York", "Dock, bay 2"],
    ["Austin", 'Line 1\nLine "2"'],
  ]);
});

test("CSV parser rejects malformed quotes", () => {
  assert.throws(() => parseCsv('name,notes\n"closed"suffix,value'), /after a closing quote/);
  assert.throws(() => parseCsv("name,notes\nunquoted\"quote,value"), /quote inside an unquoted field/);
});

test("load CSV rows map to create_load RPC parameters", () => {
  const csv = [
    "origin_city,origin_state,destination_city,destination_state,pickup_date,delivery_date,equipment_type,weight_lbs,commodity,miles,rate,pickup_address,delivery_address,public_notes,instructions",
    'Denver,CO,Dallas,TX,2030-08-01,2030-08-02,"Dry van",38000,"Palletized goods",794,2250,"123 Pickup Rd","456 Delivery Rd","Keep upright","Call on arrival"',
  ].join("\n");

  assert.deepEqual(parseLoadRecords(csv), [
    {
      p_origin_city: "Denver",
      p_origin_state: "CO",
      p_destination_city: "Dallas",
      p_destination_state: "TX",
      p_pickup_date: "2030-08-01",
      p_delivery_date: "2030-08-02",
      p_equipment_type: "Dry van",
      p_weight_lbs: 38000,
      p_commodity: "Palletized goods",
      p_miles: 794,
      p_rate: 2250,
      p_public_notes: "Keep upright",
      p_pickup_address: "123 Pickup Rd",
      p_delivery_address: "456 Delivery Rd",
      p_instructions: "Call on arrival",
    },
  ]);
});

test("load CSV rejects invalid dates, weights, and missing private addresses", () => {
  const header =
    "origin_city,origin_state,destination_city,destination_state,pickup_date,delivery_date,equipment_type,weight_lbs,commodity,miles,rate,pickup_address,delivery_address";
  const row =
    "Denver,CO,Dallas,TX,2030-02-30,2030-03-01,Dry van,0,Goods,794,2250,Pickup Rd,Delivery Rd";
  assert.throws(() => parseLoadRecords(`${header}\n${row}`), /dates must use YYYY-MM-DD/);

  const validRow =
    "Denver,CO,Dallas,TX,2030-03-01,2030-03-02,Dry van,0,Goods,794,2250,Pickup Rd,Delivery Rd";
  assert.throws(() => parseLoadRecords(`${header}\n${validRow}`), /weight_lbs must be a positive integer/);

  const blankAddressRow =
    "Denver,CO,Dallas,TX,2030-03-01,2030-03-02,Dry van,,Goods,794,2250,Pickup Rd,";
  assert.throws(() => parseLoadRecords(`${header}\n${blankAddressRow}`), /delivery_address is required/);
});
