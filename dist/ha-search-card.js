class HASearchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.entities = [];
    this.filteredEntities = [];
    this.areas = {};
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    
    // Initialize once when we first get hass
    if (!this._initialized && hass) {
      this._initialized = true;
      this._initSearch();
    }
    
    // Update entities when hass changes
    if (this.shadowRoot.querySelector('.ha-search-card')) {
      this._updateEntityStates();
    }
  }

  async _initSearch() {
    console.log('[ha-search-card] Initializing search card');
    // Initial render with loading state
    this._render(true);
    
    try {
      await this._loadAreaData();
      await this._loadEntityData();
      this._render();
      this._setupEventListeners();
      console.log('[ha-search-card] Search card initialized with', this.entities.length, 'entities in', Object.keys(this.areas).length, 'areas');
    } catch (error) {
      console.error('[ha-search-card] Error initializing search card:', error);
      this._render();
    }
  }
  
  async _loadAreaData() {
    // Get all areas
    const areaRegistry = await this._hass.callWS({ type: 'config/area_registry/list' });
    
    // Create a lookup map for areas
    this.areas = {};
    areaRegistry.forEach(area => {
      this.areas[area.area_id] = area.name;
    });
    
    console.log('[ha-search-card] Loaded', Object.keys(this.areas).length, 'areas');
  }
  
  async _loadEntityData() {
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
    
    // Reset entities array
    this.entities = [];
    
    // Process all entities in entity registry
    entityRegistry.forEach(entity => {
      // Skip entities with no state object
      if (!this._hass.states[entity.entity_id]) {
        return;
      }
      
      let areaId = null;
      
      // Check for direct area assignment
      if (entity.area_id) {
        areaId = entity.area_id;
      } 
      // Check for area via device
      else if (entity.device_id && deviceAreas[entity.device_id]) {
        areaId = deviceAreas[entity.device_id];
      }
      
      // Skip entities with no area
      if (!areaId) {
        return;
      }
      
      // Get state object
      const stateObj = this._hass.states[entity.entity_id];
      
      // Add to entities array
      this.entities.push({
        entity_id: entity.entity_id,
        name: entity.name || stateObj.attributes.friendly_name || entity.entity_id,
        state: stateObj.state,
        icon: stateObj.attributes.icon,
        area: this.areas[areaId] || 'Unknown',
        area_id: areaId,
        domain: entity.entity_id.split('.')[0]
      });
    });
    
    // Sort entities by area name, then by entity name
    this.entities.sort((a, b) => {
      if (a.area < b.area) return -1;
      if (a.area > b.area) return 1;
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    
    console.log('[ha-search-card] Loaded', this.entities.length, 'entities with area assignments');
  }
  
  _updateEntityStates() {
    if (!this._hass || !this.entities.length) return;
    
    let updated = false;
    
    // Update entity states with the latest data
    this.entities.forEach(entity => {
      const stateObj = this._hass.states[entity.entity_id];
      if (stateObj) {
        if (entity.state !== stateObj.state) {
          entity.state = stateObj.state;
          updated = true;
        }
        
        const newIcon = stateObj.attributes.icon;
        if (entity.icon !== newIcon) {
          entity.icon = newIcon;
          updated = true;
        }
      }
    });
    
    // Re-render if states have changed and we're showing filtered results
    if (updated && this.filteredEntities.length > 0) {
      this._renderResults();
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
    
    // Initial render with config
    this._render();
  }

  static getStubConfig() {
    return {
      title: 'Entity Search',
      icon: 'mdi:magnify',
      max_results: 10
    };
  }
  
  _setupEventListeners() {
    // Find search input
    const searchInput = this.shadowRoot.querySelector('.search-input');
    if (!searchInput) {
      console.error('[ha-search-card] Could not find search input');
      return;
    }
    
    // Add input listener for search
    searchInput.addEventListener('input', e => this._handleSearchInput(e));
    console.log('[ha-search-card] Set up search input event listener');
  }
  
  _handleSearchInput(e) {
    const query = e.target.value;
    console.log('[ha-search-card] Search input:', query);
    this._search(query);
  }
  
  _search(query) {
    // Clear results if query is empty
    if (!query || query.trim() === '') {
      console.log('[ha-search-card] Empty query, clearing results');
      this.filteredEntities = [];
      this._renderResults();
      return;
    }
    
    console.log('[ha-search-card] Searching for:', query, 'in', this.entities.length, 'entities');
    
    // Normalize and split search terms
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
    
    // Search through entities
    this.filteredEntities = this.entities.filter(entity => {
      // Check if any search term is found in entity_id, name, area, or domain
      return searchTerms.some(term => 
        entity.entity_id.toLowerCase().includes(term) ||
        entity.name.toLowerCase().includes(term) ||
        entity.area.toLowerCase().includes(term) ||
        entity.domain.toLowerCase().includes(term)
      );
    });
    
    console.log('[ha-search-card] Found', this.filteredEntities.length, 'matching entities');
    
    // Limit results
    if (this.filteredEntities.length > this.config.max_results) {
      this.filteredEntities = this.filteredEntities.slice(0, this.config.max_results);
      console.log('[ha-search-card] Limited to', this.filteredEntities.length, 'results');
    }
    
    // Render results
    this._renderResults();
  }

  _handleEntityClick(entityId) {
    console.log('[ha-search-card] Entity clicked:', entityId);
    
    // Show more-info dialog for the entity
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  _render(isLoading = false) {
    if (!this.config) {
      this.shadowRoot.innerHTML = `<div>Waiting for configuration...</div>`;
      return;
    }

    const styles = `
      :host {
        --search-text-color: var(--primary-text-color);
        --search-background: var(--card-background-color, var(--paper-card-background-color, white));
        --search-border-color: var(--divider-color);
        --search-focus-border: var(--primary-color);
        --result-hover: var(--secondary-background-color);
      }
      
      .ha-search-card {
        display: flex;
        flex-direction: column;
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
    
    const cardHtml = `
      <ha-card>
        <div class="card-content">
          <div class="ha-search-card">
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
              >
            </div>
            
            <div class="results">
              ${isLoading ? 
                `<div class="loading">Daten werden geladen...</div>` : 
                `<div class="no-results">Gib einen Suchbegriff ein, um Entities zu finden</div>`
              }
            </div>
            
            <div class="stats">
              ${this.entities.length ? 
                `${this.entities.length} Entities in ${Object.keys(this.areas).length} Bereichen` : 
                isLoading ? 'Lade Entities...' : 'Keine Entities mit Bereichen gefunden'
              }
            </div>
          </div>
        </div>
      </ha-card>
    `;
    
    // Set the content to the shadow root
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      ${cardHtml}
    `;
    
    // Set up event listeners after rendering
    if (!isLoading && this._initialized) {
      this._setupEventListeners();
    }
  }
  
  _renderResults() {
    // Find results container
    const resultsContainer = this.shadowRoot.querySelector('.results');
    if (!resultsContainer) {
      console.error('[ha-search-card] Could not find results container');
      return;
    }
    
    // Update results HTML
    if (this.filteredEntities.length === 0) {
      const searchInput = this.shadowRoot.querySelector('.search-input');
      if (!searchInput || !searchInput.value || searchInput.value.trim() === '') {
        resultsContainer.innerHTML = `<div class="no-results">Gib einen Suchbegriff ein, um Entities zu finden</div>`;
      } else {
        resultsContainer.innerHTML = `<div class="no-results">Keine passenden Entities gefunden</div>`;
      }
      return;
    }
    
    // Create results HTML
    const resultsHtml = this.filteredEntities.map(entity => {
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
    
    // Set results HTML
    resultsContainer.innerHTML = resultsHtml;
    
    // Add click listeners to results
    this.shadowRoot.querySelectorAll('.result-item').forEach(item => {
      const entityId = item.getAttribute('data-entity-id');
      item.addEventListener('click', () => this._handleEntityClick(entityId));
    });
    
    console.log('[ha-search-card] Rendered', this.filteredEntities.length, 'results');
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
