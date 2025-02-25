class HASearchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.entities = [];
    this.filteredEntities = [];
    this.areas = {};
    this.debounceTimeout = null;
    this._hass = null;
  }

  set hass(hass) {
    // Store hass object for future use
    this._hass = hass;
    
    // Only load data once
    if (!this.entities.length) {
      this.loadData();
    } else {
      // Update entity states if we already have entities
      this.updateEntityStates();
      // Re-render if we have filtered results showing
      if (this.filteredEntities.length > 0) {
        this.render();
      }
    }
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    
    this.config = {
      title: 'Entity Search',
      icon: 'mdi:magnify',
      max_results: 10,
      ...config
    };
    
    this.render();
  }

  static getStubConfig() {
    return {
      title: 'Entity Search',
      icon: 'mdi:magnify',
      max_results: 10
    };
  }
  
  async loadData() {
    if (!this._hass) return;
    
    // Initial render with loading state
    this.render(true);
    
    try {
      // Get all areas first
      const areaRegistry = await this._hass.callWS({ type: 'config/area_registry/list' });
      
      // Create a lookup map for areas
      areaRegistry.forEach(area => {
        this.areas[area.area_id] = area.name;
      });
      
      // Get device registry to map devices to areas
      const deviceRegistry = await this._hass.callWS({ type: 'config/device_registry/list' });
      
      // Create a lookup for devices with their area_ids
      const deviceAreas = {};
      deviceRegistry.forEach(device => {
        if (device.area_id) {
          deviceAreas[device.id] = device.area_id;
        }
      });
      
      // Get entity registry 
      const entityRegistry = await this._hass.callWS({ type: 'config/entity_registry/list' });
      
      // Process all entities
      this.entities = [];
      
      // First collect all entities that have a direct area assignment
      const entitiesWithDirectArea = [];
      entityRegistry.forEach(entity => {
        if (entity.area_id) {
          entitiesWithDirectArea.push(entity.entity_id);
          
          const stateObj = this._hass.states[entity.entity_id];
          if (!stateObj) return; // Skip if no state object
          
          this.entities.push({
            entity_id: entity.entity_id,
            name: entity.name || stateObj.attributes.friendly_name || entity.entity_id,
            state: stateObj.state,
            icon: stateObj.attributes.icon,
            area: this.areas[entity.area_id] || 'Unknown',
            area_id: entity.area_id,
            domain: entity.entity_id.split('.')[0]
          });
        }
      });
      
      // Now check entities without direct area but with device_id
      entityRegistry.forEach(entity => {
        // Skip if already processed (has direct area)
        if (entitiesWithDirectArea.includes(entity.entity_id)) return;
        
        // Check if entity has a device_id with an area
        if (entity.device_id && deviceAreas[entity.device_id]) {
          const areaId = deviceAreas[entity.device_id];
          const stateObj = this._hass.states[entity.entity_id];
          if (!stateObj) return; // Skip if no state object
          
          this.entities.push({
            entity_id: entity.entity_id,
            name: entity.name || stateObj.attributes.friendly_name || entity.entity_id,
            state: stateObj.state,
            icon: stateObj.attributes.icon,
            area: this.areas[areaId] || 'Unknown',
            area_id: areaId,
            domain: entity.entity_id.split('.')[0]
          });
        }
      });
      
      // Sort entities by area name, then by entity name
      this.entities.sort((a, b) => {
        if (a.area < b.area) return -1;
        if (a.area > b.area) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
      
      console.log(`[ha-search-card] Loaded ${this.entities.length} entities with area assignments`);
      
      // Set initial filtered entities to empty
      this.filteredEntities = [];
      
      // Render the card with data
      this.render();
    } catch (error) {
      console.error('[ha-search-card] Error loading data:', error);
      this.render();
    }
  }
  
  updateEntityStates() {
    if (!this._hass || !this.entities.length) return;
    
    // Update entity states with the latest data
    this.entities.forEach(entity => {
      const stateObj = this._hass.states[entity.entity_id];
      if (stateObj) {
        entity.state = stateObj.state;
        entity.icon = stateObj.attributes.icon;
      }
    });
  }

  search(query) {
    if (!query) {
      this.filteredEntities = [];
      this.render();
      return;
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    this.filteredEntities = this.entities.filter(entity => {
      // Check if all search terms are found in entity_id, name, area, or domain
      return searchTerms.every(term => 
        entity.entity_id.toLowerCase().includes(term) ||
        (entity.name && entity.name.toLowerCase().includes(term)) ||
        (entity.area && entity.area.toLowerCase().includes(term)) ||
        entity.domain.toLowerCase().includes(term)
      );
    });
    
    // Limit results
    this.filteredEntities = this.filteredEntities.slice(0, this.config.max_results);
    
    this.render();
  }

  handleSearchInput(e) {
    const query = e.target.value;
    
    // Debounce search to avoid excessive rendering
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.search(query);
    }, 150);
  }

  handleEntityClick(entityId) {
    // Show more-info dialog for the entity
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  render(isLoading = false) {
    if (!this.config) return;

    const styles = `
      :host {
        --search-text-color: var(--primary-text-color);
        --search-background: var(--card-background-color, var(--paper-card-background-color, white));
        --search-border-color: var(--divider-color);
        --search-focus-border: var(--primary-color);
        --result-hover: var(--secondary-background-color);
      }
      
      .card-content {
        padding: 16px;
      }
      
      .header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .header ha-icon {
        margin-right: 8px;
        color: var(--primary-color);
      }
      
      .header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: var(--search-text-color);
      }
      
      .search-container {
        position: relative;
        width: 100%;
      }
      
      .search-input {
        width: 100%;
        padding: 10px 16px;
        padding-left: 40px;
        border: 1px solid var(--search-border-color);
        border-radius: 4px;
        background: var(--search-background);
        color: var(--search-text-color);
        font-size: 16px;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
      }
      
      .search-input:focus {
        outline: none;
        border-color: var(--search-focus-border);
      }
      
      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--secondary-text-color);
      }
      
      .results {
        margin-top: 12px;
        max-height: 500px;
        overflow-y: auto;
      }
      
      .result-item {
        display: flex;
        align-items: center;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .result-item:hover {
        background-color: var(--result-hover);
      }
      
      .entity-icon {
        margin-right: 12px;
      }
      
      .entity-info {
        flex: 1;
      }
      
      .entity-name {
        font-weight: 500;
        color: var(--search-text-color);
      }
      
      .entity-secondary {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }
      
      .entity-id {
        opacity: 0.7;
      }
      
      .entity-area {
        font-style: italic;
      }
      
      .entity-state {
        margin-left: 8px;
        padding: 2px 8px;
        border-radius: 10px;
        background: var(--result-hover);
        font-size: 12px;
      }
      
      .no-results, .loading, .stats {
        padding: 10px 0;
        text-align: center;
        color: var(--secondary-text-color);
        font-style: italic;
      }
      
      .debug-info {
        margin-top: 16px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        font-size: 12px;
        color: var(--primary-text-color);
      }
      
      @media (max-width: 600px) {
        .card-content {
          padding: 12px;
        }
        
        .header h2 {
          font-size: 16px;
        }
        
        .search-input {
          font-size: 14px;
          padding: 8px 12px 8px 36px;
        }
        
        .search-icon {
          left: 10px;
        }
        
        .entity-name {
          font-size: 14px;
        }
        
        .entity-secondary {
          font-size: 11px;
        }
      }
    `;
    
    const debugInfo = `
      <div class="debug-info">
        <div>Entities mit Bereichen: ${this.entities.length}</div>
        <div>Bereiche: ${Object.keys(this.areas).length}</div>
      </div>
    `;
    
    const htmlContent = `
      <ha-card>
        <div class="card-content">
          <div class="header">
            <ha-icon icon="${this.config.icon}"></ha-icon>
            <h2>${this.config.title}</h2>
          </div>
          
          <div class="search-container">
            <ha-icon class="search-icon" icon="mdi:magnify"></ha-icon>
            <input
              type="text"
              class="search-input"
              placeholder="Suche nach Entities..."
              @input="${e => this.handleSearchInput(e)}"
            >
          </div>
          
          <div class="results">
            ${isLoading ? `
              <div class="loading">Daten werden geladen...</div>
            ` : this.renderResults()}
          </div>
          
          <div class="stats">
            ${this.entities.length ? `${this.entities.length} Entities in ${Object.keys(this.areas).length} Bereichen geladen` : 'Keine Entities mit Bereichen gefunden'}
          </div>
          
          ${this.entities.length === 0 ? debugInfo : ''}
        </div>
      </ha-card>
    `;
    
    // Set the content to the shadow root
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      ${htmlContent}
    `;
    
    // Add event listeners to result items
    if (!isLoading) {
      this.shadowRoot.querySelectorAll('.result-item').forEach(item => {
        const entityId = item.getAttribute('data-entity-id');
        item.addEventListener('click', () => this.handleEntityClick(entityId));
      });
    }
  }
  
  renderResults() {
    if (this.filteredEntities.length === 0) {
      // Show message if no search or no results
      const searchInput = this.shadowRoot.querySelector('.search-input');
      if (!searchInput || !searchInput.value) {
        return `<div class="no-results">Gib einen Suchbegriff ein, um Entities zu finden</div>`;
      } else {
        return `<div class="no-results">Keine passenden Entities gefunden</div>`;
      }
    }
    
    return this.filteredEntities.map(entity => {
      // Determine entity icon
      let icon = entity.icon;
      if (!icon) {
        // Fallback icons based on domain
        const domainIcons = {
          light: 'mdi:lightbulb',
          switch: 'mdi:toggle-switch',
          sensor: 'mdi:eye',
          binary_sensor: 'mdi:checkbox-marked-circle',
          climate: 'mdi:thermostat',
          cover: 'mdi:window-shutter',
          media_player: 'mdi:cast',
          camera: 'mdi:video',
          fan: 'mdi:fan',
          vacuum: 'mdi:robot-vacuum',
          lock: 'mdi:lock',
          weather: 'mdi:weather-partly-cloudy',
          automation: 'mdi:robot',
          script: 'mdi:file-document',
          scene: 'mdi:palette',
          person: 'mdi:account',
          device_tracker: 'mdi:crosshairs-gps'
        };
        
        icon = domainIcons[entity.domain] || 'mdi:eye';
      }
      
      return `
        <div class="result-item" data-entity-id="${entity.entity_id}">
          <ha-icon class="entity-icon" icon="${icon}"></ha-icon>
          <div class="entity-info">
            <div class="entity-name">${entity.name}</div>
            <div class="entity-secondary">
              <span class="entity-id">${entity.entity_id}</span>
              <span class="entity-area">${entity.area}</span>
            </div>
          </div>
          <div class="entity-state">${entity.state}</div>
        </div>
      `;
    }).join('');
  }
  
  getCardSize() {
    return 3;
  }
}

customElements.define('ha-search-card', HASearchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-search-card',
  name: 'Home Assistant Search Card',
  description: 'Search for entities by name, ID, room or type'
});
