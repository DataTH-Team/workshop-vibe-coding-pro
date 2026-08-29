export const QUERY_TOOL_NAME = "query_orders";

export const QUERY_TOOL = {
  name: QUERY_TOOL_NAME,
  description:
    "Run one read-only SELECT or WITH query against cafe_db.sales.ORDERS. Columns: order_id, datetime, menu, category, qty, price, total, channel, customer, status, branch. Use LIMIT for row-level results.",
  inputSchema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "One read-only Snowflake SQL SELECT or WITH statement.",
      },
    },
    required: ["sql"],
    additionalProperties: false,
  },
};

export function toGeminiFunctionDeclaration(tool = QUERY_TOOL) {
  return {
    name: tool.name,
    description: tool.description || "Run one read-only SQL query against cafe sales data.",
    parametersJsonSchema: tool.inputSchema,
  };
}
