# -*- coding: utf-8 -*-
"""Wanderbricks Data App — หน้าร้าน

โครง  topbar → hero 2 คอลัมน์ → แถวสถิติ → ฟิลเตอร์ภูมิภาค
      → การ์ดเมือง 3 คอลัมน์ → แบนเนอร์ปิด
กดการ์ดเมืองแล้วไปหน้าแดชบอร์ดที่ ?view=analytics&city=ชื่อเมือง
ทุกตัวเลขและทุกการ์ดมาจาก query ไม่มีข้อมูลปลอม
"""
import html as H
from urllib.parse import quote

import streamlit as st

import theme
from assets import BLURB_TH, CITY_IMG, blurb_th, img_url  # noqa: F401

REGIONS = [("all", "ทั้งหมด"), ("asia", "เอเชีย"), ("europe", "ยุโรป"),
           ("oceania", "โอเชียเนีย"), ("americas", "อเมริกา · อื่น ๆ")]

REGION_SQL = """CASE
    WHEN d.country IN ('Japan','China','Singapore','Thailand','India',
                       'United Arab Emirates') THEN 'asia'
    WHEN d.country IN ('France','Italy','Spain','Germany','Austria',
                       'Greece','Switzerland','United Kingdom') THEN 'europe'
    WHEN d.country IN ('Australia') THEN 'oceania'
    ELSE 'americas' END"""


