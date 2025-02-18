(() => {
  console.info(
    '%c SEARCH-CARD %c Version 1.0.0 ',
    'color: white; background: blue; font-weight: 700;',
    'color: blue; background: white; font-weight: 700;',
  );

  class SearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    static get properties() {
      return {
        hass: {},
        config: {},
      };
    }

    async setConfig(config) {
      if (!config) {
        throw new Error('Invalid configuration');
      }
      this.config = config;
      await this.loadCardHelpers();
    }

    async loadCardHelpers() {
      this.cardHelpers = await window.loadCardHelpers();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this.initialized) {
        this.initialized = true;
        this.initializeCard();
      }
      this.updateEntities();
    }

    initializeCard() {
      const card = document.createElement('ha-card');
      card.header = 'Entity Search';

      const content = document.createElement('div');
      content.className = 'card-content';

      const style = document.createElement('style');
      style.textContent = `
        .card-content {
          padding: 16px;
        }
        .search-container {
          margin-bottom: 16px;
        }
        input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .entity-card {
          padding: 16px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          cursor: pointer;
        }
        .entity-card:hover {
          box-shadow: var(--shadow-elevation-4dp);
        }
      `;

      const searchContainer = document.createElement('div');
      searchContainer.className = 'search-container';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search entities...';
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.updateResults();
      });

      searchContainer.appendChild(searchInput);

      this.resultsContainer = document.createElement('div');
      this.resultsContainer.className = 'results-grid';

      content.appendChild(searchContainer);
      content.appendChild(this.resultsContainer);

      this.shadowRoot.appendChild(style);
      card.appendChild(content);
      this.shadowRoot.appendChild(card);
    }

    updateEntities() {
      if (!this._hass) return;

      this.entities = Object.entries(this._hass.states).map(([entityId, entity]) => ({
        id: entityId,
        name: entity.attributes.friendly_name || entityId,
        state: entity.state,
        type: entityId.split('.')[0],
      }));

      this.updateResults();
    }

    updateResults() {
      if (!this.resultsContainer || !this.searchTerm) return;

      const filteredEntities = this.entities.filter(entity =>
        entity.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        entity.id.toLowerCase().includes(this.searchTerm.toLowerCase())
      );

      this.resultsContainer.innerHTML = '';

      filteredEntities.forEach(entity => {
        const card = document.createElement('div');
        card.className = 'entity-card';
        
        card.innerHTML = `
          <ha-icon icon="${this.getEntityIcon(entity.type, entity.state)}"></ha-icon>
          <div>${entity.name}</div>
          <div>${entity.state}</div>
        `;

        card.addEventListener('click', () => {
          this.handleEntityClick(entity.id);
        });

        this.resultsContainer.appendChild(card);
      });
    }

    getEntityIcon(type, state) {
      const iconMap = {
        light: state === 'on' ? 'mdi:lightbulb' : 'mdi:lightbulb-outline',
        switch: state === 'on' ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off',
        sensor: 'mdi:thermometer',
      };
      return iconMap[type] || 'mdi:help-circle';
    }

    handleEntityClick(entityId) {
      const event = new CustomEvent('hass-more-info', {
        detail: { entityId },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }

    getCardSize() {
      return 3;
    }
  }

  // Register the custom element
  if (!customElements.get('search-card')) {
    customElements.define('search-card', SearchCard);
  }

  // Register with HACS
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'search-card',
    name: 'Search Card',
    description: 'A card that allows searching through Home Assistant entities',
  });
})();
