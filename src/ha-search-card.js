import { LitElement, html, css } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

class HASearchCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      searchTerm: { type: String },
      filteredEntities: { type: Array }
    };
  }

  constructor() {
    super();
    this.searchTerm = '';
    this.filteredEntities = [];
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 16px;
      }
      
      .search-container {
        position: relative;
        margin-bottom: 16px;
      }
      
      .search-input {
        width: 100%;
        padding: 8px 12px;
        padding-left: 40px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #000);
      }
      
      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--secondary-text-color, #757575);
      }
      
      .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 16px;
      }
      
      .entity-card {
        background: var(--card-background-color, #fff);
        border-radius: 4px;
        border: 1px solid var(--divider-color, #e0e0e0);
        padding: 16px;
        cursor: pointer;
        transition: box-shadow 0.3s ease;
      }
      
      .entity-card:hover {
        box-shadow: var(--shadow-elevation-4dp, 0 2px 4px rgba(0,0,0,0.1));
      }
      
      .entity-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .entity-name {
        margin-left: 8px;
        font-weight: 500;
      }
      
      .entity-state {
        color: var(--secondary-text-color, #757575);
        font-size: 0.9em;
      }
      
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
      }
      
      .tag {
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
      }
      
      .no-results {
        text-align: center;
        color: var(--secondary-text-color, #757575);
        padding: 32px;
      }
    `;
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = config;
  }

  updated(changedProps) {
    if (changedProps.has('hass')) {
      this.updateEntities();
    }
  }

  updateEntities() {
    const entities = Object.entries(this.hass.states).map(([entityId, entity]) => ({
      id: entityId,
      name: entity.attributes.friendly_name || entityId,
      state: entity.state,
      type: entityId.split('.')[0],
      room: entity.attributes.room || 'Nicht zugeordnet'
    }));

    this.searchEntities(this.searchTerm, entities);
  }

  searchEntities(searchTerm, entities = null) {
    const entitiesToSearch = entities || Object.entries(this.hass.states).map(([entityId, entity]) => ({
      id: entityId,
      name: entity.attributes.friendly_name || entityId,
      state: entity.state,
      type: entityId.split('.')[0],
      room: entity.attributes.room || 'Nicht zugeordnet'
    }));

    this.filteredEntities = entitiesToSearch.filter(entity =>
      entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  handleSearch(e) {
    this.searchTerm = e.target.value;
    this.searchEntities(this.searchTerm);
  }

  handleEntityClick(entityId) {
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  getEntityIcon(type, state) {
    const iconMap = {
      light: state === 'on' ? 'hass:lightbulb' : 'hass:lightbulb-outline',
      switch: state === 'on' ? 'hass:toggle-switch' : 'hass:toggle-switch-off',
      sensor: 'hass:thermometer',
      binary_sensor: 'hass:eye',
      climate: 'hass:thermostat',
      media_player: 'hass:cast',
      camera: 'hass:video',
      cover: 'hass:window-shutter',
    };

    return iconMap[type] || 'hass:help-circle';
  }

  render() {
    if (!this.hass) {
      return html``;
    }

    return html`
      <ha-card>
        <div class="search-container">
          <ha-icon class="search-icon" icon="hass:magnify"></ha-icon>
          <input
            type="text"
            class="search-input"
            .value="${this.searchTerm}"
            @input="${this.handleSearch}"
            placeholder="Suchen Sie nach Räumen, Geräten oder Funktionen..."
          >
        </div>
        
        <div class="results-grid">
          ${this.filteredEntities.map(entity => html`
            <div class="entity-card" @click="${() => this.handleEntityClick(entity.id)}">
              <div class="entity-header">
                <ha-icon icon="${this.getEntityIcon(entity.type, entity.state)}"></ha-icon>
                <span class="entity-name">${entity.name}</span>
              </div>
              <div class="entity-state">${entity.state}</div>
              <div class="tags">
                <span class="tag">${entity.room}</span>
                <span class="tag">${entity.type}</span>
              </div>
            </div>
          `)}
        </div>
        
        ${this.filteredEntities.length === 0 ? html`
          <div class="no-results">
            Keine Ergebnisse gefunden für "${this.searchTerm}"
          </div>
        ` : ''}
      </ha-card>
    `;
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('ha-search-card', HASearchCard);