def render(sql, T, css_vars):
    """วาดหน้าร้านทั้งหน้า — sql() กับชื่อ schema ส่งมาจาก app.py"""
    st.markdown(
        '<div class="topbar"><div class="brand"><span class="brand-dot">V</span>'
        ' VIBECODE TRAVEL</div><div class="navlinks"><span class="on">หน้าแรก</span>'
        '<span>เมืองยอดนิยม</span><span>Analytics</span><span>Ask Data</span>'
        '</div></div>', unsafe_allow_html=True)

    head = sql(f"""
        SELECT COUNT(DISTINCT d.destination) AS cities,
               COUNT(DISTINCT d.country)     AS countries,
               COUNT(*)                      AS bookings,
               ROUND(AVG(r.rating), 2)       AS rating
        FROM {T}.bookings b
        JOIN {T}.properties   p ON b.property_id    = p.property_id
        JOIN {T}.destinations d ON p.destination_id = d.destination_id
        LEFT JOIN (SELECT booking_id, AVG(rating) AS rating FROM {T}.reviews
                   WHERE is_deleted = false GROUP BY booking_id) r
               ON r.booking_id = b.booking_id
        WHERE YEAR(b.check_in) = 2025""")
    cities_n = f"{int(head.cities[0]):,}" if not head.empty else "—"
    country_n = f"{int(head.countries[0]):,}" if not head.empty else "—"
    book_n = f"{int(head.bookings[0]):,}" if not head.empty else "—"
    rate_n = f"{float(head.rating[0])}" if not head.empty else "—"

    # แท่งใน Travel Pulse มาจากยอดจองรายเดือนจริง ไม่ใช่ความสูงสุ่ม
    mth = sql(f"""
        SELECT DATE_FORMAT(check_in, 'yyyy-MM') AS m, COUNT(*) AS n
        FROM {T}.bookings WHERE YEAR(check_in) = 2025
        GROUP BY 1 ORDER BY 1""")
    if mth.empty:
        bars = ""
    else:
        vals = [int(v) for v in mth["n"]]
        top = max(vals) or 1
        bars = "".join(
            '<div class="bar" style="height:%d%%"></div>' % max(14, round(v / top * 100))
            for v in vals)

    st.markdown(f"""<div class="hero-card"><span class="spark sp1">\u2726</span>
<span class="spark sp2">\u2726</span>
<div class="hero-copy">
  <div class="eyebrow">WANDERBRICKS \u00b7 TRAVEL DISCOVERY</div>
  <h1>ทริปหน้า<br><span>ไปไหนดี?</span></h1>
  <p>หาไอเดียเมืองน่าเที่ยวจากข้อมูลจริง ดูเมืองยอดนิยม คะแนนรีวิว
     และแนวโน้มการจองในที่เดียว</p>
  <div class="chips"><span class="chip">\u25a3 ข้อมูลปี 2025</span>
    <span class="chip">\u25ce {country_n} ประเทศ</span>
    <span class="chip">\u21bb เรียงตามยอดจองจริง</span></div>
</div>
<div class="hero-side"><div class="passport">
  <img class="cat" src="data:image/png;base64,{theme.CAT}" alt="">
  <div class="pp-k">TRAVEL PULSE</div>
  <div class="pp-t">สรุปการเดินทาง<br>ปี 2025</div>
  <div class="pp-grid">
    <div class="mini-stat"><b>{cities_n}</b><span>DESTINATIONS</span></div>
    <div class="mini-stat"><b>{country_n}</b><span>COUNTRIES</span></div>
    <div class="mini-stat"><b>{book_n}</b><span>BOOKINGS</span></div>
    <div class="mini-stat"><b>{rate_n}</b><span>AVG RATING</span></div>
  </div>
  <div class="mini-chart">{bars}</div>
</div></div></div>""", unsafe_allow_html=True)

    st.markdown(f"""<div class="sec"><div>
  <h2>เมืองที่คนไป<span>กันเยอะที่สุดปีนี้</span></h2>
  <p>อันดับขยับเองตามยอดจอง ไม่ได้มีใครมานั่งจัดอันดับให้</p>
</div></div>""", unsafe_allow_html=True)

    pick = st.radio("ภูมิภาค", [r[1] for r in REGIONS],
                    horizontal=True, label_visibility="collapsed")
    key = dict((lab, k) for k, lab in REGIONS)[pick]
    where = "" if key == "all" else f"WHERE region = '{key}'"

    rows = sql(f"""
        SELECT * FROM (
          SELECT d.destination AS city, d.country,
                 {REGION_SQL}                        AS region,
                 COUNT(*)                            AS bookings,
                 ROUND(AVG(rv.rating), 2)            AS rating
          FROM {T}.bookings b
          JOIN {T}.properties   p ON b.property_id    = p.property_id
          JOIN {T}.destinations d ON p.destination_id = d.destination_id
          LEFT JOIN (SELECT booking_id, AVG(rating) AS rating FROM {T}.reviews
                     WHERE is_deleted = false GROUP BY booking_id) rv
                 ON rv.booking_id = b.booking_id
          WHERE YEAR(b.check_in) = 2025
          GROUP BY d.destination, d.country, {REGION_SQL})
        {where}
        ORDER BY bookings DESC LIMIT 9""")
    if rows.empty:
        st.info("ภูมิภาคนี้ยังไม่มีทริปในปีนี้ ลองเลือกภูมิภาคอื่นดูนะ")
        return

    recs = rows.to_dict("records")
    for i in range(0, len(recs), 3):
        for col, r in zip(st.columns(3), recs[i:i + 3]):
            rank = recs.index(r) + 1
            col.markdown(f"""<div class="card">
  <div class="card-media" style="background-image:url('{img_url(r['city'])}')">
    <span class="badge">\u2605 อันดับ {rank}</span></div>
  <div class="card-body">
    <div class="card-kicker">{H.escape(str(r['country']))}</div>
    <div class="cityrow"><div class="city">{H.escape(str(r['city']))}</div>
      <div class="rating">\u2605 {r['rating']}</div></div>
    <p class="desc">{H.escape(blurb_th(r['city'], r['country'], r['bookings']))}</p>
    <div class="meta"><span>จองแล้ว <b>{int(r['bookings']):,}</b> ครั้ง</span>
      <a class="arrow" target="_self"
         href="?view=analytics&city={quote(str(r['city']))}">\u2192</a></div>
  </div></div>""", unsafe_allow_html=True)

    st.markdown("""<div class="banner"><div>
  <h3>อยากดูภาพรวมทั้งหมดก่อนตัดสินใจ</h3>
  <p>ช่วงไหนคนเที่ยวเยอะ เมืองไหนคะแนนดี หรือถามเป็นภาษาไทยก็ได้</p>
</div><a class="btn btn-primary" href="?view=analytics" target="_self">
  ดูภาพรวมการเดินทาง \u2192</a></div>""", unsafe_allow_html=True)
