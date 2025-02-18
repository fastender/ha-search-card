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
    }

    setConfig(config) {
      this.config = {
        pageSize: 20,
        ...config
      };
    }

    set hass(hass) {
      this._hass = hass;
      if (!this.initialized) {
        this.initialized = true;
        this.initializeCard();
        this.loadEntities();
      }
      this.updateEntityStates();
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
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .entity-card {
          background: var(--card-background-color);
          border-radius: 4px;
          border: 1px solid var(--divider-color);
          padding: 16px;
          cursor: pointer;
          transition: box-shadow 0.3s ease;
        }
        .entity-card:hover {
          box-shadow: var(--shadow-elevation-4dp);
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
          color: var(--secondary-text-color);
        }
        .debug-info {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
          word-break: break-all;
        }
      `;

      const searchContainer = document.createElement("div");
      searchContainer.className = "search-container";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "search-input";
      searchInput.placeholder = "Suche nach Entitäten...";
      searchInput.addEventListener("input", (e) => {
        this.searchTerm = e.target.value;
        this.updateResults();
      });

      searchContainer.appendChild(searchInput);
      this.resultsContainer = document.createElement("div");
      this.resultsContainer.className = "results-grid";

      content.appendChild(searchContainer);
      content.appendChild(this.resultsContainer);

      this.shadowRoot.appendChild(style);
      card.appendChild(content);
      this.shadowRoot.appendChild(card);
    }

    loadEntities() {
      if (!this._hass) return;

      console.log("Loading entities...");
      
      this.entities = Object.entries(this._hass.states)
        .map(([entityId, entity]) => {
          // Debug logging
          console.log(`Processing entity: ${entityId}`);
          console.log("Entity data:", entity);

          return {
            id: entityId,
            name: entity.attributes.friendly_name || entityId,
            state: entity.state,
            type: entityId.split(".")[0],
            area: entity.attributes.area || "",
            room: entity.attributes.room || "",
            areaId: entity.attributes.area_id || "",
            rawAttributes: entity.attributes
          };
        })
        .filter(entity => entity !== null);

      console.log("Loaded entities:", this.entities.length);
      this.updateResults();
    }

    updateResults() {
      if (!this.resultsContainer) return;

      console.log("Updating results with search term:", this.searchTerm);

      const filteredEntities = this.entities.filter(entity => {
        const searchString = `${entity.name} ${entity.type} ${entity.area} ${entity.room} ${entity.id}`.toLowerCase();
        const matches = this.searchTerm.toLowerCase().split(" ").every(term => searchString.includes(term));
        
        // Debug logging
        console.log(`Entity ${entity.id} search string: ${searchString}`);
        console.log(`Matches search: ${matches}`);
        
        return matches;
      });

      console.log("Filtered entities:", filteredEntities.length);

      this.resultsContainer.innerHTML = "";

      if (filteredEntities.length === 0) {
        this.resultsContainer.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 16px;">
            Keine Ergebnisse gefunden für "${this.searchTerm}"
          </div>
        `;
        return;
      }

      filteredEntities.forEach(entity => {
        const card = document.createElement("div");
        card.className = "entity-card";
        
        card.innerHTML = `
          <div class="entity-header">
            <ha-icon icon="${this.getEntityIcon(entity.type, entity.state)}"></ha-icon>
            <span class="entity-name">${entity.name}</span>
          </div>
          <div class="entity-state">${entity.state}</div>
          <div class="debug-info">
            ID: ${entity.id}<br>
            Type: ${entity.type}<br>
            Area: ${entity.area}<br>
            Room: ${entity.room}<br>
            Area ID: ${entity.areaId}
          </div>
        `;

        card.addEventListener("click", () => {
          this.handleEntityClick(entity.id);
        });

        this.resultsContainer.appendChild(card);
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

    getCardSize() {
      return 3;
    }
  }

  customElements.define("ha-search-card", HASearchCard);
  console.info("%c HA-SEARCH-CARD %c Debug Version ", "color: white; background: blue; font-weight: 700;", "color: blue; background: white; font-weight: 700;");
}
