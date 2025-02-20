if(!customElements.get("ha-search-card")) {
  class HASearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.searchTerm = "";
      this.entities = null;
      this.areas = null;
      this.pageSize = 12;
    }

    setConfig(config) {
      this.config = config;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this.initialized) {
        this.initialized = true;
        this.initializeCard();
      }
    }

    initializeCard() {
      const card = document.createElement("ha-card");
      const content = document.createElement("div");
      content.className = "card-content";

      const style = document.createElement("style");
      style.textContent = `
        .card-content { padding: 16px; }
        .search-input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          margin-bottom: 16px;
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .entity-card {
          background: var(--card-background-color);
          border-radius: 4px;
          border: 1px solid var(--divider-color);
          padding: 12px;
          cursor: pointer;
        }
        .entity-card:hover {
          border-color: var(--primary-color);
        }
        .entity-name {
          margin-left: 8px;
          font-weight: 500;
        }
        .area-header {
          grid-column: 1/-1;
          margin-top: 16px;
          margin-bottom: 8px;
          padding: 8px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          border-radius: 4px;
          font-weight: bold;
        }
      `;

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "search-input";
      searchInput.placeholder = "Nach Geräten oder Räumen suchen...";
      searchInput.addEventListener("input", (e) => {
        requestAnimationFrame(() => this.handleSearch(e.target.value));
      });

      this.resultsContainer = document.createElement("div");
      this.resultsContainer.className = "results-grid";

      content.appendChild(searchInput);
      content.appendChild(this.resultsContainer);
      this.shadowRoot.appendChild(style);
      card.appendChild(content);
      this.shadowRoot.appendChild(card);
    }

    async loadAreas() {
      if (!this._hass) return;
      
      try {
        // Laden der Areas über die Home Assistant API
        const areaRegistry = await this._hass.callWS({
          type: "config/area_registry/list"
        });
        
        this.areas = areaRegistry.map(area => ({
          id: area.area_id,
          name: area.name
        }));
      } catch (error) {
        console.error("Fehler beim Laden der Areas:", error);
        this.areas = [];
      }
    }

    async loadEntities() {
      if (!this._hass) return;
      
      if (!this.areas) {
        await this.loadAreas();
      }
      
      // Laden der Device Registry
      const deviceRegistry = await this._hass.callWS({
        type: "config/device_registry/list"
      });
      
      // Laden der Entity Registry
      const entityRegistry = await this._hass.callWS({
        type: "config/entity_registry/list"
      });
      
      // Mapping von Devices zu Areas
      const deviceAreaMap = {};
      deviceRegistry.forEach(device => {
        if (device.area_id) {
          deviceAreaMap[device.id] = device.area_id;
        }
      });
      
      // Erstellen der erweiterten Entitätsliste
      this.entities = Object.entries(this._hass.states)
        .map(([id, entity]) => {
          // Finden des Entity Registry Eintrags
          const registryEntry = entityRegistry.find(e => e.entity_id === id);
          let areaId = null;
          
          if (registryEntry) {
            // Direkte Area ID der Entity
            areaId = registryEntry.area_id;
            
            // Wenn keine direkte Area ID, prüfe Device
            if (!areaId && registryEntry.device_id) {
              areaId = deviceAreaMap[registryEntry.device_id];
            }
          }
          
          return {
            id,
            name: entity.attributes.friendly_name || id,
            type: id.split('.')[0],
            state: entity.state,
            areaId,
            areaName: areaId ? this.areas.find(a => a.id === areaId)?.name : null
          };
        });
    }

    async handleSearch(value) {
      this.searchTerm = value;
      if (!this.entities) {
        await this.loadEntities();
      }
      this.updateResults();
    }

    updateResults() {
      if (!this.resultsContainer || !this.entities) return;
      
      let results = [];
      const searchTermLower = this.searchTerm.toLowerCase();
      
      if (this.searchTerm) {
        // Suche nach Areas
        const matchingAreas = this.areas.filter(area => 
          area.name.toLowerCase().includes(searchTermLower)
        );
        
        // Gruppiere Entitäten nach gefundenen Areas
        matchingAreas.forEach(area => {
          const areaEntities = this.entities.filter(entity => 
            entity.areaId === area.id
          );
          
          if (areaEntities.length > 0) {
            results.push({
              type: 'area-header',
              content: area.name
            });
            results.push(...areaEntities.map(entity => ({
              type: 'entity',
              content: entity
            })));
          }
        });
        
        // Suche nach einzelnen Entitäten
        const matchingEntities = this.entities.filter(entity =>
          !results.some(r => r.type === 'entity' && r.content.id === entity.id) && // Vermeiden von Duplikaten
          (entity.name.toLowerCase().includes(searchTermLower) ||
           entity.id.toLowerCase().includes(searchTermLower))
        );
        
        if (matchingEntities.length > 0) {
          if (results.length > 0) {
            results.push({
              type: 'area-header',
              content: 'Weitere Ergebnisse'
            });
          }
          results.push(...matchingEntities.map(entity => ({
            type: 'entity',
            content: entity
          })));
        }
      } else {
        // Zeige die ersten pageSize Entitäten ohne Suche
        results = this.entities
          .slice(0, this.pageSize)
          .map(entity => ({
            type: 'entity',
            content: entity
          }));
      }

      this.resultsContainer.innerHTML = results.length ? 
        results.map(result => {
          if (result.type === 'area-header') {
            return `<div class="area-header">${result.content}</div>`;
          } else {
            const entity = result.content;
            return `
              <div class="entity-card" @click="${() => this.handleEntityClick(entity.id)}">
                <ha-icon icon="${this.getIcon(entity)}"></ha-icon>
                <span class="entity-name">${entity.name}</span>
              </div>
            `;
          }
        }).join('') :
        '<div style="grid-column: 1/-1; text-align: center; padding: 16px;">Keine Ergebnisse</div>';

      // Event-Listener hinzufügen
      this.resultsContainer.querySelectorAll('.entity-card').forEach(card => {
        const entityId = card.getAttribute('@click').match(/'([^']+)'/)[1];
        card.addEventListener('click', () => this.handleEntityClick(entityId));
      });
    }

    getIcon(entity) {
      const iconMap = {
        light: entity.state === "on" ? "mdi:lightbulb" : "mdi:lightbulb-outline",
        switch: entity.state === "on" ? "mdi:toggle-switch" : "mdi:toggle-switch-off",
        climate: "mdi:thermostat",
        cover: "mdi:window-shutter"
      };
      return iconMap[entity.type] || "mdi:help-circle";
    }

    handleEntityClick(entityId) {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true
      }));
    }
  }

  customElements.define("ha-search-card", HASearchCard);
}
