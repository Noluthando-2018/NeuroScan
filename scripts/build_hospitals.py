"""
Builds src/data/hospitals.json  ->  { "Konya": ["Konya Şehir Hastanesi", ...], ... }

Source: OpenStreetMap (Overpass API), all places tagged amenity=hospital, one request per province.
Data licence: ODbL -> mention "© OpenStreetMap contributors" in your report.

Run from the project root (needs internet, no extra packages):
    python scripts/build_hospitals.py

Takes a few minutes (81 requests, polite pauses). Re-run it any time to refresh.
You can also open the JSON afterwards and add / fix hospitals by hand.
"""
import json, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

CITIES = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkâri","Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"]  # index + 1 = plate code

URL = "https://overpass-api.de/api/interpreter"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "hospitals.json"


def run(query, retries=4):
    data = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(URL, data=data, headers={"User-Agent": "NeuroScan-student-project"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["elements"]
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            wait = 10 * (attempt + 1)
            print(f"   retry in {wait}s ({e})")
            time.sleep(wait)
    return []


def names_for(plate, city):
    tag = 'nwr["amenity"="hospital"]["name"](area.a);out tags;'
    # 1) province by its ISO 3166-2 code (TR-01 ... TR-81 = plate codes)   2) fallback: by province name
    elements = run(f'[out:json][timeout:90];area["ISO3166-2"="TR-{plate:02d}"]->.a;{tag}')
    if not elements:
        elements = run(f'[out:json][timeout:90];area["name"="{city}"]["admin_level"="4"]->.a;{tag}')
    return sorted({e["tags"]["name"].strip() for e in elements if e.get("tags", {}).get("name")}, key=str.casefold)


def main():
    result = {}
    for plate, city in enumerate(CITIES, start=1):
        result[city] = names_for(plate, city)
        print(f"{plate:02d} {city:<16} {len(result[city]):>4} hospitals")
        time.sleep(2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    empty = [c for c, h in result.items() if not h]
    print(f"\nSaved {sum(len(h) for h in result.values())} hospitals -> {OUT}")
    if empty:
        print("No data for:", ", ".join(empty), "(users can still type their hospital)")


if __name__ == "__main__":
    main()
