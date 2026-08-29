import assert from "node:assert/strict";
import test from "node:test";
import { QUERY_TOOL, toGeminiFunctionDeclaration } from "../lib/query-tool.mjs";
import {
  createSnowflakeSqlApiTool,
  rowsToObjects,
  validateSqlApiConfig,
} from "../lib/snowflake-sql-api.mjs";
import { assertReadOnlySql, MAX_TOOL_ROUNDS, runToolCallingLoop } from "../lib/tool-loop.mjs";

test("derives the SQL API endpoint from the Snowflake account URL", () => {
  const direct = validateSqlApiConfig({
    accountUrl: "https://org-account.snowflakecomputing.com",
    pat: "test-token",
  });

  assert.equal(direct.href, "https://org-account.snowflakecomputing.com/api/v2/statements");
});

test("runs a capped read-only query through the Snowflake SQL API", async () => {
  let requestBody;
  const fetchImpl = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        resultSetMetaData: {
          partitionInfo: [{ rowCount: 1 }],
          rowType: [
            { name: "BRANCH" },
            { name: "REVENUE" },
          ],
        },
        data: [["Siam", "360110"]],
        statementStatusUrl: "/api/v2/statements/test-handle",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const tool = createSnowflakeSqlApiTool({
    accountUrl: "https://org-account.snowflakecomputing.com",
    pat: "test-token",
    fetchImpl,
    logger: { log() {} },
  });

  const result = await tool.queryTool({
    sql: "SELECT branch, SUM(total) AS revenue FROM cafe_db.sales.ORDERS GROUP BY branch LIMIT 20",
  });

  assert.match(requestBody.statement, /^SELECT \* FROM \(/);
  assert.match(requestBody.statement, /LIMIT 51$/);
  assert.equal(requestBody.role, "CAFE_READONLY");
  assert.deepEqual(result, [{ BRANCH: "Siam", REVENUE: "360110" }]);
});

test("formats Snowflake timestamp and date wire values before returning them to Gemini", () => {
  const rows = rowsToObjects(
    [
      { name: "LATEST_ORDER", type: "timestamp_ntz" },
      { name: "ORDER_DATE", type: "date" },
    ],
    [["1783341120.000000000", "20640"]],
  );

  assert.deepEqual(rows, [
    {
      LATEST_ORDER: "2026-07-06T12:32:00.000Z",
      ORDER_DATE: "2026-07-06",
    },
  ]);
});

test("derives the Gemini declaration for query_orders", () => {
  const declaration = toGeminiFunctionDeclaration(QUERY_TOOL);

  assert.equal(declaration.name, "query_orders");
  assert.deepEqual(declaration.parametersJsonSchema, QUERY_TOOL.inputSchema);
});

test("accepts one read-only query", () => {
  assert.equal(
    assertReadOnlySql("SELECT branch, SUM(total) FROM cafe_db.sales.ORDERS GROUP BY branch;"),
    "SELECT branch, SUM(total) FROM cafe_db.sales.ORDERS GROUP BY branch",
  );
});

test("blocks writes and multiple statements", () => {
  assert.throws(() => assertReadOnlySql("DROP TABLE cafe_db.sales.ORDERS"), /SELECT หรือ WITH/);
  assert.throws(() => assertReadOnlySql("SELECT 1; SELECT 2"), /1 SQL statement/);
  assert.throws(() => assertReadOnlySql("SELECT * FROM cafe_db.sales.ORDERS"), /ต้องมี LIMIT/);
});

test("runs Gemini → Snowflake query tool → Gemini until a final answer", async () => {
  const sentMessages = [];
  const responses = [
    {
      functionCalls: [
        {
          id: "call-1",
          name: "query_orders",
          args: { sql: "SELECT branch, SUM(total) AS revenue FROM cafe_db.sales.ORDERS GROUP BY branch LIMIT 20" },
        },
      ],
    },
    { functionCalls: [], text: "Siam ทำรายได้รวมสูงสุด" },
  ];
  const chat = {
    async sendMessage({ message }) {
      sentMessages.push(message);
      return responses.shift();
    },
  };
  const queries = [];
  const completedQueries = [];
  const queryTool = async ({ sql }) => {
    queries.push(sql);
    return JSON.stringify([{ BRANCH: "Siam", REVENUE: 1250000 }]);
  };

  const result = await runToolCallingLoop({
    chat,
    queryTool,
    message: "สาขาไหนรายได้สูงสุด",
    onToolResult: ({ sql }) => completedQueries.push(sql),
  });

  assert.equal(result.answer, "Siam ทำรายได้รวมสูงสุด");
  assert.equal(result.toolCallCount, 1);
  assert.equal(queries.length, 1);
  assert.deepEqual(completedQueries, queries);
  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[1][0].functionResponse.id, "call-1");
  assert.equal(sentMessages[1][0].functionResponse.name, "query_orders");
});

test("returns a blocked SQL error to Gemini so it can correct itself", async () => {
  const sentMessages = [];
  const responses = [
    {
      functionCalls: [
        { id: "call-1", name: "query_orders", args: { sql: "DROP TABLE cafe_db.sales.ORDERS" } },
      ],
    },
    { functionCalls: [], text: "คำสั่งนั้นไม่ปลอดภัย จึงไม่ได้รัน" },
  ];
  const chat = {
    async sendMessage({ message }) {
      sentMessages.push(message);
      return responses.shift();
    },
  };

  const result = await runToolCallingLoop({
    chat,
    queryTool: async () => assert.fail("blocked SQL must not reach Snowflake"),
    message: "ลบตาราง",
  });

  assert.match(sentMessages[1][0].functionResponse.response.error, /SELECT หรือ WITH/);
  assert.equal(result.toolCallCount, 1);
});

test("accepts a final answer after the tenth allowed tool round", async () => {
  let responseIndex = 0;
  const responses = [
    ...Array.from({ length: MAX_TOOL_ROUNDS }, (_value, index) => ({
      functionCalls: [
        {
          id: `call-${index + 1}`,
          name: "query_orders",
          args: { sql: `SELECT ${index + 1}` },
        },
      ],
    })),
    { functionCalls: [], text: "คำตอบหลัง query รอบที่ 10" },
  ];
  const chat = {
    async sendMessage() {
      const response = responses[responseIndex];
      responseIndex += 1;
      return response;
    },
  };

  const result = await runToolCallingLoop({
    chat,
    queryTool: async ({ sql }) => [{ SQL: sql }],
    message: "ทดสอบสิบรอบ",
  });

  assert.equal(result.answer, "คำตอบหลัง query รอบที่ 10");
  assert.equal(result.toolCallCount, MAX_TOOL_ROUNDS);
});

test("blocks an eleventh requested tool round", async () => {
  let responseIndex = 0;
  const responses = Array.from({ length: MAX_TOOL_ROUNDS + 1 }, (_value, index) => ({
    functionCalls: [
      {
        id: `call-${index + 1}`,
        name: "query_orders",
        args: { sql: `SELECT ${index + 1}` },
      },
    ],
  }));
  const chat = {
    async sendMessage() {
      const response = responses[responseIndex];
      responseIndex += 1;
      return response;
    },
  };

  await assert.rejects(
    () =>
      runToolCallingLoop({
        chat,
        queryTool: async ({ sql }) => [{ SQL: sql }],
        message: "ทดสอบเกิน limit",
      }),
    /ขอเรียก tool เกิน 10 รอบ/,
  );
});
