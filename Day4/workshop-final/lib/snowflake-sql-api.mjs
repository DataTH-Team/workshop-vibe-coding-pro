import { setTimeout as delay } from "node:timers/promises";
import { QUERY_TOOL, toGeminiFunctionDeclaration } from "./query-tool.mjs";
import { assertReadOnlySql } from "./tool-loop.mjs";

const MAX_RESULT_ROWS = 50;
const MAX_PARTITIONS = 20;
const MAX_STATUS_POLLS = 60;
const STATUS_POLL_DELAY_MS = 500;

function requirePat(pat) {
  if (!pat || pat.includes("วาง_")) {
    throw new Error("ยังไม่ได้ตั้ง SNOWFLAKE_PAT ใน .env");
  }
  return pat;
}

export function validateSqlApiConfig({ accountUrl, pat }) {
  requirePat(pat);
  if (!accountUrl) {
    throw new Error("ยังไม่ได้ตั้ง SNOWFLAKE_ACCOUNT_URL ใน .env");
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(accountUrl);
  } catch {
    throw new Error("Snowflake account URL ไม่ถูกต้อง");
  }

  if (sourceUrl.protocol !== "https:") {
    throw new Error("Snowflake account URL ต้องขึ้นต้นด้วย https://");
  }
  if (!sourceUrl.hostname.toLowerCase().endsWith(".snowflakecomputing.com")) {
    throw new Error("Snowflake account URL ต้องอยู่บนโดเมน snowflakecomputing.com");
  }

  return new URL("/api/v2/statements", sourceUrl.origin);
}

function requestHeaders(pat) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
    "User-Agent": "day4-cafe-chatbot/1.0",
    "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
  };
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Snowflake SQL API ส่งข้อมูลที่อ่านไม่ได้ (HTTP ${response.status})`);
  }
}

function sqlApiError(response, body) {
  const detail = String(body?.message || body?.code || response.statusText || "Unknown error").slice(0, 500);
  return new Error(`Snowflake SQL API error (HTTP ${response.status}): ${detail}`);
}

async function fetchResult({ fetchImpl, url, headers, init }) {
  const response = await fetchImpl(url, {
    ...init,
    headers,
    signal: init?.signal || AbortSignal.timeout(35_000),
  });
  const body = await readResponse(response);
  return { response, body };
}

async function waitForStatement({ fetchImpl, endpoint, headers, initialBody }) {
  if (!initialBody.statementStatusUrl) {
    throw new Error("Snowflake SQL API ยังประมวลผลอยู่ แต่ไม่ได้ส่ง statementStatusUrl");
  }

  const statusUrl = new URL(initialBody.statementStatusUrl, endpoint);
  for (let poll = 0; poll < MAX_STATUS_POLLS; poll += 1) {
    await delay(STATUS_POLL_DELAY_MS);
    const { response, body } = await fetchResult({ fetchImpl, url: statusUrl, headers });

    if (response.status === 200) return { response, body };
    if (response.status !== 202) throw sqlApiError(response, body);
  }

  throw new Error("Snowflake query ใช้เวลานานเกิน 30 วินาที");
}

async function collectRows({ fetchImpl, endpoint, headers, response, body }) {
  if (!response.ok) throw sqlApiError(response, body);

  const partitionInfo = body.resultSetMetaData?.partitionInfo || [];
  if (partitionInfo.length > MAX_PARTITIONS) {
    throw new Error("Snowflake query ส่งผลลัพธ์ใหญ่เกินขอบเขตของ workshop");
  }

  const rows = Array.isArray(body.data) ? [...body.data] : [];
  for (let partition = 1; partition < partitionInfo.length; partition += 1) {
    const partitionUrl = new URL(body.statementStatusUrl, endpoint);
    partitionUrl.searchParams.set("partition", String(partition));
    const next = await fetchResult({ fetchImpl, url: partitionUrl, headers });
    if (!next.response.ok) throw sqlApiError(next.response, next.body);

    const partitionRows = Array.isArray(next.body) ? next.body : next.body.data;
    if (!Array.isArray(partitionRows)) {
      throw new Error(`Snowflake SQL API ไม่ได้ส่งข้อมูล partition ${partition}`);
    }
    rows.push(...partitionRows);
  }

  return rows;
}

function formatSqlApiValue(column, value) {
  if (value === null || value === undefined) return value;

  const type = String(column?.type || "").toLowerCase();
  if (type.startsWith("timestamp")) {
    const epochSeconds = Number(value);
    if (Number.isFinite(epochSeconds)) {
      return new Date(epochSeconds * 1_000).toISOString();
    }
  }

  if (type === "date") {
    const epochDays = Number(value);
    if (Number.isFinite(epochDays)) {
      return new Date(epochDays * 86_400_000).toISOString().slice(0, 10);
    }
  }

  return value;
}

export function rowsToObjects(rowType, rows) {
  const columns = (rowType || []).map((column, index) => ({
    ...column,
    name: column.name || `COLUMN_${index + 1}`,
  }));
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column, index) => [column.name, formatSqlApiValue(column, row[index])]),
    ),
  );
}

export function createSnowflakeSqlApiTool({
  accountUrl,
  pat,
  database = "CAFE_DB",
  schema = "SALES",
  warehouse = "CAFE_WH",
  role = "CAFE_READONLY",
  fetchImpl = fetch,
  logger = console,
}) {
  const endpoint = validateSqlApiConfig({ accountUrl, pat });
  const headers = requestHeaders(requirePat(pat));

  return {
    functionDeclaration: toGeminiFunctionDeclaration(),
    async queryTool({ sql }) {
      const safeSql = assertReadOnlySql(sql);
      const cappedSql = `SELECT * FROM (${safeSql}) AS CAFE_QUERY_RESULT LIMIT ${MAX_RESULT_ROWS + 1}`;
      logger.log(`[sql-api query] ${safeSql.replaceAll(/\s+/g, " ").slice(0, 240)}`);

      let result = await fetchResult({
        fetchImpl,
        url: endpoint,
        headers,
        init: {
          method: "POST",
          body: JSON.stringify({
            statement: cappedSql,
            timeout: 30,
            database,
            schema,
            warehouse,
            role,
          }),
        },
      });

      if (result.response.status === 202) {
        result = await waitForStatement({ fetchImpl, endpoint, headers, initialBody: result.body });
      }

      const rows = await collectRows({ fetchImpl, endpoint, headers, ...result });
      if (rows.length > MAX_RESULT_ROWS) {
        throw new Error(`ผล query เกิน ${MAX_RESULT_ROWS} แถว ให้ aggregate เพิ่มหรือใส่ LIMIT`);
      }

      return rowsToObjects(result.body.resultSetMetaData?.rowType, rows);
    },
    close: async () => {},
  };
}
