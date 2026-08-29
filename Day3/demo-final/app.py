# -*- coding: utf-8 -*-
"""Wanderbricks Data App — หน้าแดชบอร์ด

เปิดด้วย ?view=analytics ถ้าไม่มีจะไปที่หน้าร้าน (landing.py)
มี 3 แท็บ  Charts · Chat · AI Insights
ทุกตัวเลขมาจาก samples.wanderbricks ผ่าน SQL warehouse
"""
import html as H
import os

import pandas as pd
import plotly.express as px
import streamlit as st
from databricks.sdk import WorkspaceClient

import landing
import theme

WAREHOUSE = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
GENIE_SPACE = os.environ.get("GENIE_SPACE_ID", "")
T = "samples.wanderbricks"

st.set_page_config(page_title="VibeCode Travel", page_icon="🐱", layout="wide")

INK, MUTED, BRAND = "#24162D", "#7C6D82", "#45115D"
ACCENT, TEAL, CORAL = "#F5A623", "#2FB39E", "#DF3141"
PALE, LINE = "#F7EFFB", "#EADFEC"

theme.inject()


@st.cache_resource
def wc() -> WorkspaceClient:
    return WorkspaceClient()


@st.cache_data(ttl=600, show_spinner="กำลังอ่านข้อมูลจาก Databricks…")
def sql(q: str) -> pd.DataFrame:
    r = wc().statement_execution.execute_statement(
        warehouse_id=WAREHOUSE, statement=q, wait_timeout="50s")
    if not (r.manifest and r.manifest.schema and r.manifest.schema.columns):
        return pd.DataFrame()
    cols = [c.name for c in r.manifest.schema.columns]
    rows = (r.result.data_array if r.result and r.result.data_array else []) or []
    return pd.DataFrame(rows, columns=cols)


def style(fig, legend=False):
    """กราฟพื้นขาว เล่นได้จริง — ซูม/แพน/hover ไม่ใช่ภาพนิ่ง

    ต้นเหตุคือผมปิด displayModeBar ไว้ และไม่ได้ตั้งกล่อง hover
    """
    fig.update_layout(
        template="plotly_white",
        paper_bgcolor="white", plot_bgcolor="white",
        font=dict(family="Sarabun, Plus Jakarta Sans, sans-serif", color=INK, size=13),
        margin=dict(l=10, r=10, t=10, b=10), height=340, showlegend=legend,
        hovermode="x unified",
        hoverlabel=dict(bgcolor="white", bordercolor=LINE, font_size=13,
                        font_family="Sarabun, sans-serif"),
        dragmode="pan")
    return fig


# ปุ่มบนแถบเครื่องมือกราฟ — เอาเฉพาะที่ใช้จริง ตัดปุ่มที่กดแล้วงง
PLOT_CFG = {"displaylogo": False, "scrollZoom": True,
            "modeBarButtonsToRemove": ["select2d", "lasso2d", "autoScale2d",
                                       "toggleSpikelines"],
            "toImageButtonOptions": {"filename": "wanderbricks"}}


def kcard(col, icon, bg, label, value, note):
    col.markdown(
        f'<div class="kcard"><div class="kicon" style="--kb:{bg}">{icon}</div>'
        f'<div class="klabel">{label}</div><div class="knum">{value}</div>'
        f'<div class="knote">{note}</div></div>', unsafe_allow_html=True)


if not WAREHOUSE:
    st.error("ยังไม่ได้ผูก SQL warehouse — เช็กว่า app.yaml มี valueFrom: sql-warehouse "
             "และหน้า App ผูก Resource ชนิด SQL warehouse ให้สิทธิ์ Can use แล้ว")
    st.stop()

# ── หน้าร้านมาก่อน · เข้าแดชบอร์ดด้วย ?view=analytics ─────────────────────
if st.query_params.get("view") != "analytics":
    landing.render(sql, T, (BRAND, ACCENT, TEAL, MUTED, LINE))
    st.stop()

# ── sidebar (ตาม mockup ของ GPT) ──────────────────────────────────────────
# เมืองที่ถูกส่งมาจากปุ่มลูกศรบนการ์ดหน้าร้าน — ต้องกรองจริง ไม่ใช่แค่โชว์
CITY = (st.query_params.get("city") or "").strip().replace("'", "")

