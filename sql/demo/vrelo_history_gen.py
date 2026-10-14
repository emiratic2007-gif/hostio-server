import json, random, datetime as dt
from zoneinfo import ZoneInfo
random.seed(7)
TZ = ZoneInfo("Europe/Sarajevo")
F = json.load(open('vrelo_fixture.json'))
cars = F['cars']; S = F['biz']['settings']
locfee = {l['id']: l['fee'] for l in S['locations']}
people = [
 ("Amar","Hodžić","bs","+387 61 555 014"),("Lejla","Kovačević","bs","+387 62 555 027"),("Jonas","Weber","de","+49 151 5550 1832"),
 ("Sarah","Mitchell","en","+44 7700 900461"),("Faisal","Al Harbi","ar","+966 55 555 0193"),("Noura","Al Mansouri","ar","+971 50 555 0172"),
 ("Marko","Petrović","bs","+381 64 555 0148"),("Emina","Delić","bs","+387 63 555 041"),("Lukas","Schneider","de","+49 160 5550 2291"),
 ("Hamza","Begović","bs","+387 61 555 098"),("Olivia","Brown","en","+1 202 555 0147"),("Khalid","Al Qahtani","ar","+966 50 555 0128"),
 ("Selma","Mehić","bs","+387 62 555 063"),("Anna","Fischer","de","+43 664 555 0187"),
]
def email(p): return (p[0]+"."+p[1]).lower().replace(" ","").replace("ć","c").replace("č","c").replace("ž","z").replace("š","s").replace("đ","d")+"@example.com"
def dayprice(tiers, d):
    p = tiers[0]['cijena']
    for t in sorted(tiers, key=lambda x: x['od']):
        if d >= t['od']: p = t['cijena']
    return p
