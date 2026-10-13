-- Demo agencija "Vrelo Rent a Car" (izmišljena) s voznim parkom. Sigurno za ponovno pokretanje.
insert into businesses (slug, name, city, template, settings) values ('vrelo', 'Vrelo Rent a Car', 'Sarajevo', 'rentacar', $json$
{
  "demo": true,
  "currency": "KM",
  "brand": { "color": "#2ee6a6", "tagline": { "bs": "Auto za svaki put", "en": "A car for every journey", "de": "Ein Auto für jede Reise", "ar": "سيارة لكل رحلة" } },
  "contact": { "phone": "+387 33 000 111", "whatsapp": "38761000111", "email": "info@vrelo-demo.ba", "address": "Ferhadija 1, 71000 Sarajevo" },
  "hours": { "open": "08:00", "close": "20:00" },
  "after_hours_fee": 15,
  "min_days": 1,
  "min_age": 21,
  "license_years": 2,
  "buffer_hours": 2,
  "cancellation_hours": 48,
  "mileage": "unlimited",
  "fuel_policy": "full_to_full",
  "locations": [
    { "id": "centar", "fee": 0, "name": { "bs": "Poslovnica Centar", "en": "City Centre Office", "de": "Filiale Stadtzentrum", "ar": "مكتب وسط المدينة" }, "address": "Ferhadija 1, Sarajevo" },
    { "id": "aerodrom", "fee": 20, "name": { "bs": "Aerodrom Sarajevo", "en": "Sarajevo Airport", "de": "Flughafen Sarajevo", "ar": "مطار سراييفو" }, "address": "Kurta Šorka 24, Sarajevo" },
    { "id": "ilidza", "fee": 10, "name": { "bs": "Ilidža (hoteli)", "en": "Ilidža (hotels)", "de": "Ilidža (Hotels)", "ar": "إليجا (الفنادق)" }, "address": "Ilidža, Sarajevo" }
  ],
  "extras": [
    { "id": "sjedalica", "per": "dan", "price": 5, "max": 35, "name": { "bs": "Dječija sjedalica", "en": "Child seat", "de": "Kindersitz", "ar": "مقعد أطفال" } },
    { "id": "vozac", "per": "dan", "price": 5, "max": 35, "name": { "bs": "Dodatni vozač", "en": "Additional driver", "de": "Zusätzlicher Fahrer", "ar": "سائق إضافي" } },
    { "id": "gps", "per": "dan", "price": 3, "max": 21, "name": { "bs": "GPS navigacija", "en": "GPS navigation", "de": "GPS-Navigation", "ar": "نظام ملاحة GPS" } },
    { "id": "osiguranje", "per": "dan", "price": 10, "max": 140, "name": { "bs": "Puno osiguranje (bez učešća)", "en": "Full insurance (no excess)", "de": "Vollkasko (ohne Selbstbeteiligung)", "ar": "تأمين شامل (بدون تحمل)" } },
    { "id": "granica", "per": "najam", "price": 30, "name": { "bs": "Prelazak granice (zeleni karton)", "en": "Cross-border (green card)", "de": "Grenzübertritt (Grüne Karte)", "ar": "عبور الحدود (البطاقة الخضراء)" } }
  ],
  "reviews": []
}
$json$::jsonb)
on conflict (slug) do update set template = excluded.template, settings = excluded.settings, name = excluded.name, city = excluded.city;

