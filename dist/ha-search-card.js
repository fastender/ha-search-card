class HASearchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.entities = [];
    this.filteredEntities = [];
    this.areas = [];
    this.debounceTimeout = null;
    this.initialized = false;
  }

  setConfig(config) {
    this.config = {
      title: 'Entity Search',
      icon: 'mdi:magnify',
      max_results: 10,
      ...config
    };
  }

  static getStubConfig() {
    return {
      title: 'Entity Search',
      icon: 'mdi:magnify',
      max_results: 10
    };
  }

  async connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const hass = document.querySelector('home-assistant').hass;
    
    // Initial render with loading state
    this.render(hass, true);
    
    // Get all entities and areas in Home Assistant
    await this.updateEntitiesAndAreas(hass);
    
    // Render with actual content
    this.render(hass);
    
    // Set up mutation observer to watch for Home Assistant data changes
    this.setupDataUpdateObserver();
  }

  async updateEntitiesAndAreas(hass) {
    if (!hass) return;

    try {
      // Get all areas
      const areaRegistry = await hass.callWS({ type: 'config/area_registry/list' });
      this.areas = areaRegistry;
      
      // Get entity registry
      const entityRegistry = await hass.callWS({ type: 'config/entity_registry/list' });
      
      // Filter entities to only include those assigned to an area
      this.entities = entityRegistry
        .filter(entity => entity.area_id !== null)
        .map(entity => {
          const stateObj = hass.states[entity.entity_id];
          const area = this.areas.find(area => area.area_id === entity.area_id);
          
          return {
            entity_id: entity.entity_id,
            name: entity.name || (stateObj ? stateObj.attributes.friendly_name : entity.entity_id),
            state: stateObj ? stateObj.state : 'unavailable',
            icon: stateObj ? stateObj.attributes.icon : null,
            area: area ? area.name : 'Unknown',
            area_id: entity.area_id,
            domain: entity.entity_id.split('.')[0]
          };
        });
      
      // Sort entities by area name, then by entity name
      this.entities.sort((a, b) => {
        if (a.area < b.area) return -1;
        if (a.area > b.area) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
      
      // Set initial filtered entities to empty
      this.filteredEntities = [];
    } catch (error) {
      console.error('Error fetching Home Assistant data:', error);
    }
  }
  
  setupDataUpdateObserver() {
    // Create a MutationObserver to detect when Home Assistant data changes
    const hassElement = document.querySelector('home-assistant');
    if (!hassElement) return;
    
    const observer = new MutationObserver(() => {
      const hass = hassElement.hass;
      if (hass && this.entities.length > 0) {
        // Update entity states
        this.entities.forEach(entity => {
          const stateObj = hass.states[entity.entity_id];
          if (stateObj) {
            entity.state = stateObj.state;
            entity.icon = stateObj.attributes.icon;
          }
        });
        
        // Re-render if we have filtered results
        if (this.filteredEntities.length > 0) {
          this.render(hass);
        }
      }
    });
    
    observer.observe(hassElement, { attributes: true });
  }

  search(query, hass) {
    if (!query) {
      this.filteredEntities = [];
      this.render(hass);
      return;
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    this.filteredEntities = this.entities.filter(entity => {
      // Check if all search terms are found in entity_id, name, area, or domain
      return searchTerms.every(term => 
        entity.entity_id.toLowerCase().includes(term) ||
        entity.name.toLowerCase().includes(term) ||
        entity.area.toLowerCase().includes(term) ||
        entity.domain.toLowerCase().includes(term)
      );
    });
    
    // Limit results
    this.filteredEntities = this.filteredEntities.slice(0, this.config.max_results);
    
    this.render(hass);
  }

  handleSearchInput(e, hass) {
    const query = e.target.value;
    
    // Debounce search to avoid excessive rendering
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.search(query, hass);
    }, 150);
  }

  handleEntityClick(entityId, hass) {
    // Show more-info dialog for the entity
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  render(hass, isLoading = false) {
    if (!hass) return;

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
      
      .no-results, .loading {
        padding: 20px 0;
        text-align: center;
        color: var(--secondary-text-color);
        font-style: italic;
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
              @input="${e => this.handleSearchInput(e, hass)}"
            >
          </div>
          
          <div class="results">
            ${isLoading ? `
              <div class="loading">Daten werden geladen...</div>
            ` : this.renderResults(hass)}
          </div>
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
        item.addEventListener('click', () => this.handleEntityClick(entityId, hass));
      });
    }
  }
  
  renderResults(hass) {
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
