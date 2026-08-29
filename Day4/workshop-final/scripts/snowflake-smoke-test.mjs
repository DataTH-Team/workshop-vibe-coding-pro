import process from "node:process";
import "dotenv/config";
import { createSnowflakeSqlApiTool } from "../lib/snowflake-sql-api.mjs";

const tool = createSnowflakeSqlApiTool({
  accountUrl: process.env.SNOWFLAKE_ACCOUNT_URL,
  pat: process.env.SNOWFLAKE_PAT,
  database: process.env.SNOWFLAKE_DATABASE || "CAFE_DB",
  schema: process.env.SNOWFLAKE_SCHEMA || "SALES",
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || "CAFE_WH",
  role: process.env.SNOWFLAKE_ROLE || "CAFE_READONLY",
});

try {
  const result = await tool.queryTool({
    sql: "SELECT COUNT(*) AS order_count FROM cafe_db.sales.ORDERS",
  });

  console.log(JSON.stringify(result, null, 2));
  console.log("Snowflake SQL API smoke test ผ่าน");
} catch (error) {
  console.error("Snowflake SQL API smoke test ไม่ผ่าน:", error?.message || error);
  process.exitCode = 1;
}
