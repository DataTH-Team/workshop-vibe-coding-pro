# -*- coding: utf-8 -*-
"""ข้อมูลประกอบหน้าเว็บ — import ไปใช้ได้เลย

CITY_IMG   dict ชื่อเมือง -> URL รูปจาก Wikimedia Commons
BLURB_TH   dict ชื่อเมือง -> คำโปรยภาษาไทย
img_url(city)    คืน URL รูปของเมืองนั้น
blurb_th(city)   คืนคำโปรยภาษาไทยของเมืองนั้น

ทำไมต้องมีไฟล์นี้
  รูปเมือง  URL รูปเดาไม่ได้ ต้องเป็นของจริงจากบทความของเมืองนั้น
  คำโปรย    คอลัมน์ description ในตารางเป็นภาษาอังกฤษ
            แปลไว้ล่วงหน้าแล้ว จะได้ไม่ต้องเรียก ai_translate ทุกครั้งที่เปิดหน้า
"""

_W = "https://upload.wikimedia.org/wikipedia/commons/thumb"
CITY_IMG = {
    "Phuket":        f"{_W}/6/60/Phuket_Aerial.jpg/1280px-Phuket_Aerial.jpg",
    "Gold Coast":    f"{_W}/a/aa/Gold_Coast_skyline_%28Unsplash%29.jpg/1280px-Gold_Coast_skyline_%28Unsplash%29.jpg",
    "Mallorca":      f"{_W}/e/e7/Kathedrale_von_Palma.jpg/1280px-Kathedrale_von_Palma.jpg",
    "Paris":         f"{_W}/4/4b/La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg/1280px-La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg",
    "Abu Dhabi":     f"{_W}/9/9c/Abu_dhabi_skylines_2014.jpg/1280px-Abu_dhabi_skylines_2014.jpg",
    "Tokyo":         "https://upload.wikimedia.org/wikipedia/commons/b/b2/Skyscrapers_of_Shinjuku_2009_January.jpg",
    "Osaka":         "https://upload.wikimedia.org/wikipedia/commons/c/ca/Osaka_Castle_03bs3200.jpg",
    "Singapore":     f"{_W}/c/c7/Marina_Bay_Sands_%28I%29.jpg/1280px-Marina_Bay_Sands_%28I%29.jpg",
    "Dubai":         "https://upload.wikimedia.org/wikipedia/en/thumb/c/c7/Burj_Khalifa_2021.jpg/1280px-Burj_Khalifa_2021.jpg",
    "New York":      f"{_W}/7/7a/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg/1280px-View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg",
    "Barcelona":     f"{_W}/a/a6/Evening_light_over_Barcelona.jpg/1280px-Evening_light_over_Barcelona.jpg",
    "San Francisco": f"{_W}/9/9f/Zeppelin-ride-020100925-195_%285029394846%29.jpg/1280px-Zeppelin-ride-020100925-195_%285029394846%29.jpg",
}
# ภาพกลางสำหรับเมืองที่ไม่ได้อยู่ในลิสต์ — ไม่ใช่รูปเมืองไหนเลย จึงไม่มีทางผิดเมือง
FALLBACK = ("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
            "?auto=format&fit=crop&w=1280&q=80")


def img_url(city: str) -> str:
    return CITY_IMG.get(city, FALLBACK)


BLURB_TH = {
    "Phuket":        "สวรรค์เขตร้อน หาดสวย น้ำใส และวัฒนธรรมที่มีชีวิตชีวา",
    "Gold Coast":    "ชายหาดอาบแดด สวนสนุก และความตื่นเต้นแบบไม่มีวันหมด",
    "Mallorca":      "เกาะเมดิเตอร์เรเนียนที่มีทั้งวัฒนธรรมเก่าแก่และวิวสวยทุกมุม",
    "Paris":         "เมืองแห่งความรักและแสงไฟ เสน่ห์ที่ไม่เคยเก่า",
    "Abu Dhabi":     "ความหรูหราใต้ฟ้าสีทอง กับความน่าทึ่งที่ไม่รู้จบ",
    "Tokyo":         "เมืองไฟนีออนที่เก่ากับใหม่อยู่ด้วยกันอย่างลงตัว",
    "Osaka":         "เมืองสายกินที่คึกคัก มีเสน่ห์ไม่เหมือนใคร",
    "Singapore":     "เมืองแห่งความต่างที่มาอยู่รวมกันได้อย่างกลมกล่อม",
    "Dubai":         "ความหรูหราและนวัตกรรมระดับที่หาที่ไหนไม่ได้",
    "New York":      "เมืองที่มีทั้งแลนด์มาร์ก อาหาร และผู้คนหลากหลายที่สุด",
    "Barcelona":     "ประวัติศาสตร์ยาวนาน งานสถาปัตยกรรมสะดุดตา และเมืองที่มีชีวิต",
    "San Francisco": "อ่าวสวย เนินชัน กับวัฒนธรรมและธรรมชาติที่อยู่ใกล้กัน",
    "Berlin":        "เมืองที่ประวัติศาสตร์ลึก และยังเปิดกว้างให้อะไรใหม่ ๆ เสมอ",
    "Madrid":        "เมืองหลวงสเปนที่ของเก่ากับของใหม่อยู่ข้างกันได้สนิท",
    "Krabi":         "ธรรมชาติงดงามแบบหน้าผาหินปูน กับกิจกรรมกลางแจ้งเพียบ",
    "Bali":          "วัดริมหน้าผา นาขั้นบันได และจังหวะชีวิตที่ช้าลง",
    "Bangkok":       "วัด ตลาด และสตรีทฟู้ดที่หากินได้ทั้งวันทั้งคืน",
    "Sydney":        "อ่าวเมืองสวย โอเปร่าเฮาส์ และหาดที่นั่งเล่นได้ทั้งวัน",
    "Rome":          "เดินไปทางไหนก็เจอโบราณสถาน อาหารดี กาแฟดี",
    "London":        "พิพิธภัณฑ์เข้าฟรี ตลาดนัดสุดสัปดาห์ และผับเก่าแก่",
}


def blurb_th(city, country, bookings):
    """คำโปรยไทยของเมือง — ถ้ายังไม่ได้แปลไว้ ประกอบจากข้อมูลจริงแทน

    ไม่คืนข้อความอังกฤษจาก dataset กลับไปแสดงบนหน้าเว็บเด็ดขาด
    """
    t = BLURB_TH.get(city)
    if t:
        return t
    return "เมืองยอดนิยมของ%s ปี 2025 มีคนจองผ่านเรา %s ครั้ง" % (
        country, format(int(bookings), ","))