with st.sidebar:
    st.markdown('<div class="sb-brand"><span class="sb-dot">🐱</span>'
                '<span class="sb-name">VIBECODE TRAVEL'
                '<em>WANDERBRICKS</em></span></div>', unsafe_allow_html=True)
    st.divider()
    # ── ตัวกรองที่ทำงานจริง ไม่ใช่เมนูภาพนิ่ง ─────────────────────────────
    # เปลี่ยนเป็นสองตัวกรองที่ส่งค่าเข้า WHERE ของทุก query บนหน้านี้จริง ๆ
    # ใช้ชิป radio ไม่ใช่ selectbox — selectbox ของ Streamlit ใน sidebar พื้นม่วง
    # เรนเดอร์ออกมาเป็นกล่องเปล่า ไม่มีข้อความข้างใน (ตรวจจาก DOM จริงแล้ว)
    yr = sql(f"SELECT DISTINCT YEAR(check_in) AS y FROM {T}.bookings "
             "WHERE check_in IS NOT NULL ORDER BY y DESC")
    years = [int(v) for v in yr["y"]] if not yr.empty else [2025]
    st.markdown('<div class="sb-lab">ปี</div>', unsafe_allow_html=True)
    YEAR = st.radio("ปี", years, horizontal=True, label_visibility="collapsed")

    REG = {"ทั้งหมด": None, "เอเชีย": "asia", "ยุโรป": "europe",
           "โอเชียเนีย": "oceania", "อเมริกา": "americas"}
    st.markdown('<div class="sb-lab">ภูมิภาค</div>', unsafe_allow_html=True)
    reg_label = st.radio("ภูมิภาค", list(REG), label_visibility="collapsed")
    REGION = REG[reg_label]

    if st.button("โหลดข้อมูลใหม่", use_container_width=True):
        st.cache_data.clear()
        st.rerun()
    st.divider()
    st.markdown('<div class="sb-foot">● แหล่งข้อมูล samples.wanderbricks<br>'
                'ตัวเลขทุกช่องคำนวณตามตัวกรองด้านบน</div>', unsafe_allow_html=True)
    if CITY:
        st.info(f"กำลังดูเฉพาะ {CITY}")
        st.markdown('<a class="back" href="?view=analytics" target="_self">'
                    'ล้างตัวกรองเมือง</a>', unsafe_allow_html=True)
    st.markdown('<a class="back" href="?" target="_self">← กลับหน้าแรก</a>',
                unsafe_allow_html=True)

# ตัวกรองภูมิภาคใช้ตารางเมือง จึงต้อง join ก่อน — หน้าที่ไม่กรองก็ใช้ WHERE เดียวกันได้
REGION_CASE = """CASE
    WHEN d.country IN ('Japan','China','Singapore','Thailand','India',
                       'United Arab Emirates') THEN 'asia'
    WHEN d.country IN ('France','Italy','Spain','Germany','Austria',
                       'Greece','Switzerland','United Kingdom') THEN 'europe'
    WHEN d.country IN ('Australia') THEN 'oceania'
    ELSE 'americas' END"""
RFILTER = "" if REGION is None else f" AND {REGION_CASE} = '{REGION}'"

if CITY:
    RFILTER += f" AND d.destination = '{CITY}'"

BASE = (f"FROM {T}.bookings b "
        f"JOIN {T}.properties   p ON b.property_id    = p.property_id "
        f"JOIN {T}.destinations d ON p.destination_id = d.destination_id "
        f"WHERE YEAR(b.check_in) = {YEAR}{RFILTER}")

k = sql(f"""
    SELECT ROUND(SUM(CASE WHEN b.status IN ('confirmed','completed')
                          THEN b.total_amount ELSE 0 END)) AS revenue,
           COUNT(*)                                         AS bookings,
           ROUND(AVG(CASE WHEN b.status = 'cancelled' THEN 1.0 ELSE 0 END) * 100, 1)
                                                            AS cancel_pct
    {BASE}""")
rq = sql(f"""
    SELECT ROUND(AVG(rv.rating), 2) AS rating
    FROM {T}.reviews rv
    JOIN {T}.bookings b     ON rv.booking_id   = b.booking_id
    JOIN {T}.properties   p ON b.property_id   = p.property_id
    JOIN {T}.destinations d ON p.destination_id = d.destination_id
    WHERE rv.is_deleted = false AND YEAR(b.check_in) = {YEAR}{RFILTER}""")
if k.empty or int(k.bookings[0]) == 0:
    st.warning(f"ปี {YEAR} · {reg_label} ไม่มีการจองในชุดข้อมูลนี้ "
               "ลองเปลี่ยนตัวกรองด้านซ้าย")
    st.stop()

