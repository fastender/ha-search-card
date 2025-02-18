if(!customElements.get("ha-search-card")) {
  class HASearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.searchTerm = "";
      this.entities = [];
      this.pageSize = 20;
      this.currentPage = 0;
      this.debouncedSearch = this.debounce(this.updateResults.bind(this), 300);
      this.usageStats = this.loadUsageStats();
    }

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    loadUsageStats() {
      try {
        const stats = localStorage.getItem('ha-search-card-usage');
        return stats ? JSON.parse(stats) : {};
      } catch (e) {
        console.warn('Could not load usage stats:', e);
        return {};
      }
    }

    saveUsageStats() {
      try {
        localStorage.setItem('ha-search-card-usage', JSON.stringify(this.usageStats));
      } catch (e) {
        console.warn('Could not save usage stats:', e);
      }
    }

    trackEntityUsage(entityId) {
      const now = Date.now();
      if (!this.usageStats[entityId]) {
        this.usageStats[entityId] = {
          count: 0,
          lastUsed: now,
          room: this.entities.find(e => e.id === entityId)?.room
        };
      }
      this.usageStats[entityId].count += 1;
      this.usageStats[entityId].lastUsed = now;
      this.saveUsageStats();
    }

    setConfig(config) {
      this.config = {
        pageSize: 20,
        ...config
      };
      this.pageSize = this.config.pageSize;
    }

    set hass(hass) {
      if (!this._hass) {
        this._hass = hass;
        this.initializeCard();
        requestAnimationFrame(() => this.loadEntities());
      } else {
        this._hass = hass;
        this.updateEntityStates();
      }
    }

    initializeCard() {
      const card = document.createElement("ha-card");
      card.header = "Entitäten Suche";

      const content = document.createElement("div");
      content.className = "card-content";

      const style = document.createElement("style");
      style.textContent = `
        .card-content {
          padding: 16px;
        }
        .search-container {
          position: relative;
          margin-bottom: 16px;
        }
        .search-input {
          width: 100%;
          padding: 8px 32px 8px 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #000);
          font-size: 16px;
        }
        .room-header {
          font-size: 18px;
          font-weight: 500;
          margin: 24px 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color);
          color: var(--primary-text-color);
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .entity-card {
          background: var(--card-background-color, #fff);
          border-radius: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          padding: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .entity-card:hover {
          box-shadow: var(--shadow-elevation-4dp, 0 2px 4px rgba(0,0,0,0.1));
          border-color: var(--primary-color);
        }
        .entity-header {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .entity-name {
          margin-left: 8px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .entity-state {
          color: var(--secondary-text-color, #757575);
          font-size: 0.9em;
        }
        .entity-icon {
          color: var(--primary-color);
        }
        .no-results {
          text-align: center;
          padding: 32px;
          color: var(--secondary-text-color);
          font-style: italic;
        }
        .frequently-used {
          color: var(--primary-color);
          margin-left: 4px;
        }
        .load-more {
          width: 100%;
          padding: 8px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 16px;
        }
        .load-more:hover {
          opacity: 0.9;
        }
      `;

      const searchContainer = document.createElement("div");
      searchContainer.className = "search-container";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "search-input";
      searchInput.placeholder = "Suche nach Räumen oder Geräten...";
      searchInput.addEventListener("input", (e) => {
        this.searchTerm = e.target.value;
        this.currentPage = 0;
        this.debouncedSearch();
      });

      searchContainer.appendChild(searchInput);
      this.resultsContainer = document.createElement("div");
      this.resultsContainer.className = "results-container";

      content.appendChild(searchContainer);
      content.appendChild(this.resultsContainer);

      this.shadowRoot.appendChild(style);
      card.appendChild(content);
      this.shadowRoot.appendChild(card);
    }

    loadEntities() {
      if (!this._hass) return;

      this.entities = Object.entries(this._hass.states)
        .map(([entityId, entity]) => {
          // Prüfen ob die Entität einen Bereich hat
          const areaId = entity.attributes.area_id;
          const area = areaId ? this._hass.areas?.[areaId] : null;
          const room = area?.name || entity.attributes.room;

          // Nur Entitäten mit definiertem Bereich zurückgeben
          if (room) {
            return {
              id: entityId,
              name: entity.attributes.friendly_name || entityId,
              state: entity.state,
              type: entityId.split(".")[0],
              room: room,
              icon: entity.attributes.icon
            };
          }
          return null;
        })
        .filter(entity => entity !== null)
        .sort((a, b) => {
          // Erst nach Raum, dann nach Namen sortieren
          const roomCompare = a.room.localeCompare(b.room);
          return roomCompare !== 0 ? roomCompare : a.name.localeCompare(b.name);
        });

      this.updateResults();
    }

    updateEntityStates() {
      const visibleEntities = this.shadowRoot.querySelectorAll('.entity-card');
      visibleEntities.forEach(card => {
        const entityId = card.dataset.entityId;
        if (entityId && this._hass.states[entityId]) {
          const entity = this._hass.states[entityId];
          const stateEl = card.querySelector('.entity-state');
          if (stateEl) {
            stateEl.textContent = entity.state;
          }
        }
      });
    }

    updateResults() {
      if (!this.resultsContainer) return;

      const searchTerms = this.searchTerm.toLowerCase().split(' ');
      
      const filteredEntities = this.entities.filter(entity => {
        const searchString = `${entity.name} ${entity.room} ${entity.type}`.toLowerCase();
        return searchTerms.every(term => searchString.includes(term));
      });

      this.resultsContainer.innerHTML = "";

      if (filteredEntities.length === 0) {
        this.resultsContainer.innerHTML = `
          <div class="no-results">
            Keine Ergebnisse gefunden für "${this.searchTerm}"
          </div>
        `;
        return;
      }

      // Gruppiere nach Raum
      const groupedEntities = filteredEntities.reduce((groups, entity) => {
        const room = entity.room;
        if (!groups[room]) {
          groups[room] = [];
        }
        groups[room].push(entity);
        return groups;
      }, {});

      // Zeige Ergebnisse gruppiert nach Raum
      Object.entries(groupedEntities).forEach(([room, entities]) => {
        const roomHeader = document.createElement("div");
        roomHeader.className = "room-header";
        roomHeader.textContent = room;
        this.resultsContainer.appendChild(roomHeader);

        const roomGrid = document.createElement("div");
        roomGrid.className = "results-grid";

        entities.forEach(entity => {
          const card = document.createElement("div");
          card.className = "entity-card";
          card.dataset.entityId = entity.id;
          
          const usageInfo = this.usageStats[entity.id];
          const isFrequentlyUsed = usageInfo && usageInfo.count > 5;

          card.innerHTML = `
            <div class="entity-header">
              <ha-icon class="entity-icon" icon="${entity.icon || this.getEntityIcon(entity.type, entity.state)}"></ha-icon>
              <span class="entity-name">
                ${entity.name}
                ${isFrequentlyUsed ? '<span class="frequently-used">★</span>' : ''}
              </span>
            </div>
            <div class="entity-state">${entity.state}</div>
          `;

          card.addEventListener("click", () => {
            this.trackEntityUsage(entity.id);
            this.handleEntityClick(entity.id);
          });

          roomGrid.appendChild(card);
        });

        this.resultsContainer.appendChild(roomGrid);
      });
    }

    getEntityIcon(type, state) {
      const iconMap = {
        light: state === "on" ? "mdi:lightbulb" : "mdi:lightbulb-outline",
        switch: state === "on" ? "mdi:toggle-switch" : "mdi:toggle-switch-off",
        sensor: "mdi:thermometer",
        binary_sensor: "mdi:eye",
        climate: "mdi:thermostat",
        media_player: "mdi:cast",
        camera: "mdi:video",
        cover: "mdi:window-shutter",
      };

      return iconMap[type] || "mdi:help-circle";
    }

    handleEntityClick(entityId) {
      const event = new CustomEvent("hass-more-info", {
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

  customElements.define("ha-search-card", HASearchCard);
  console.info("%c HA-SEARCH-CARD %c Version 1.2.0 ", "color: white; background: blue; font-weight: 700;", "color: blue; background: white; font-weight: 700;");
}
