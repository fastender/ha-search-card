class HASearchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.entities = [];
    this.filteredEntities = [];
    this.areas = {};
    this.domains = new Set();
    this._initialized = false;
    this.activeFilters = {
      domain: null,
      area: null
    };
    this.sortOption = 'name'; // Default sort by name
    this.darkMode = false;
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
    this.domains = new Set();
    
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
      const domain = entity.entity_id.split('.')[0];
      
      // Add domain to the set of available domains
      this.domains.add(domain);
      
      // Add to entities array
      this.entities.push({
        entity_id: entity.entity_id,
        name: entity.name || stateObj.attributes.friendly_name || entity.entity_id,
        state: stateObj.state,
        icon: stateObj.attributes.icon,
        area: this.areas[areaId] || 'Unknown',
        area_id: areaId,
        domain: domain
      });
    });
    
    // Default sort by name
    this._sortEntities();
    
    console.log('[ha-search-card] Loaded', this.entities.length, 'entities with area assignments');
  }
  
  _sortEntities() {
    // Sort entities based on current sort option
    switch(this.sortOption) {
      case 'name':
        this.entities.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'domain':
        this.entities.sort((a, b) => {
          if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
          return a.name.localeCompare(b.name);
        });
        break;
      case 'area':
        this.entities.sort((a, b) => {
          if (a.area !== b.area) return a.area.localeCompare(b.area);
          return a.name.localeCompare(b.name);
        });
        break;
      case 'state':
        this.entities.sort((a, b) => {
          if (a.state !== b.state) return a.state.localeCompare(b.state);
          return a.name.localeCompare(b.name);
        });
        break;
    }
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
      max_results: 30,
      show_area_filters: true,
      show_domain_filters: true,
      group_by: null, // null, 'domain', 'area'
      default_sort: 'name',
      ...config
    };
    
    // Set sort option from config
    this.sortOption = this.config.default_sort;
    
    // Detect dark mode from Home Assistant theme
    this._detectDarkMode();
    
    // Initial render with config
    this._render();
  }

  _detectDarkMode() {
    // Try to detect dark mode from Home Assistant theme
    if (document.body.querySelector('home-assistant')) {
      const computedStyle = getComputedStyle(document.body);
      const backgroundColor = computedStyle.getPropertyValue('--primary-background-color').trim();
      
      // Simple heuristic: if background is dark, assume dark mode
      if (backgroundColor) {
        // Convert rgb/rgba to hex
        const rgb = backgroundColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (rgb) {
          const r = parseInt(rgb[1]);
          const g = parseInt(rgb[2]);
          const b = parseInt(rgb[3]);
          
          // Calculate brightness (simple formula)
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          this.darkMode = brightness < 128;
        }
      }
    }
    
    console.log('[ha-search-card] Dark mode detection:', this.darkMode);
  }

  static getStubConfig() {
    return {
      title: 'Entity Search',
      icon: 'mdi:magnify',
      max_results: 30,
      show_area_filters: true,
      show_domain_filters: true,
      group_by: null,
      default_sort: 'name'
    };
  }
  
  _setupEventListeners() {
    // Find search input
    const searchInput = this.shadowRoot.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => this._handleSearchInput(e));
    }
    
    // Set up domain filter buttons
    this.shadowRoot.querySelectorAll('.domain-filter').forEach(button => {
      button.addEventListener('click', () => {
        const domain = button.getAttribute('data-domain');
        this._handleDomainFilter(domain);
      });
    });
    
    // Set up area filter buttons
    this.shadowRoot.querySelectorAll('.area-filter').forEach(button => {
      button.addEventListener('click', () => {
        const area = button.getAttribute('data-area');
        this._handleAreaFilter(area);
      });
    });
    
    // Set up sort options
    const sortSelect = this.shadowRoot.querySelector('.sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        this.sortOption = e.target.value;
        this._sortEntities();
        this._search(this.shadowRoot.querySelector('.search-input')?.value || '');
      });
    }
    
    // Set up group by options
    const groupBySelect = this.shadowRoot.querySelector('.group-by-select');
    if (groupBySelect) {
      groupBySelect.addEventListener('change', e => {
        this.config.group_by = e.target.value === 'none' ? null : e.target.value;
        this._renderResults();
      });
    }
    
    console.log('[ha-search-card] Set up event listeners');
  }
  
  _handleSearchInput(e) {
    const query = e.target.value;
    console.log('[ha-search-card] Search input:', query);
    this._search(query);
  }
  
  _handleDomainFilter(domain) {
    // Toggle domain filter
    if (this.activeFilters.domain === domain) {
      this.activeFilters.domain = null;
    } else {
      this.activeFilters.domain = domain;
    }
    
    // Update active filter buttons
    this.shadowRoot.querySelectorAll('.domain-filter').forEach(button => {
      const buttonDomain = button.getAttribute('data-domain');
      if (buttonDomain === this.activeFilters.domain) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Re-run search with current query
    const query = this.shadowRoot.querySelector('.search-input')?.value || '';
    this._search(query);
  }
  
  _handleAreaFilter(area) {
    // Toggle area filter
    if (this.activeFilters.area === area) {
      this.activeFilters.area = null;
    } else {
      this.activeFilters.area = area;
    }
    
    // Update active filter buttons
    this.shadowRoot.querySelectorAll('.area-filter').forEach(button => {
      const buttonArea = button.getAttribute('data-area');
      if (buttonArea === this.activeFilters.area) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Re-run search with current query
    const query = this.shadowRoot.querySelector('.search-input')?.value || '';
    this._search(query);
  }
  
  _search(query) {
    // Start with all entities
    let results = [...this.entities];
    
    // Apply domain filter if active
    if (this.activeFilters.domain) {
      results = results.filter(entity => entity.domain === this.activeFilters.domain);
    }
    
    // Apply area filter if active
    if (this.activeFilters.area) {
      results = results.filter(entity => entity.area === this.activeFilters.area);
    }
    
    // Apply search query if provided
    if (query && query.trim() !== '') {
      const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
      
      results = results.filter(entity => {
        return searchTerms.some(term => 
          entity.entity_id.toLowerCase().includes(term) ||
          entity.name.toLowerCase().includes(term) ||
          entity.area.toLowerCase().includes(term) ||
          entity.domain.toLowerCase().includes(term) ||
          entity.state.toLowerCase().includes(term)
        );
      });
    }
    
    console.log('[ha-search-card] Search found', results.length, 'results');
    
    // Limit results if needed
    if (results.length > this.config.max_results) {
      results = results.slice(0, this.config.max_results);
    }
    
    // Store filtered entities
    this.filteredEntities = results;
    
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
        --filter-button-bg: var(--secondary-background-color);
        --filter-button-active-bg: var(--primary-color);
        --filter-button-text: var(--primary-text-color);
        --filter-button-active-text: white;
        --section-heading-color: var(--secondary-text-color);
        --header-height: 40px;
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
        margin-bottom: 12px;
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
      
      .filter-container {
        display: flex;
        flex-direction: column;
        margin-bottom: 16px;
        gap: 8px;
      }
      
      .filter-section {
        display: flex;
        flex-direction: column;
        margin-bottom: 8px;
      }
      
      .filter-section-title {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--section-heading-color);
      }
      
      .filter-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .filter-button {
        padding: 4px 10px;
        background-color: var(--filter-button-bg);
        color: var(--filter-button-text);
        border: none;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
      }
      
      .filter-button ha-icon {
        margin-right: 4px;
        width: 14px;
        height: 14px;
      }
      
      .filter-button.active {
        background-color: var(--filter-button-active-bg);
        color: var(--filter-button-active-text);
      }
      
      .options-bar {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        align-items: center;
      }
      
      .select-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .select-label {
        font-size: 14px;
        color: var(--secondary-text-color);
      }
      
      select {
        padding: 4px 8px;
        background-color: var(--search-background);
        color: var(--search-text-color);
        border: 1px solid var(--search-border-color);
        border-radius: 4px;
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
        margin-bottom: 4px;
      }
      
      .result-item:hover {
        background-color: var(--result-hover);
      }
      
      .entity-icon {
        margin-right: 12px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
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
      
      .group-header {
        font-weight: 500;
        padding: 8px 4px 4px 4px;
        margin-top: 8px;
        border-bottom: 1px solid var(--search-border-color);
        color: var(--primary-color);
        display: flex;
        align-items: center;
      }
      
      .group-header ha-icon {
        margin-right: 8px;
      }
      
      .group-container {
        margin-bottom: 12px;
      }
      
      .domain-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .area-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
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
      
      /* Dark mode specific styles */
      .dark-mode .filter-button {
        background-color: rgba(255, 255, 255, 0.1);
      }
      
      .dark-mode .filter-button.active {
        background-color: var(--primary-color);
      }
      
      .dark-mode .group-header {
        border-bottom-color: rgba(255, 255, 255, 0.1);
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
        
        .filter-buttons {
          gap: 6px;
        }
        
        .filter-button {
          padding: 3px 8px;
          font-size: 11px;
        }
        
        .options-bar {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
      }
    `;
    
    // Prepare domain filter buttons
    let domainFiltersHtml = '';
    if (this.config.show_domain_filters && this.domains.size > 0) {
      const sortedDomains = Array.from(this.domains).sort();
      
      domainFiltersHtml = `
        <div class="filter-section">
          <div class="filter-section-title">Nach Typ filtern</div>
          <div class="filter-buttons">
            ${sortedDomains.map(domain => {
              const isActive = this.activeFilters.domain === domain;
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
              
              const icon = domainIcons[domain] || 'mdi:eye';
              return `
                <button class="filter-button domain-filter ${isActive ? 'active' : ''}" data-domain="${domain}">
                  <ha-icon icon="${icon}"></ha-icon>
                  ${domain}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    // Prepare area filter buttons
    let areaFiltersHtml = '';
    if (this.config.show_area_filters && Object.keys(this.areas).length > 0) {
      const sortedAreas = Object.values(this.areas).sort();
      
      areaFiltersHtml = `
        <div class="filter-section">
          <div class="filter-section-title">Nach Bereich filtern</div>
          <div class="filter-buttons">
            ${sortedAreas.map(area => {
              const isActive = this.activeFilters.area === area;
              return `
                <button class="filter-button area-filter ${isActive ? 'active' : ''}" data-area="${area}">
                  <ha-icon icon="mdi:home-floor-1"></ha-icon>
                  ${area}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    const optionsHtml = `
      <div class="options-bar">
        <div class="select-container">
          <span class="select-label">Sortieren nach:</span>
          <select class="sort-select">
            <option value="name" ${this.sortOption === 'name' ? 'selected' : ''}>Name</option>
            <option value="domain" ${this.sortOption === 'domain' ? 'selected' : ''}>Typ</option>
            <option value="area" ${this.sortOption === 'area' ? 'selected' : ''}>Bereich</option>
            <option value="state" ${this.sortOption === 'state' ? 'selected' : ''}>Status</option>
          </select>
        </div>
        <div class="select-container">
          <span class="select-label">Gruppieren nach:</span>
          <select class="group-by-select">
            <option value="none" ${!this.config.group_by ? 'selected' : ''}>Keine</option>
            <option value="domain" ${this.config.group_by === 'domain' ? 'selected' : ''}>Typ</option>
            <option value="area" ${this.config.group_by === 'area' ? 'selected' : ''}>Bereich</option>
          </select>
        </div>
      </div>
    `;
    
    const cardHtml = `
      <ha-card>
        <div class="card-content">
          <div class="ha-search-card ${this.darkMode ? 'dark-mode' : ''}">
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
            
            <div class="filter-container">
              ${domainFiltersHtml}
              ${areaFiltersHtml}
            </div>
            
            ${optionsHtml}
            
            <div class="results">
              ${isLoading ? 
                `<div class="loading">Daten werden geladen...</div>` : 
                `<div class="no-results">Gib einen Suchbegriff ein oder nutze die Filter, um Entities zu finden</div>`
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
    
    // Show message if no results
    if (this.filteredEntities.length === 0) {
      const searchInput = this.shadowRoot.querySelector('.search-input');
      if (!searchInput || !searchInput.value || searchInput.value.trim() === '') {
        resultsContainer.innerHTML = `<div class="no-results">Gib einen Suchbegriff ein oder nutze die Filter, um Entities zu finden</div>`;
      } else {
        resultsContainer.innerHTML = `<div class="no-results">Keine passenden Entities gefunden</div>`;
      }
      return;
    }
    
    // Handle grouping
    if (this.config.group_by) {
      this._renderGroupedResults(resultsContainer);
    } else {
      this._renderFlatResults(resultsContainer);
    }
    
    // Add click listeners to results
    this.shadowRoot.querySelectorAll('.result-item').forEach(item => {
      const entityId = item.getAttribute('data-entity-id');
      item.addEventListener('click', () => this._handleEntityClick(entityId));
    });
    
    console.log('[ha-search-card] Rendered', this.filteredEntities.length, 'results');
  }
  
  _renderFlatResults(container) {
    // Simple flat list of results
    const resultsHtml = this.filteredEntities.map(entity => this._createEntityHtml(entity)).join('');
    container.innerHTML = resultsHtml;
  }
  
  _createEntityHtml(entity) {
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
  }
  
  _getGroupIcon(groupKey, groupField) {
    if (groupField === 'domain') {
      // Domain icons
      const domainIcons = {
        light: 'mdi:lightbulb-group',
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
        person: 'mdi:account-group',
        device_tracker: 'mdi:crosshairs-gps'
      };
      
      return domainIcons[groupKey] || 'mdi:folder';
    } else if (groupField === 'area') {
      // Area icon
      return 'mdi:home-floor-1';
    }
    
    return 'mdi:folder';
  }
  
  _renderGroupedResults(container) {
    // Group by specified property
    const groupField = this.config.group_by;
    const groups = {};
    
    // Group entities
    this.filteredEntities.forEach(entity => {
      const groupValue = entity[groupField];
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(entity);
    });
    
    // Create HTML for each group
    const sortedGroupKeys = Object.keys(groups).sort();
    let groupedHtml = '';
    
    sortedGroupKeys.forEach(groupKey => {
      const entities = groups[groupKey];
      const groupIcon = this._getGroupIcon(groupKey, groupField);
      
      groupedHtml += `
        <div class="group-container">
          <div class="group-header">
            <ha-icon icon="${groupIcon}"></ha-icon>
            ${groupKey}
          </div>
          ${entities.map(entity => this._createEntityHtml(entity)).join('')}
        </div>
      `;
    });
    
    container.innerHTML = groupedHtml;