st.markdown(f"""<div class="hero-card"><span class="spark sp1">\u2726</span>
<div class="hero-copy">
  <div class="eyebrow">VIBECODE TRAVEL \u00b7 WANDERBRICKS</div>
  <h1>ปีนี้คนเที่ยว<br><span>กันแบบไหน</span></h1>
  <p>สรุปภาพรวมธุรกิจท่องเที่ยว ปี {YEAR} — รายได้ การจอง การยกเลิก และคะแนนรีวิว
     คิดจากข้อมูลจริงทุกตัว</p>
  <div class="chips"><span class="chip">\u25a3 ข้อมูลปี {YEAR}</span>
    <span class="chip">\u25ce {CITY or reg_label}</span>
    <span class="chip">\u21bb นับเฉพาะที่ยืนยันแล้วกับเดินทางจบ</span></div>
</div>
<div class="hero-side"><div class="passport">
  <img class="cat" src="data:image/png;base64,{theme.CAT}" alt="">
  <div class="pp-k">TRAVEL PULSE</div>
  <div class="pp-t">ภาพรวมปี {YEAR}</div>
  <div class="pp-grid">
    <div class="mini-stat"><b>{int(k.bookings[0]):,}</b><span>BOOKINGS</span></div>
    <div class="mini-stat"><b>{float(k.cancel_pct[0])}%</b><span>CANCEL RATE</span></div>
  </div>
</div></div></div>""", unsafe_allow_html=True)

tab_charts, tab_chat, tab_ai = st.tabs(["📊 Charts", "💬 Chat", "🤖 AI Insights"])

