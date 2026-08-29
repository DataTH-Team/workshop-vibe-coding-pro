import { QUERY_TOOL_NAME } from "./query-tool.mjs";

export const MAX_TOOL_ROUNDS = 10;
export const MAX_TOOL_RESULT_CHARS = 60_000;

const blockedSqlKeywords =
  /\b(insert|update|delete|merge|create|alter|drop|truncate|copy|put|get|call|grant|revoke|undrop|remove)\b/i;

export function assertReadOnlySql(value) {
  if (typeof value !== "string") {
    throw new Error("Tool ต้องส่ง SQL เป็นข้อความ");
  }

  const trimmed = value.trim();
  if (!trimmed) throw new Error("SQL ว่างเปล่า");
  if (trimmed.length > 8_000) throw new Error("SQL ยาวเกินขอบเขตของ workshop");
  if (/--|\/\*/.test(trimmed)) throw new Error("ไม่อนุญาต SQL comments ใน tool call");

  const sql = trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
  if (sql.includes(";")) throw new Error("อนุญาตครั้งละ 1 SQL statement เท่านั้น");
  if (!/^(select|with)\b/i.test(sql)) {
    throw new Error("อนุญาตเฉพาะ SELECT หรือ WITH เท่านั้น");
  }
  if (blockedSqlKeywords.test(sql)) {
    throw new Error("พบคำสั่งที่ไม่ใช่ read-only");
  }
  if (/\bselect\s+\*/i.test(sql) && !/\blimit\s+\d+/i.test(sql)) {
    throw new Error("SELECT * ต้องมี LIMIT");
  }

  return sql;
}

function normalizeToolResult(result) {
  const text = typeof result === "string" ? result : JSON.stringify(result);
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    throw new Error("ผล query ใหญ่เกินไป ให้เขียน SQL ที่ aggregate หรือใส่ LIMIT");
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function safeErrorMessage(error) {
  return String(error?.message || error || "Tool call failed").slice(0, 500);
}

export async function runToolCallingLoop({
  chat,
  queryTool,
  message,
  maxToolRounds = MAX_TOOL_ROUNDS,
  onToolCall = () => {},
  onToolResult = () => {},
}) {
  let response = await chat.sendMessage({ message });
  let toolCallCount = 0;

  for (let round = 0; ; round += 1) {
    const calls = response.functionCalls || [];
    if (calls.length === 0) {
      const answer = typeof response.text === "function" ? response.text() : response.text;
      return {
        answer: String(answer || "ขออภัย โมเดลไม่ได้ส่งคำตอบกลับมา"),
        toolCallCount,
      };
    }

    if (round >= maxToolRounds) {
      throw new Error(`Gemini ขอเรียก tool เกิน ${maxToolRounds} รอบ จึงหยุดเพื่อกัน loop`);
    }

    const functionResponses = [];
    for (const call of calls) {
      toolCallCount += 1;
      const functionName = call.name || "unknown_tool";
      let payload;

      try {
        if (functionName !== QUERY_TOOL_NAME) {
          throw new Error(`ไม่รู้จัก tool: ${functionName}`);
        }

        const sql = assertReadOnlySql(call.args?.sql);
        onToolCall({ round: round + 1, sql });
        const result = await queryTool({ sql });
        onToolResult({ round: round + 1, sql });
        payload = { output: normalizeToolResult(result) };
      } catch (error) {
        payload = { error: safeErrorMessage(error) };
      }

      functionResponses.push({
        functionResponse: {
          id: call.id,
          name: functionName,
          response: payload,
        },
      });
    }

    response = await chat.sendMessage({ message: functionResponses });
  }
}