insert into rc_vehicles (business_id, sort, featured, make, model, year, category, body, color, transmission, fuel, seats, doors, bags, consumption, engine, price_tiers, deposit, description)
select b.id, v.sort, v.featured, v.make, v.model, v.year, v.category, v.body, v.color, v.transmission, v.fuel, v.seats, v.doors, v.bags, v.consumption, v.engine, v.tiers::jsonb, v.deposit, v.descr::jsonb
from businesses b, (values
  (1, false, 'Škoda', 'Fabia', 2022, 'mali', 'hatch', '#f2f3f5', 'manual', 'benzin', 5, 5, 2, 5.2, '1.0 TSI, 95 KS',
   '[{"od":1,"cijena":45},{"od":4,"cijena":40},{"od":8,"cijena":35}]', 200,
   '{"bs":"Štedljiv gradski auto, lagan za parkiranje u Starom gradu.","en":"Economical city car, easy to park in the Old Town.","de":"Sparsamer Stadtwagen, leicht zu parken in der Altstadt.","ar":"سيارة مدينة اقتصادية وسهلة الركن في البلدة القديمة."}'),
  (2, false, 'Volkswagen', 'Polo', 2021, 'mali', 'hatch', '#b8bec7', 'manual', 'dizel', 5, 5, 2, 4.3, '1.6 TDI, 95 KS',
   '[{"od":1,"cijena":48},{"od":4,"cijena":43},{"od":8,"cijena":38}]', 200,
   '{"bs":"Pouzdan i ekonomičan dizel za grad i duža putovanja.","en":"Reliable, economical diesel for the city and longer trips.","de":"Zuverlässiger, sparsamer Diesel für Stadt und längere Fahrten.","ar":"ديزل موثوق واقتصادي للمدينة والرحلات الطويلة."}'),
  (3, true, 'Volkswagen', 'Golf 8', 2023, 'kompakt', 'hatch', '#3d4450', 'automatic', 'dizel', 5, 5, 3, 4.6, '2.0 TDI, 150 KS',
   '[{"od":1,"cijena":65},{"od":4,"cijena":58},{"od":8,"cijena":52}]', 300,
   '{"bs":"Naš najtraženiji auto: automatik, udoban i moderan, idealan za sve.","en":"Our most popular car: automatic, comfortable and modern, ideal for everything.","de":"Unser beliebtestes Auto: Automatik, komfortabel und modern, ideal für alles.","ar":"سيارتنا الأكثر طلبًا: ناقل حركة أوتوماتيكي، مريحة وحديثة ومثالية لكل شيء."}'),
  (4, false, 'Škoda', 'Octavia Karavan', 2022, 'srednji', 'karavan', '#2f5d9e', 'automatic', 'dizel', 5, 5, 5, 4.8, '2.0 TDI, 150 KS',
   '[{"od":1,"cijena":70},{"od":4,"cijena":63},{"od":8,"cijena":56}]', 300,
   '{"bs":"Ogroman prtljažnik za porodice i duga putovanja.","en":"Huge boot for families and long journeys.","de":"Riesiger Kofferraum für Familien und lange Reisen.","ar":"صندوق أمتعة واسع للعائلات والرحلات الطويلة."}'),
  (5, false, 'Toyota', 'Corolla Hybrid', 2023, 'srednji', 'sedan', '#b3262e', 'automatic', 'hibrid', 5, 4, 3, 4.1, '1.8 Hybrid, 140 KS',
   '[{"od":1,"cijena":72},{"od":4,"cijena":65},{"od":8,"cijena":58}]', 300,
   '{"bs":"Tih i izuzetno štedljiv hibrid, savršen za gradsku vožnju.","en":"Quiet and very economical hybrid, perfect for city driving.","de":"Leiser, sehr sparsamer Hybrid, perfekt für die Stadt.","ar":"هجينة هادئة واقتصادية جدًا، مثالية للقيادة في المدينة."}'),
  (6, false, 'Dacia', 'Duster 4x4', 2022, 'suv', 'suv', '#c56a2c', 'manual', 'dizel', 5, 5, 4, 5.3, '1.5 dCi 4x4, 115 KS',
   '[{"od":1,"cijena":68},{"od":4,"cijena":61},{"od":8,"cijena":55}]', 400,
   '{"bs":"Pogon na sva četiri točka za planine, Bjelašnicu i Jahorinu.","en":"Four-wheel drive for the mountains, Bjelašnica and Jahorina.","de":"Allradantrieb für die Berge, Bjelašnica und Jahorina.","ar":"دفع رباعي للجبال وبيلاشنيتسا وياهورينا."}'),
  (7, true, 'Volkswagen', 'Tiguan', 2022, 'suv', 'suv', '#1f2329', 'automatic', 'dizel', 5, 5, 5, 5.9, '2.0 TDI 4Motion, 150 KS',
   '[{"od":1,"cijena":95},{"od":4,"cijena":86},{"od":8,"cijena":78}]', 500,
   '{"bs":"Prostran i premium SUV za udobna porodična putovanja.","en":"Spacious premium SUV for comfortable family trips.","de":"Geräumiger Premium-SUV für komfortable Familienreisen.","ar":"سيارة دفع رباعي فاخرة وواسعة لرحلات عائلية مريحة."}'),
  (8, false, 'Mercedes-Benz', 'Vito 9 sjedišta', 2021, 'kombi', 'kombi', '#e9ebee', 'manual', 'dizel', 9, 4, 6, 7.4, '2.2 CDI, 136 KS',
   '[{"od":1,"cijena":120},{"od":4,"cijena":110},{"od":8,"cijena":99}]', 600,
   '{"bs":"Kombi za 9 osoba: grupe, porodice i aerodromski transferi.","en":"9-seat van for groups, families and airport transfers.","de":"9-Sitzer für Gruppen, Familien und Flughafentransfers.","ar":"حافلة صغيرة لتسعة ركاب للمجموعات والعائلات والتنقل من المطار."}')
) as v(sort, featured, make, model, year, category, body, color, transmission, fuel, seats, doors, bags, consumption, engine, tiers, deposit, descr)
where b.slug = 'vrelo'
  and not exists (select 1 from rc_vehicles x where x.business_id = b.id and x.make = v.make and x.model = v.model);