# ── 📊 Charts ────────────────────────────────────────────────────────────────
with tab_charts:
    c1, c2, c3, c4 = st.columns(4)
    kcard(c1, "💰", "#F3E9FA", "รายได้รวมทั้งปี",
          f"{float(k.revenue[0]):,.0f}", "ดอลลาร์ · นับเฉพาะ confirmed / completed")
    kcard(c2, "🗓️", "#E8F1FB", "จำนวนการจอง",
          f"{int(k.bookings[0]):,}", f"รายการทั้งหมดในปี {YEAR}")
    kcard(c3, "⊘", "#FDE8EA", "อัตราการยกเลิก",
          f"{float(k.cancel_pct[0])}%", "cancelled หารด้วยการจองทั้งหมด")
    kcard(c4, "★", "#FEF4E0", "คะแนนรีวิวเฉลี่ย",
          f"{float(rq.rating[0]) if not rq.empty else 0}", "จาก 5.00 · ต่อรีวิวทุกแถว")

    left, right = st.columns(2)
    with left:
        st.markdown('<div class="panel"><h3>แนวโน้มรายเดือน</h3></div>',
                    unsafe_allow_html=True)
        METRIC = {"รายได้": ("SUM(CASE WHEN b.status IN ('confirmed','completed') "
                             "THEN b.total_amount ELSE 0 END)", "ดอลลาร์"),
                  "จำนวนการจอง": ("COUNT(*)", "รายการ"),
                  "จำนวนที่ยกเลิก": ("SUM(CASE WHEN b.status = 'cancelled' "
                                     "THEN 1 ELSE 0 END)", "รายการ")}
        mk = st.radio("ดูอะไร", list(METRIC), horizontal=True,
                      label_visibility="collapsed", key="mk")
        expr, unit = METRIC[mk]
        m = sql(f"""
            SELECT DATE_FORMAT(b.check_in, 'yyyy-MM') AS month,
                   ROUND({expr}) AS revenue
            {BASE}
            GROUP BY 1 ORDER BY 1""")
        if not m.empty:
            m["revenue"] = m["revenue"].astype(float)
            f = px.area(m, x="month", y="revenue", markers=True)
            f.update_traces(
                line_color=BRAND, fillcolor="rgba(106,60,160,.16)",
                marker=dict(size=9, color=BRAND, line=dict(color="#fff", width=2)),
                hovertemplate="เดือน %{x}<br>" + mk + " %{y:,.0f} " + unit +
                              "<extra></extra>")
            f.update_layout(xaxis_title="", yaxis_title=mk,
                            xaxis=dict(rangeslider=dict(visible=True, thickness=.10)))
            st.plotly_chart(style(f), use_container_width=True, config=PLOT_CFG)
            st.caption("ลากบนกราฟเพื่อเลื่อน · หมุนล้อเพื่อซูม · "
                       "ลากแถบด้านล่างเพื่อเลือกช่วงเดือน")
    with right:
        st.markdown('<div class="panel"><h3>10 เมืองที่สร้างรายได้สูงสุด</h3></div>',
                    unsafe_allow_html=True)
        city = sql(f"""
            SELECT d.destination AS city,
                   ROUND(SUM(CASE WHEN b.status IN ('confirmed','completed')
                                  THEN b.total_amount ELSE 0 END)) AS revenue
            {BASE}
            GROUP BY 1 ORDER BY revenue DESC LIMIT 10""")
        if not city.empty:
            city["revenue"] = city["revenue"].astype(float)
            f = px.bar(city.sort_values("revenue"), x="revenue", y="city",
                       orientation="h", color="revenue",
                       color_continuous_scale=["#DBC9E5", BRAND])
            f.update_traces(
                hovertemplate="%{y}<br>รายได้ %{x:,.0f} ดอลลาร์<extra></extra>",
                marker_line_width=0)
            f.update_layout(coloraxis_showscale=False,
                            xaxis_title="รายได้", yaxis_title="",
                            hovermode="y unified")
            st.plotly_chart(style(f), use_container_width=True, config=PLOT_CFG)
            st.caption("เอาเมาส์ไปวางบนแท่งเพื่อดูตัวเลขเต็ม")

    a, b = st.columns([1.7, 1])
    with a:
        st.markdown('<div class="panel"><h3>อันดับเมืองยอดนิยม</h3></div>',
                    unsafe_allow_html=True)
        rank = sql(f"""
            SELECT d.destination AS city, d.country,
                   COUNT(*)                 AS bookings,
                   ROUND(AVG(rv.rating), 2) AS rating
            FROM {T}.bookings b
            JOIN {T}.properties   p ON b.property_id    = p.property_id
            JOIN {T}.destinations d ON p.destination_id = d.destination_id
            LEFT JOIN (SELECT booking_id, AVG(rating) AS rating FROM {T}.reviews
                       WHERE is_deleted = false GROUP BY booking_id) rv
                   ON rv.booking_id = b.booking_id
            WHERE YEAR(b.check_in) = {YEAR}{RFILTER}
            GROUP BY 1, 2 ORDER BY bookings DESC LIMIT 10""")
        if not rank.empty:
            rank["bookings"] = rank["bookings"].astype(int)
            st.dataframe(rank, use_container_width=True, hide_index=True,
                         column_config={"city": "เมือง", "country": "ประเทศ",
                                        "bookings": "จำนวนการจอง",
                                        "rating": "คะแนนเฉลี่ย"})
    with b:
        st.markdown('<div class="panel"><h3>✦ อยากรู้ข้อมูลเชิงลึกเพิ่ม</h3>'
                    '<p style="font-size:13px;color:#75687b;margin:0">'
                    'ไปที่แท็บ Chat ถามเป็นภาษาไทยได้เลย '
                    'หรือแท็บ AI Insights ให้ AI อ่านรีวิวให้</p></div>',
                    unsafe_allow_html=True)
        st.caption("คะแนนรีวิวคิดเป็นค่าเฉลี่ยต่อการจอง เพราะหนึ่งการจองรีวิวได้หลายครั้ง")

# ── 💬 Chat ──────────────────────────────────────────────────────────────────
with tab_chat:
    st.markdown('<div class="sec2">ถามอะไร <span>ก็ได้เป็นภาษาไทย</span></div>', unsafe_allow_html=True)
    if not GENIE_SPACE:
        st.warning("ยังไม่ได้ผูก Genie Agent — เพิ่ม Resource ชนิด Genie space "
                   "แล้วให้สิทธิ์ Can run ก่อน")
    else:
        st.caption("ลองถาม: เมืองไหนรายได้เยอะสุด 5 อันดับ · เดือนไหนคนจองเยอะที่สุด")
        if "chat" not in st.session_state:
            st.session_state.chat = []
            st.session_state.conv = None
        for role, text in st.session_state.chat:
            st.chat_message(role).markdown(text)

        q = st.chat_input("พิมพ์คำถามเป็นภาษาไทยได้เลย")
        if q:
            st.session_state.chat.append(("user", q))
            st.chat_message("user").markdown(q)
            with st.chat_message("assistant"), st.spinner("Genie กำลังคิด…"):
                g = wc().genie
                if st.session_state.conv:
                    msg = g.create_message_and_wait(
                        GENIE_SPACE, st.session_state.conv, q)
                else:
                    msg = g.start_conversation_and_wait(GENIE_SPACE, q)
                    st.session_state.conv = msg.conversation_id
                out = []
                for att in (msg.attachments or []):
                    if att.text and att.text.content:
                        out.append(att.text.content)
                    if att.query and att.query.description:
                        out.append(att.query.description)
                ans = "\n\n".join(out) or "ตอบไม่ได้ ลองถามใหม่ให้เจาะจงกว่านี้"
                st.session_state.chat.append(("assistant", ans))
            # ต้นเหตุ: รอบที่กด Enter เราวาดประวัติ → ช่องพิมพ์ → แล้วค่อยวาดข้อความใหม่
            # ข้อความใหม่เลยไปโผล่ใต้ช่องพิมพ์ ดูเหมือนช่องพิมพ์ลอยอยู่กลางหน้า
            # rerun หนึ่งรอบ ทุกข้อความจะถูกวาดใหม่เหนือช่องพิมพ์ตามมาตรฐาน
            st.rerun()