today = dt.date(2026,10,14)
rows = []
def add(car, start_d, start_h, days, ret_h, status, src, person, pu, dr, extras=(), note=None, owner_note=None, created_days_before=3):
    s = dt.datetime.combine(start_d, dt.time(start_h, 0), TZ); e = dt.datetime.combine(start_d + dt.timedelta(days=days), dt.time(ret_h, 0), TZ)
    ndays = max(1, -(-int((e - s).total_seconds() - 59*60) // 86400))
    per = dayprice(car['price_tiers'], ndays)
    lines = [{"key":"najam","days":ndays,"perDay":per,"total":per*ndays}]
    ex = {x['id']: x for x in S['extras']}
    for x in extras:
        t = ex[x]['price']*(ndays if ex[x]['per']=='dan' else 1); t = min(t, ex[x].get('max', t)); lines.append({"key":"dodatak","id":x,"total":t})
    if locfee[pu]: lines.append({"key":"preuzimanje","id":pu,"total":locfee[pu]})
    if locfee[dr]: lines.append({"key":"vracanje","id":dr,"total":locfee[dr]})
    total = sum(l['total'] for l in lines)
    created = s - dt.timedelta(days=created_days_before, hours=random.randint(1,20))
    r = dict(vehicle_id=car['id'], start_at=s.isoformat(), end_at=e.isoformat(), status=status, source=src, pickup_location=pu, dropoff_location=dr,
             extras=list(extras), days=ndays, price_total=total, price_breakdown=lines, deposit=car['deposit'], created_at=created.isoformat(), note=note, owner_note=owner_note)
    if person:
        r.update(first_name=person[0], last_name=person[1], email=email(person), phone=person[3], lang=person[2],
                 birth_date=f"{random.randint(1965,2001)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}", license_number=f"DEMO{random.randint(100000,999999)}")
    if status in ("odobreno","odbijeno","otkazano","blokirano"): r['decided_at'] = (created + dt.timedelta(hours=random.randint(1,6))).isoformat()
    rows.append(r)
P = people
# per vehicle: past rentals (back-to-back, no overlaps), then a few future ones
plan = {
 0: [(-112,4,"odobreno"),(-96,7,"odobreno"),(-71,3,"odobreno"),(-49,5,"odobreno"),(-30,2,"odobreno"),(-12,4,"odobreno"),(5,3,"odobreno")],
 1: [(-105,10,"odobreno"),(-80,6,"odobreno"),(-60,4,"odbijeno"),(-41,8,"odobreno"),(-20,3,"odobreno"),(-6,5,"odobreno"),(9,6,"na_cekanju")],
 2: [(-118,5,"odobreno"),(-99,9,"odobreno"),(-77,4,"odobreno"),(-58,12,"odobreno"),(-33,6,"odobreno"),(-15,4,"odobreno"),(-3,5,"odobreno"),(3,4,"odobreno"),(12,7,"na_cekanju")],
 3: [(-90,14,"odobreno"),(-62,7,"odobreno"),(-37,5,"otkazano"),(-25,9,"odobreno"),(-8,6,"odobreno"),(7,10,"odobreno")],
 4: [(-101,3,"odobreno"),(-84,5,"odobreno"),(-66,6,"odobreno"),(-44,4,"odobreno"),(-26,3,"odobreno"),(-10,7,"odobreno"),(2,4,"na_cekanju")],
 5: [(-95,6,"odobreno"),(-70,8,"odobreno"),(-47,5,"odobreno"),(-28,4,"odobreno"),(-9,6,"odobreno"),(4,3,"blokirano")],
 6: [(-110,7,"odobreno"),(-86,12,"odobreno"),(-55,9,"odobreno"),(-34,7,"odobreno"),(-14,10,"odobreno"),(1,6,"odobreno"),(15,8,"odobreno")],
 7: [(-100,5,"odobreno"),(-74,4,"odobreno"),(-52,7,"odobreno"),(-31,3,"otkazano"),(-18,6,"odobreno"),(-2,4,"odobreno"),(10,5,"odobreno")],
}
srcs = ["web","web","web","whatsapp","whatsapp","instagram","vlasnik"]
locs = ["centar","centar","aerodrom","aerodrom","ilidza"]
exlist = [(),(),("gps",),("sjedalica",),("osiguranje",),("vozac","gps"),("granica","osiguranje"),()]
k = 0
for ci, items in plan.items():
    car = cars[ci]
    for off, days, st in items:
        d = today + dt.timedelta(days=off)
        if ci == 0 and off == 5: d = today + dt.timedelta(days=6)   # keep clear of the real test request (14.–15.10.)
        if st == "blokirano":
            add(car, d, 8, days, 18, st, "vlasnik", None, "centar", "centar", note="Redovni servis i zamjena guma"); continue
        p = P[(k * 5 + ci) % len(P)]; k += 1
        pu = random.choice(locs); dr = pu if random.random() < .8 else "centar"
        add(car, d, random.choice([9,10,11,14,17]), days, random.choice([9,10,12,18,19]), st, random.choice(srcs), p, pu, dr,
            extras=random.choice(exlist), note=("Dolazimo letom iz Istanbula, molim čekanje na aerodromu." if pu == "aerodrom" and random.random() < .4 else None),
            owner_note=("Stalni klijent, sve uredno." if st == "odobreno" and random.random() < .15 else None))
print(len(rows))
json.dump(rows, open('rows.json','w'), ensure_ascii=False)
# overlap check per vehicle for blocking statuses (+2h buffer)
from collections import defaultdict
byv = defaultdict(list)
for r in rows:
    if r['status'] in ('na_cekanju','odobreno','blokirano'): byv[r['vehicle_id']].append((dt.datetime.fromisoformat(r['start_at']), dt.datetime.fromisoformat(r['end_at'])))
for v, lst in byv.items():
    lst.sort()
    for a, b in zip(lst, lst[1:]):
        assert b[0] >= a[1] + dt.timedelta(hours=2), (v, a, b)
print("no overlaps")
