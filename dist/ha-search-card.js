if(!customElements.get("ha-search-card")) {
  class HASearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.searchTerm = "";
      this.entities = null;  // Lazy loading
      this.pageSize = 12;    // Reduzierte initiale Anzahl
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
      `;

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "search-input";
      searchInput.placeholder = "Suchen...";
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

    handleSearch(value) {
      this.searchTerm = value;
      if (!this.entities) {
        this.loadEntities();
      }
      this.updateResults();
    }

    loadEntities() {
      if (!this._hass) return;
      
      // Nur die wichtigsten Entitätstypen initial laden
      const priorityTypes = ['light', 'switch', 'climate', 'cover'];
      
      this.entities = Object.entries(this._hass.states)
        .filter(([id]) => priorityTypes.some(type => id.startsWith(type + '.')))
        .map(([id, entity]) => ({
          id,
          name: entity.attributes.friendly_name || id,
          type: id.split('.')[0],
          state: entity.state
        }));
    }

    updateResults() {
      if (!this.resultsContainer || !this.entities) return;
      
      const results = this.searchTerm ? 
        this.entities.filter(entity => 
          entity.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          entity.id.toLowerCase().includes(this.searchTerm.toLowerCase())
        ) : 
        this.entities.slice(0, this.pageSize);

      this.resultsContainer.innerHTML = results.length ? 
        results.slice(0, this.pageSize).map(entity => `
          <div class="entity-card" @click="${() => this.handleEntityClick(entity.id)}">
            <ha-icon icon="${this.getIcon(entity)}"></ha-icon>
            <span class="entity-name">${entity.name}</span>
          </div>
        `).join('') :
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
