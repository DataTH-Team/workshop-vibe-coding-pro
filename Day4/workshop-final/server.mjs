import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { normalizeOrdersSchema, ORDERS_SCHEMA_QUERY } from "./lib/orders-schema.mjs";
import { QUERY_TOOL_NAME } from "./lib/query-tool.mjs";
import { createSnowflakeSqlApiTool } from "./lib/snowflake-sql-api.mjs";
import { runToolCallingLoop } from "./lib/tool-loop.mjs";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const demoMode = process.env.DEMO_MODE === "true";

function buildSystemPrompt(schemaPrompt) {
  return `คุณคือผู้ช่วยวิเคราะห์ยอดขายร้านกาแฟ 20 สาขา
ใช้ tool query_orders รัน SQL เพื่อตอบคำถามจากข้อมูลจริง

ข้อมูลอยู่ในตาราง cafe_db.sales.ORDERS โดย backend โหลด schema จริงและ cache ไว้แล้ว:
${schemaPrompt}

ใช้ชื่อคอลัมน์ตามรายการนี้เท่านั้น ห้ามเดาชื่ออย่าง store_id, store_name หรือ branch_id
ไม่ต้อง query information_schema และไม่ต้อง SELECT ตัวอย่างเพื่อค้น schema
คำถามสรุปทั่วไปควรใช้ query เดียว ถ้าคำนวณคำตอบได้ใน SQL เดียว

กติกา:
- ตอบภาษาไทย กระชับ และบอกตัวเลขพร้อมหน่วย
- ใช้ SELECT หรือ WITH เท่านั้น
- ใส่ LIMIT ไม่เกิน 50 เสมอเมื่อดึงข้อมูลระดับแถว
- คำว่า "รายได้" หรือ "ยอดขาย" ให้ใช้เฉพาะ status = 'Completed' เว้นแต่ผู้ใช้ขอสถานะอื่น
- เวลาเทียบสาขา อย่าใช้ยอดรวมอย่างเดียว ให้พิจารณา AOV = SUM(total) / COUNT(DISTINCT order_id)
- คำถามคลุมเครือให้ถามกลับ อย่าเดา
- ถ้า tool ส่ง error ให้แก้ SQL แล้วลองใหม่ได้ แต่ห้ามเรียก tool วนไม่จบ`;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(currentDirectory, "public")));

let aiClient;
let snowflakeToolPromise;
let ordersSchemaPromise;

function requireGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes("วาง_")) {
    throw new Error("ยังไม่ได้ตั้ง GEMINI_API_KEY ใน .env");
  }
  return key;
}

function getAiClient() {
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: requireGeminiKey() });
  return aiClient;
}

function connectSnowflakeTool() {
  return Promise.resolve(
    createSnowflakeSqlApiTool({
      accountUrl: process.env.SNOWFLAKE_ACCOUNT_URL,
      pat: process.env.SNOWFLAKE_PAT,
      database: process.env.SNOWFLAKE_DATABASE || "CAFE_DB",
      schema: process.env.SNOWFLAKE_SCHEMA || "SALES",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "CAFE_WH",
      role: process.env.SNOWFLAKE_ROLE || "CAFE_READONLY",
    }),
  );
}

function getSnowflakeTool() {
  if (!snowflakeToolPromise) {
    snowflakeToolPromise = connectSnowflakeTool().catch((error) => {
      snowflakeToolPromise = undefined;
      throw error;
    });
  }
  return snowflakeToolPromise;
}

function getOrdersSchema() {
  if (!ordersSchemaPromise) {
    ordersSchemaPromise = getSnowflakeTool()
      .then((snowflake) => snowflake.queryTool({ sql: ORDERS_SCHEMA_QUERY }))
      .then(normalizeOrdersSchema)
      .catch((error) => {
        ordersSchemaPromise = undefined;
        throw error;
      });
  }
  return ordersSchemaPromise;
}

function normalizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  const history = rawHistory
    .slice(-12)
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => ({
      role: item.role === "model" || item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.text.trim().slice(0, 4_000) }],
    }));

  while (history.length && history[0].role !== "user") history.shift();
  return history;
}

