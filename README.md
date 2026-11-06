# HomeLab Topology

Przeglądarkowe narzędzie do projektowania i dokumentowania topologii sieci home lab: urządzeń sieciowych, infrastruktury, serwerów i maszyn wirtualnych.

Działa w całości w przeglądarce, bez serwera, bez instalacji i bez zewnętrznych bibliotek.

## Uruchomienie

Otwórz plik `index.html` w przeglądarce (Chrome, Firefox, Edge, Safari).

Opcjonalnie możesz go serwować lokalnie, np.:

```bash
python3 -m http.server 8080
# następnie otwórz http://localhost:8080
```

## Funkcje

- **Paleta ponad 25 typów urządzeń** w 7 kategoriach:
  - Internet / WAN: Internet, Modem / ONT, Usługa chmurowa
  - Sieć: Router, Switch, Access Point, Patch panel
  - Bezpieczeństwo: Firewall, Brama VPN
  - Serwery i storage: Serwer, Hypervisor, NAS, Mini PC, Raspberry Pi / SBC
  - Wirtualizacja: VM, Kontener, Klaster / K8s
  - Urządzenia końcowe: PC, laptop, smartfon, TV, drukarka, kamera IP, IoT
  - Infrastruktura: UPS, PDU, szafa rack, inne urządzenia
- **Połączenia** z typem medium (Ethernet, światłowód / SFP / DAC, Wi-Fi, VPN, wirtualne, USB, zasilanie), prędkością (100M–100G, grubość linii zależy od prędkości), portami po obu stronach, VLAN-ami i etykietą. Kilka połączeń między tymi samymi urządzeniami (np. LAG) rysuje się jako osobne łuki.
- **Strefy**: prostokątne obszary dla VLAN-ów, podsieci, pomieszczeń lub szaf rack. Przesunięcie strefy przesuwa też urządzenia, które się w niej znajdują.
- **Właściwości urządzenia**: nazwa / hostname, status (online / offline / serwis / planowane), IP, VLAN, MAC, model, system, specyfikacja, lokalizacja, usługi, kolor i notatki.
- **Inwentarz**: tabela urządzeń z filtrowaniem i sortowaniem (IP sortowane numerycznie), wykrywaniem konfliktów i błędnych adresów IP oraz listą VLAN-ów.
- **Problemy do rozwiązania**: lista problemów, zadań i planów rozbudowy w zakładce **Problemy**.
  - Każdy wpis ma priorytet (krytyczny / wysoki / średni / niski), status (otwarty / w trakcie / rozwiązany) i opis kroków do rozwiązania.
  - Wpis można powiązać z dowolnymi urządzeniami, połączeniami i strefami. Urządzenia z otwartymi problemami mają na schemacie znacznik z liczbą problemów w kolorze najwyższego priorytetu. Kliknięcie znacznika pokazuje problemy tego urządzenia.
  - Wykrywanie automatyczne: konflikty i błędne adresy IP, urządzenia offline lub w serwisie, urządzenia bez połączeń, urządzenia bez adresu IP oraz VM / kontenery nieprzypisane do hosta. Każdą pozycję dodasz do listy jednym kliknięciem.
  - Eksport listy do checklisty Markdown lub CSV.
- **Zapis**: automatycznie w przeglądarce (localStorage), a także import i eksport do pliku JSON.
- **Eksport**: PNG (wysoka rozdzielczość), SVG i CSV z inwentarzem (format dla polskiego Excela).
- Cofnij / ponów, kopiuj / wklej / duplikuj, wyrównywanie i równomierne rozkładanie, przyciąganie do siatki, zoom i dopasowanie widoku.

## Obsługa

| Akcja | Jak |
| --- | --- |
| Dodanie urządzenia | Przeciągnij z palety na płótno albo kliknij element palety |
| Połączenie urządzeń | Przeciągnij z niebieskiego uchwytu (prawa krawędź kafelka) na inne urządzenie. Możesz też użyć trybu **Połącz** (`L`): kliknij A, potem B |
| Zaznaczanie obszarem | `Shift` + przeciąganie po tle |
| Przesuwanie widoku | Przeciąganie tła, `Spacja` + przeciąganie lub środkowy przycisk myszy |
| Zoom | Kółko myszy, `+` / `-`, `F` dopasowuje widok |
| Usuwanie | `Delete` / `Backspace` |
| Cofnij / ponów | `Ctrl+Z` / `Ctrl+Y` (lub `Ctrl+Shift+Z`) |
| Kopiuj / wklej / duplikuj | `Ctrl+C` / `Ctrl+V` / `Ctrl+D` |
| Przesuwanie zaznaczenia | Strzałki (z `Shift` o jedną kratkę siatki) |
| Zapis do pliku | `Ctrl+S` |
| Edycja nazwy | Podwójne kliknięcie elementu |
| Zgłoszenie problemu | Zaznacz urządzenia i kliknij **+ Nowy problem** w zakładce Problemy (albo **Zgłoś problem** w panelu właściwości) |

Typ nowego połączenia ustawia się automatycznie: AP z urządzeniem końcowym to Wi-Fi, VM lub kontener to połączenie wirtualne, a UPS lub PDU to zasilanie.

## Struktura projektu

```
index.html       – układ aplikacji
css/style.css    – style interfejsu
js/devices.js    – definicje typów urządzeń (ikony SVG), połączeń i statusów
js/app.js        – logika edytora: rysowanie, interakcje, historia, import/eksport
```

Nowy typ urządzenia dodasz, dopisując wpis do `HL.DEVICE_TYPES` w `js/devices.js`. Ikonę rysuje się w SVG w siatce 24×24.

## Format pliku JSON

```json
{
  "version": 1,
  "name": "Mój home lab",
  "nodes": [{ "id": "n1", "type": "switch", "x": 0, "y": 0, "name": "switch-core", "ip": "192.168.1.2", "vlan": "1" }],
  "links": [{ "id": "l1", "from": "n1", "to": "n2", "type": "fiber", "speed": "10G", "fromPort": "SFP+1", "toPort": "", "vlan": "10" }],
  "zones": [{ "id": "z1", "x": 0, "y": 0, "w": 400, "h": 300, "name": "VLAN 10", "desc": "192.168.10.0/24", "color": "#34d399" }],
  "issues": [{ "id": "i1", "title": "Brak backupu NAS", "type": "problem", "priority": "high", "status": "open", "desc": "", "refs": ["n2"], "created": "2026-11-06" }]
}
```
