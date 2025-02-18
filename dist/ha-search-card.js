if(!customElements.get("ha-search-card")) {
  class HASearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.searchTerm = "";
      this.entities = [];
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
      this.updateEntities();
    }

    initializeCard() {
      const card = document.createElement("ha-card");
      card.header = "Entity Search";

      const content = document.createElement("div");
      content.className = "card-content";

      const style = document.createElement("style");
      style.textContent = `
        .search-container {
          position: relative;
          margin-bottom: 16px;
        }
        .search-input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #000);
        }
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
      `;

      const searchContainer = document.createElement("div");
      searchContainer.className = "search-container";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "search-input";
      searchInput.placeholder = "Search entities...";
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

    updateEntities() {
      if (!this._hass) return;

      this.entities = Object.entries(this._hass.states).map(([entityId, entity]) => ({
        id: entityId,
        name: entity.attributes.friendly_name || entityId,
        state: entity.state,
        type: entityId.split(".")[0],
        room: entity.attributes.room || "Unassigned"
      }));

      this.updateResults();
    }

    updateResults() {
      if (!this.resultsContainer) return;

      const filteredEntities = this.entities.filter(entity =>
        entity.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        entity.room.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        entity.type.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        entity.id.toLowerCase().includes(this.searchTerm.toLowerCase())
      );

      this.resultsContainer.innerHTML = "";

      if (filteredEntities.length === 0) {
        this.resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 16px; color: var(--secondary-text-color);">
            No results found for "${this.searchTerm}"
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
          <div class="tags">
            <span class="tag">${entity.room}</span>
            <span class="tag">${entity.type}</span>
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

    getCardSize() {
      return 3;
    }
  }

  customElements.define("ha-search-card", HASearchCard);
  console.info("%c SEARCH-CARD %c Version 1.0.0 ", "color: white; background: blue; font-weight: 700;", "color: blue; background: white; font-weight: 700;");
}