function publicError(error) {
  const message = String(error?.message || error || "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("gemini_api_key")) return message;
  if (lower.includes("429") || lower.includes("quota")) {
    return "Gemini quota เต็มชั่วคราว กรุณาลองใหม่หรือใช้ fallback key ของคลาส";
  }
  if (
    lower.includes("snowflake_account_url") || lower.includes("snowflake_pat")
  ) {
    return message;
  }
  if (lower.includes("pat_invalid") || lower.includes("unauthorized") || lower.includes("401")) {
    return "Snowflake PAT ใช้ไม่ได้หรือหมดอายุ กรุณาสร้าง PAT ใหม่และตรวจค่าใน .env";
  }
  if (lower.includes("forbidden") || lower.includes("insufficient") || lower.includes("403")) {
    return "CAFE_READONLY ยังไม่มีสิทธิ์ใช้ warehouse หรือ ORDERS";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed")
  ) {
    return "ติดต่อ Snowflake ไม่ได้ กรุณาตรวจ account URL และอินเทอร์เน็ต";
  }
  if (lower.includes("tool") || lower.includes("sql") || lower.includes("loop")) {
    return message.slice(0, 500);
  }
  return "ระบบตอบคำถามไม่สำเร็จ กรุณาตรวจ backend, Gemini key และ Snowflake log";
}

function demoAnswer(message) {
  const lower = message.toLowerCase();
  if (lower.includes("aov") || lower.includes("เฉลี่ย")) {
    return "Thonglor มี AOV สูงสุดที่ 182.41 บาทต่อบิล\n\nเมื่อเทียบกับค่าเฉลี่ยทุกสาขาที่ 88.49 บาท Thonglor สูงกว่าประมาณ 106.1% โดยนับเฉพาะออเดอร์ที่ Completed";
  }
  if (lower.includes("เปรียบเทียบ") || lower.includes("ทุกสาขา")) {
    return "สาขาที่น่าจับตาจากรายได้และ AOV\n\n1. Siam: รายได้ 360,110 บาท, AOV 94.57 บาท\n2. Chatuchak: รายได้ 340,170 บาท, AOV 62.68 บาท\n3. Sathorn: รายได้ 336,505 บาท, AOV 179.57 บาท\n4. Thonglor: รายได้ 304,995 บาท, AOV 182.41 บาท\n\nSiam นำด้านรายได้รวม ส่วน Thonglor เด่นด้านมูลค่าต่อบิล ตัวเลขนี้นับเฉพาะออเดอร์ที่ Completed";
  }
  if (lower.includes("รายได้") || lower.includes("สูงสุด")) {
    return "Siam ทำรายได้รวมสูงสุดที่ 360,110 บาท จาก 3,808 ออเดอร์ที่ Completed\n\nAOV อยู่ที่ 94.57 บาทต่อบิล จึงควรดูทั้งยอดขายรวมและมูลค่าต่อบิลประกอบกัน";
  }
  return "ผมช่วยวิเคราะห์รายได้ AOV สาขา เมนู และช่องทางการสั่งซื้อได้ ลองเลือกคำถามตัวอย่างด้านล่างครับ";
}

function validateChatMessage(request) {
  const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
  if (!message || message.length > 2_000) {
    throw new Error("กรุณาส่งคำถามความยาว 1–2,000 ตัวอักษร");
  }
  return message;
}

async function answerChat({ message, history, onToolCall = () => {}, onToolResult = () => {} }) {
  if (demoMode) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { answer: demoAnswer(message), toolCallCount: 2, mode: "demo" };
  }

  const ai = getAiClient();
  const [snowflake, ordersSchema] = await Promise.all([getSnowflakeTool(), getOrdersSchema()]);
  const chat = ai.chats.create({
    model: geminiModel,
    history: normalizeHistory(history),
    config: {
      systemInstruction: buildSystemPrompt(ordersSchema.prompt),
      tools: [{ functionDeclarations: [snowflake.functionDeclaration] }],
    },
  });

  return runToolCallingLoop({
    chat,
    queryTool: snowflake.queryTool,
    message,
    onToolCall: ({ round, sql }) => {
      console.log(`[sql-api round ${round}] ${QUERY_TOOL_NAME}: ${sql.replaceAll(/\s+/g, " ").slice(0, 240)}`);
      onToolCall({ round, sql });
    },
    onToolResult,
  });
}

app.get("/api/health", async (_request, response) => {
  if (demoMode) {
    response.json({ status: "ok", mode: "demo", model: "sample-data", tool: QUERY_TOOL_NAME });
    return;
  }

  try {
    requireGeminiKey();
    const [snowflake, ordersSchema] = await Promise.all([getSnowflakeTool(), getOrdersSchema()]);
    response.json({
      status: "ok",
      model: geminiModel,
      tool: QUERY_TOOL_NAME,
      snowflakeMode: "sql-api",
      schemaColumns: ordersSchema.columns.length,
    });
  } catch (error) {
    response.status(503).json({ status: "error", message: publicError(error) });
  }
});

app.post("/api/chat", async (request, response) => {
  let message;
  try {
    message = validateChatMessage(request);
  } catch (error) {
    response.status(400).json({ error: error.message });
    return;
  }

  try {
    response.json(await answerChat({ message, history: request.body?.history }));
  } catch (error) {
    console.error("Chat error:", publicError(error));
    response.status(502).json({ error: publicError(error) });
  }
});

app.post("/api/chat/stream", async (request, response) => {
  let message;
  try {
    message = validateChatMessage(request);
  } catch (error) {
    response.status(400).json({ error: error.message });
    return;
  }

  response.status(200);
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.flushHeaders();

  const sendEvent = (event) => {
    if (!response.destroyed && !response.writableEnded) {
      response.write(`${JSON.stringify(event)}\n`);
    }
  };
  sendEvent({ type: "progress", step: "backend" });

  try {
    const result = await answerChat({
      message,
      history: request.body?.history,
      onToolCall: ({ round }) => sendEvent({ type: "progress", step: "sql-api", round }),
      onToolResult: ({ round }) => sendEvent({ type: "progress", step: "snowflake", round }),
    });
    sendEvent({ type: "answer", ...result });
  } catch (error) {
    const messageForUser = publicError(error);
    console.error("Chat stream error:", messageForUser);
    sendEvent({ type: "error", error: messageForUser });
  } finally {
    response.end();
  }
});

app.get("/*path", (_request, response) => {
  response.sendFile(path.join(currentDirectory, "public", "index.html"));
});

const server = app.listen(port, host, () => {
  console.log(`Cafe Sales Intelligence พร้อมที่ http://${host}:${port}`);
});

async function shutdown(signal) {
  console.log(`กำลังปิด backend (${signal})`);
  server.close();
  const snowflake = await snowflakeToolPromise?.catch(() => undefined);
  await snowflake?.close().catch(() => {});
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
