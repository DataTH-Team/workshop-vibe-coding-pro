import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOrdersSchema } from "../lib/orders-schema.mjs";

const requiredColumns = [
  "ORDER_ID",
  "DATETIME",
  "MENU",
  "CATEGORY",
  "QTY",
  "PRICE",
  "TOTAL",
  "CHANNEL",
  "CUSTOMER",
  "STATUS",
  "BRANCH",
];

test("formats the live ORDERS schema for the Gemini prompt", () => {
  const rows = requiredColumns.map((column) => ({
    COLUMN_NAME: column,
    DATA_TYPE: column === "QTY" ? "NUMBER" : "TEXT",
    IS_NULLABLE: column === "CUSTOMER" ? "YES" : "NO",
  }));

  const schema = normalizeOrdersSchema(rows);

  assert.equal(schema.columns.length, 11);
  assert.match(schema.prompt, /- qty \(NUMBER\) — จำนวนชิ้น/);
  assert.match(schema.prompt, /- customer \(TEXT, nullable\) — ชื่อลูกค้า/);
});

test("rejects a schema missing workshop columns", () => {
  assert.throws(
    () => normalizeOrdersSchema([{ COLUMN_NAME: "ORDER_ID", DATA_TYPE: "TEXT", IS_NULLABLE: "NO" }]),
    /ORDERS ขาดคอลัมน์/,
  );
});