# ── 🤖 AI Insights ───────────────────────────────────────────────────────────
with tab_ai:
    st.markdown('<div class="sec2">รีวิวที่ได้มา <span>คนชอบหรือไม่ชอบ</span></div>',
                unsafe_allow_html=True)
    st.caption("ให้ AI อ่านรีวิวจากลูกค้าจริง แล้วบอกว่าโดยรวมคนชอบหรือไม่ชอบ")
    n = st.radio("จะให้อ่านกี่รีวิว", [10, 20, 40], index=1, horizontal=True)
    if st.button("อ่านรีวิวให้หน่อย", type="primary"):
        # ดึงทั้งข้อความและผลมาด้วยกัน เรียกโมเดลรอบเดียว
        # แล้วค่อยนับสัดส่วนฝั่ง pandas — ไม่ต้อง GROUP BY ผลที่ไม่ deterministic
        rv = sql(f"""
            SELECT comment, ai_analyze_sentiment(comment) AS sentiment
            FROM (SELECT comment FROM {T}.reviews
                  WHERE is_deleted = false AND comment IS NOT NULL
                    AND length(comment) > 40
                  LIMIT {n})""")
        if rv.empty:
            st.info("ยังไม่มีรีวิวที่ยาวพอให้ AI อ่าน ลองเพิ่มจำนวนดู")
        else:
            TH = {"positive": "เชิงบวก", "negative": "เชิงลบ",
                  "neutral": "กลาง ๆ", "mixed": "มีทั้งบวกและลบ"}
            COL = {"positive": TEAL, "negative": CORAL,
                   "neutral": "#8B7BA8", "mixed": ACCENT}
            rv["sentiment"] = rv["sentiment"].fillna("neutral")
            cnt = rv["sentiment"].value_counts().reset_index()
            cnt.columns = ["sentiment", "n"]
            cnt["ผล"] = cnt["sentiment"].map(lambda x: TH.get(x, x))

            left, right = st.columns([1, 1])
            with left:
                f = px.pie(cnt, names="ผล", values="n", hole=0.55,
                           color="sentiment",
                           color_discrete_map=COL)
                f.update_traces(textinfo="percent",
                                marker=dict(line=dict(color="#fff", width=2)))
                st.plotly_chart(style(f, legend=True), use_container_width=True)
            with right:
                for _, r in cnt.iterrows():
                    c = COL.get(r.sentiment, MUTED)
                    st.markdown(
                        f'<div class="kcard" style="border-left:4px solid {c}">'
                        f'<div class="klabel">{r["ผล"]}</div>'
                        f'<div class="knum" style="color:{c}">{int(r.n)}</div>'
                        f'<div class="knote">รีวิว</div></div>',
                        unsafe_allow_html=True)

            st.markdown('<div class="sec2">AI อ่านแล้ว <span>ตัดสินว่ายังไง</span></div>',
                        unsafe_allow_html=True)
            st.caption("รีวิวจริงจากลูกค้า พร้อมผลที่ AI ให้ อ่านเทียบเองได้")
            for _, r in rv.head(12).iterrows():
                sent = r["sentiment"]
                st.markdown(
                    f'<div class="rv" style="--c:{COL.get(sent, MUTED)}">'
                    f'<div class="tag">{TH.get(sent, sent)}</div>'
                    f'<div class="txt">{H.escape(str(r["comment"])[:300])}</div></div>',
                    unsafe_allow_html=True)
            st.caption("AI อาจให้ผลต่างกันเล็กน้อยถ้ากดอ่านใหม่")
