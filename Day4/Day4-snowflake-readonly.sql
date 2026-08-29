-- Day 4 — Create Snowflake role-restricted PAT
-- ACCOUNTADMIN = Role ของเรา มีอำนาจสูงสุดในการจัดการ Snowflake
-- เราไม่อยากให้ AI ใช้ ACCOUNTADMIN โดยตรง เพราะมันมีสิทธิ์มากเกินไป จึงสร้าง PAT (Personal Access Token) ให้ AI อ่านข้อมูลได้อย่างเดียว (Read-only)
--
-- วิธีรัน: ขั้นตอน 1-5 กด Run All ได้ · ขั้นตอน 6 และ 7 ต้องรันทีละคำสั่ง (อ่านคำเตือนในแต่ละขั้น)

USE ROLE ACCOUNTADMIN;

-- 1) สร้าง Schema สำหรับเก็บข้อมูล
CREATE DATABASE IF NOT EXISTS cafe_db;
CREATE SCHEMA IF NOT EXISTS cafe_db.sales;

-- 2) สร้าง Warehouse สำหรับให้ AI ประมวลผล
CREATE WAREHOUSE IF NOT EXISTS cafe_wh WITH
  WAREHOUSE_TYPE = 'STANDARD'
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  STATEMENT_TIMEOUT_IN_SECONDS = 30
  COMMENT = 'Day 4 cafe chatbot workshop';

-- 3) สร้าง Role สำหรับ AI โดยให้สิทธิ์น้อยที่สุด (อ่านได้อย่างเดียว)
CREATE ROLE IF NOT EXISTS cafe_readonly;

GRANT USAGE ON WAREHOUSE cafe_wh TO ROLE cafe_readonly;
GRANT USAGE ON DATABASE cafe_db TO ROLE cafe_readonly;
GRANT USAGE ON SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT SELECT ON FUTURE TABLES IN SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT SELECT ON ALL VIEWS IN SCHEMA cafe_db.sales TO ROLE cafe_readonly;
GRANT SELECT ON FUTURE VIEWS IN SCHEMA cafe_db.sales TO ROLE cafe_readonly;

-- ให้ตัวเราเอง (ACCOUNTADMIN) สลับไปใช้ role นี้ได้ เพื่อพิสูจน์ในขั้นตอน 7 ว่ามันเขียนข้อมูลไม่ได้จริง
GRANT ROLE cafe_readonly TO ROLE ACCOUNTADMIN;

-- 4) สร้าง User สำหรับ AI
CREATE USER IF NOT EXISTS cafe_bot
  TYPE = SERVICE
  DEFAULT_ROLE = cafe_readonly
  DEFAULT_WAREHOUSE = cafe_wh
  DEFAULT_NAMESPACE = 'cafe_db.sales'
  DEFAULT_SECONDARY_ROLES = ()
  COMMENT = 'Day 4 Snowflake SQL API service user';

GRANT ROLE cafe_readonly TO USER cafe_bot;

-- 5) เปิดให้ใช้งาน PAT (Personal Access Token) จากไหนก็ได้ (ไม่จำกัด IP) และกำหนดอายุ token เป็น 14 วัน
CREATE OR ALTER AUTHENTICATION POLICY cafe_db.sales.cafe_workshop_pat_policy
  AUTHENTICATION_METHODS = ('PROGRAMMATIC_ACCESS_TOKEN')
  PAT_POLICY = (
    DEFAULT_EXPIRY_IN_DAYS = 14
    MAX_EXPIRY_IN_DAYS = 14
    NETWORK_POLICY_EVALUATION = ENFORCED_NOT_REQUIRED
  )
  COMMENT = 'Role-restricted PAT for the Day 4 workshop';

ALTER USER cafe_bot
  SET AUTHENTICATION POLICY cafe_db.sales.cafe_workshop_pat_policy;

-- 6) สร้าง PAT สำหรับ AI
ALTER USER cafe_bot
  ADD PROGRAMMATIC ACCESS TOKEN cafe_workshop_token
  ROLE_RESTRICTION = 'CAFE_READONLY'
  COMMENT = 'Day 4 workshop backend token';

-- ถ้า copy secret ไม่ทัน หรือเคยสร้าง token ชื่อนี้ไว้แล้ว (error: already exists)
-- ให้รันบรรทัดล่างนี้เพื่อลบ แล้วกลับไปรัน ALTER USER ... ADD ข้างบนใหม่
-- ALTER USER cafe_bot REMOVE PROGRAMMATIC ACCESS TOKEN cafe_workshop_token;


-- 7) ทดสอบว่า role นี้อ่านได้อย่างเดียวจริง
-- *ต้องโหลด Day4-orders-20-branches.csv เข้า cafe_db.sales.ORDERS ก่อน
--    SELECT ต้องสำเร็จ (อ่านได้)
--    INSERT และ DROP ต้อง ERROR (เขียนไม่ได้)

USE ROLE cafe_readonly;
USE SECONDARY ROLES NONE; -- ถ้าไม่ปิด ACCOUNTADMIN ยังทำงานอยู่ด้านหลัง INSERT/DROP จะผ่าน
USE WAREHOUSE cafe_wh;

-- ต้องสำเร็จ (ได้ 50000)
SELECT COUNT(*) FROM cafe_db.sales.ORDERS;

-- ต้อง ERROR: Insufficient privileges
INSERT INTO cafe_db.sales.ORDERS (order_id) VALUES ('ABC-001');

-- ต้อง ERROR: Insufficient privileges
DROP TABLE cafe_db.sales.ORDERS;

-- ============================================================================
-- Debug query - ใช้เช็คเมื่อเกิดปัญหา ไม่ต้องรันในคลาส
-- รันทีละคำสั่งเพื่อดู result grid ของคำสั่งนั้น
-- ============================================================================
-- SHOW GRANTS TO ROLE cafe_readonly;   -- ต้องเห็น SELECT บน ORDERS + USAGE บน warehouse/db/schema
-- SHOW GRANTS TO USER cafe_bot;        -- ต้องเห็น CAFE_READONLY
-- SHOW USER PROGRAMMATIC ACCESS TOKENS FOR USER cafe_bot;  -- เช็ก role_restriction + วันหมดอายุ (ไม่แสดง secret)
-- SHOW PARAMETERS LIKE 'STATEMENT_TIMEOUT_IN_SECONDS' IN WAREHOUSE cafe_wh;
