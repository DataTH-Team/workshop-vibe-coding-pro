-- Day 4 demo — Snowflake-managed MCP for Claude Desktop + ChatGPT
-- ใช้ account ใหม่ได้: สร้าง data layer อ่านอย่างเดียว + MCP server + OAuth
-- Claude / ChatGPT ใช้ OAuth ไม่ใช้ PAT (PAT ยังเป็นของ workshop backend คนละเส้น)
--
-- ก่อนรัน: โหลด Day4-orders-20-branches.csv เข้า cafe_db.sales.ORDERS (Snowsight)
-- วิธีรัน: ขั้นตอน 1-6 กด Run All ได้ · ขั้นตอน 7 รันคนละครั้งเพื่อดู secret

USE ROLE ACCOUNTADMIN;

-- 1) Data layer (ข้ามได้ถ้ามีจาก Workshop 3 แล้ว)
CREATE DATABASE IF NOT EXISTS cafe_db;
CREATE SCHEMA IF NOT EXISTS cafe_db.sales;

CREATE WAREHOUSE IF NOT EXISTS cafe_wh WITH
  WAREHOUSE_TYPE = 'STANDARD'
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  STATEMENT_TIMEOUT_IN_SECONDS = 30
  COMMENT = 'Day 4 cafe chatbot + managed MCP demo';

CREATE ROLE IF NOT EXISTS cafe_readonly;
GRANT USAGE ON WAREHOUSE cafe_wh TO ROLE cafe_readonly;
GRANT USAGE ON DATABASE cafe_db TO ROLE cafe_readonly;
GRANT USAGE ON SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT SELECT ON FUTURE TABLES IN SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT ROLE cafe_readonly TO ROLE ACCOUNTADMIN;

-- 2) MCP server: SQL อ่านอย่างเดียว ชุดเดียวกับ workshop (ไม่ใช้ Cortex Agent)
CREATE OR REPLACE MCP SERVER cafe_db.sales.cafe_mcp
  FROM SPECIFICATION $$
  tools:
    - title: "Cafe orders SQL"
      name: "query_orders"
      type: "SYSTEM_EXECUTE_SQL"
      description: "Run read-only SQL on cafe_db.sales.ORDERS (20-branch cafe, ~50k rows). Use for revenue, AOV, and branch comparisons. Treat รายได้/ยอดขาย as status = Completed only. AOV = SUM(total) / COUNT(DISTINCT order_id)."
      config:
        read_only: true
        query_timeout: 30
        warehouse: "CAFE_WH"
  $$;

GRANT USAGE ON MCP SERVER cafe_db.sales.cafe_mcp TO ROLE cafe_readonly;

-- 3) User สำหรับล็อกอิน OAuth ใน Claude / ChatGPT
--    อย่าใช้ cafe_bot (service + PAT) และอย่าให้ DEFAULT_ROLE เป็น ACCOUNTADMIN
CREATE USER IF NOT EXISTS cafe_mcp_demo
  PASSWORD = 'ChangeMe_DemoOnly_1'
  MUST_CHANGE_PASSWORD = FALSE
  DEFAULT_ROLE = cafe_readonly
  DEFAULT_WAREHOUSE = cafe_wh
  DEFAULT_NAMESPACE = 'cafe_db.sales'
  COMMENT = 'Day 4 managed MCP demo user for Claude Desktop + ChatGPT';

GRANT ROLE cafe_readonly TO USER cafe_mcp_demo;

-- 4) OAuth app ตัวเดียว ใช้กับ Claude Desktop / claude.ai / ChatGPT
CREATE OR REPLACE SECURITY INTEGRATION cafe_mcp_oauth
  TYPE = OAUTH
  OAUTH_CLIENT = CUSTOM
  ENABLED = TRUE
  OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
  OAUTH_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback'
  OAUTH_ALTERNATE_REDIRECT_URIS = (
    'https://claude.com/api/mcp/auth_callback',
    'https://chatgpt.com/connector_platform_oauth_redirect'
  )
  OAUTH_USE_SECONDARY_ROLES = NONE
  ALLOWED_ROLES_LIST = ('CAFE_READONLY')
  COMMENT = 'Day 4 demo: Claude Desktop + ChatGPT managed MCP';

-- 5) URL ที่ต้องวางใน Claude / ChatGPT (ต้องเป็น org-account แบบขีดกลาง)
SELECT
  'https://'
  || REPLACE(CURRENT_ORGANIZATION_NAME(), '_', '-')
  || '-'
  || REPLACE(CURRENT_ACCOUNT_NAME(), '_', '-')
  || '.snowflakecomputing.com/api/v2/databases/CAFE_DB/schemas/SALES/mcp-servers/CAFE_MCP'
  AS mcp_server_url;

-- 6) ตรวจว่า MCP + grant ครบ
SHOW MCP SERVERS IN SCHEMA cafe_db.sales;
DESCRIBE MCP SERVER cafe_db.sales.cafe_mcp;

-- 7) คัด client id / secret ไปใส่ Claude และ ChatGPT (รันคำสั่งนี้คำสั่งเดียว)
--    ชื่อ integration ต้องพิมพ์ใหญ่
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('CAFE_MCP_OAUTH');
