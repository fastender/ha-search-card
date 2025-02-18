# Home Assistant Search Card

A custom card for Home Assistant that provides real-time search functionality across all your entities. Quickly find and access any entity in your Home Assistant instance through an intuitive search interface.

![Example Screenshot](https://raw.githubusercontent.com/fastender/ha-search-card/main/examples/screenshot.png)

## Features

- 🔍 Real-time search across all Home Assistant entities
- 🏠 Filter by rooms, device types, and names
- 🎨 Automatically adapts to your Home Assistant theme
- 📱 Responsive design for all screen sizes
- ⚡ Fast performance with optimized search
- 🔌 Easy installation and configuration

## Installation

### Option 1: HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the menu icon in the top right corner
3. Select "Custom repositories"
4. Add `https://github.com/fastender/ha-search-card` with category "Lovelace"
5. Click "Install"
6. Restart Home Assistant

### Option 2: Manual Installation

1. Download `ha-search-card.js` from the latest release
2. Copy it to your `www` directory in Home Assistant
3. Add the following to your `configuration.yaml`:
```yaml
frontend:
  extra_module_url:
    - /local/ha-search-card.js
```
4. Restart Home Assistant

## Usage

### Basic Configuration

Add the card to your dashboard:
```yaml
type: 'custom:ha-search-card'
```

### Advanced Configuration

```yaml
type: 'custom:ha-search-card'
title: 'Entity Search'
icon: 'mdi:magnify'
excluded_entities:
  - sensor.excluded_sensor
included_domains:
  - light
  - switch
show_room_tags: true
show_type_tags: true
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| title | string | 'Entity Search' | Card title |
| icon | string | 'mdi:magnify' | Search icon |
| excluded_entities | list | [] | Entities to exclude from search |
| included_domains | list | [] | Only include these domains |
| show_room_tags | boolean | true | Show room tags on entity cards |
| show_type_tags | boolean | true | Show entity type tags |

## Development

### Setup

1. Clone the repository
```bash
git clone https://github.com/fastender/ha-search-card
cd ha-search-card
```

2. Install dependencies
```bash
npm install
```

3. Start development server
```bash
npm start
```

### Build

```bash
npm run build
```

### Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

- [Report an issue](https://github.com/fastender/ha-search-card/issues)
- [Home Assistant Community Forum](https://community.home-assistant.io/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the Home Assistant community for feedback and contributions
- Inspired by the need for better entity management in large Home Assistant installations

## Changelog

### [1.0.0] - 2025-02-18
- Initial release
- Real-time search functionality
- Theme integration
- Responsive design

### [1.0.1] - 2025-02-18
- Added room tag support
- Improved search performance
- Fixed icon rendering issues

## Roadmap

- [ ] Add fuzzy search support
- [ ] Implement group filtering
- [ ] Add custom styling options
- [ ] Support for entity state filtering
- [ ] Add localization support

## FAQ

**Q: Can I use this card with YAML-configured dashboards?**  
A: Yes, the card works with both UI and YAML-configured dashboards.

**Q: Does it work with all entity types?**  
A: Yes, the card supports all Home Assistant entity types and will show appropriate icons for each.

**Q: How can I customize the styling?**  
A: The card automatically adapts to your Home Assistant theme. Additional styling options will be added in future releases.
