# Home Assistant Search Card

Eine benutzerdefinierte Karte für Home Assistant, die eine Echtzeit-Suchfunktion für alle Ihre Entitäten bereitstellt.

## Features

- 🔍 Echtzeit-Suche über alle Home Assistant Entitäten
- 🏠 Filterung nach Räumen, Gerätetypen und Namen
- 🎨 Automatische Anpassung an Ihr Home Assistant Theme
- 📱 Responsive Design für alle Bildschirmgrößen
- ⚡ Schnelle Leistung durch optimierte Suche
- 🔌 Einfache Installation und Konfiguration

## Installation

### HACS (Empfohlen)

1. Öffnen Sie HACS in Home Assistant
2. Gehen Sie zu "Frontend"
3. Klicken Sie auf die drei Punkte oben rechts
4. Wählen Sie "Benutzerdefinierte Repositories"
5. Fügen Sie diese URL hinzu: `https://github.com/IhrBenutzername/ha-search-card`
6. Wählen Sie Kategorie "Lovelace"
7. Klicken Sie auf "Hinzufügen"
8. Installieren Sie die "Home Assistant Search Card"
9. Starten Sie Home Assistant neu

### Manuelle Installation

1. Laden Sie `ha-search-card.js` aus dem `dist` Ordner herunter
2. Kopieren Sie die Datei in Ihr `www` Verzeichnis
3. Fügen Sie folgende Zeilen zu Ihrer `configuration.yaml` hinzu:
```yaml
frontend:
  extra_module_url:
    - /local/ha-search-card.js
```
4. Starten Sie Home Assistant neu

## Verwendung

1. Öffnen Sie Ihr Dashboard
2. Klicken Sie auf "Dashboard bearbeiten"
3. Wählen Sie "+ KARTE HINZUFÜGEN"
4. Scrollen Sie nach unten zu "Nach Karten suchen"
5. Wählen Sie "Custom: Search Card"

Oder fügen Sie manuell folgende YAML-Konfiguration hinzu:
```yaml
type: 'custom:ha-search-card'
```

## Konfigurationsoptionen

| Option | Typ | Standard | Beschreibung |
|--------|------|---------|--------------|
| title | string | 'Entitäten Suche' | Titel der Karte |
| icon | string | 'mdi:magnify' | Icon für die Suchkarte |
| excluded_entities | list | [] | Liste von Entitäten, die ausgeschlossen werden sollen |
| included_domains | list | [] | Liste von Domains, die eingeschlossen werden sollen |

Beispiel-Konfiguration:
```yaml
type: 'custom:ha-search-card'
title: 'Meine Suche'
icon: 'mdi:home-search'
excluded_entities:
  - sensor.excluded_sensor
included_domains:
  - light
  - switch
```

## Entwicklung

### Setup

1. Klonen Sie das Repository
```bash
git clone https://github.com/IhrBenutzername/ha-search-card
cd ha-search-card
```

2. Installieren Sie die Abhängigkeiten
```bash
npm install
```

3. Starten Sie den Entwicklungsserver
```bash
npm start
```

### Build

```bash
npm run build
```

## Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei

## Unterstützung

- [Issues auf GitHub](https://github.com/IhrBenutzername/ha-search-card/issues)
- [Home Assistant Community Forum](https://community.home-assistant.io/)

## Mitwirken

Beiträge sind willkommen! Bitte lesen Sie [CONTRIBUTING.md](CONTRIBUTING.md) für Details.
