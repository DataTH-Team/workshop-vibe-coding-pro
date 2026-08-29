export const ORDERS_SCHEMA_QUERY = `SELECT
  column_name,
  data_type,
  is_nullable
FROM cafe_db.information_schema.columns
WHERE table_schema = 'SALES'
  AND table_name = 'ORDERS'
ORDER BY ordinal_position
LIMIT 50`;

const REQUIRED_COLUMNS = [
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

const COLUMN_MEANINGS = {
  ORDER_ID: "รหัสออเดอร์",
  DATETIME: "วันเวลา",
  MENU: "ชื่อเมนู",
  CATEGORY: "หมวดหมู่",
  QTY: "จำนวนชิ้น",
  PRICE: "ราคาต่อชิ้น",
  TOTAL: "ยอดรวมของรายการ",
  CHANNEL: "ช่องทางการสั่งซื้อ",
  CUSTOMER: "ชื่อลูกค้า",
  STATUS: "สถานะออเดอร์",
  BRANCH: "ชื่อสาขา",
};

function cleanIdentifier(value) {
  const identifier = String(value || "").toUpperCase();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(identifier)) {
    throw new Error("Snowflake ส่งชื่อคอลัมน์ที่ไม่ถูกต้อง");
  }
  return identifier;
}

function cleanDataType(value) {
  const dataType = String(value || "UNKNOWN").toUpperCase().replace(/[^A-Z0-9_(), ]/g, "");
  return dataType || "UNKNOWN";
}

export function normalizeOrdersSchema(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("ไม่พบ schema ของ CAFE_DB.SALES.ORDERS");
  }

  const columns = rows.map((row) => ({
    name: cleanIdentifier(row.COLUMN_NAME ?? row.column_name),
    dataType: cleanDataType(row.DATA_TYPE ?? row.data_type),
    nullable: String(row.IS_NULLABLE ?? row.is_nullable).toUpperCase() === "YES",
  }));
  const names = new Set(columns.map((column) => column.name));
  const missing = REQUIRED_COLUMNS.filter((column) => !names.has(column));
  if (missing.length > 0) {
    throw new Error(`ORDERS ขาดคอลัมน์ที่ workshop ต้องใช้: ${missing.join(", ")}`);
  }

  const prompt = columns
    .map((column) => {
      const meaning = COLUMN_MEANINGS[column.name] ? ` — ${COLUMN_MEANINGS[column.name]}` : "";
      const nullable = column.nullable ? ", nullable" : "";
      return `- ${column.name.toLowerCase()} (${column.dataType}${nullable})${meaning}`;
    })
    .join("\n");

  return { columns, prompt };
}
