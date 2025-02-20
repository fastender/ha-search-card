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
      // Debug-Ausgabe
      console.log("HASS wurde gesetzt:", !!this._hass);
      
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
        .area-header {
          grid-column: 1/-1;
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
        // Debug-Ausgabe
        console.log("Suche nach:", e.target.value);
        this.handleSearch(e.target.value);
      });

      this.resultsContainer = document.createElement("div");
      this.resultsContainer.className = "results-grid";

      content.appendChild(searchInput);
      content.appendChild(this.resultsContainer);
      this.shadowRoot.appendChild(style);
      card.appendChild(content);
      this.shadowRoot.appendChild(card);

      // Initial alle Entities laden
      this.loadEntities();
    }

    async loadEntities() {
      if (!this._hass) {
        console.log("HASS ist nicht verfügbar!");
        return;
      }

      try {
        // Debug: Verfügbare Entities ausgeben
        console.log("Verfügbare States:", Object.keys(this._hass.states));

        // Zuerst Areas laden
        const areas = await this._hass.callWS({
          type: "config/area_registry/list"
        });
        console.log("Geladene Areas:", areas);
        this.areas = areas;

        // Entities mit Area-Informationen laden
        const entities = Object.entries(this._hass.states).map(([id, state]) => {
          const areaId = this.findAreaForEntity(id);
          return {
            id,
            name: state.attributes.friendly_name || id,
            type: id.split('.')[0],
            state: state.state,
            areaId,
            areaName: areaId ? this.areas.find(a => a.area_id === areaId)?.name : null
          };
        });

        this.entities = entities;
        console.log("Geladene Entities:", this.entities);
        
        // Initial Ergebnisse anzeigen
        this.updateResults();
      } catch (error) {
        console.error("Fehler beim Laden der Daten:", error);
      }
    }

    findAreaForEntity(entityId) {
      // Vereinfachte Version - später erweitern
      return null;
    }

    handleSearch(value) {
      this.searchTerm = value;
      this.updateResults();
    }

    updateResults() {
      if (!this.resultsContainer || !this.entities) {
        console.log("Container oder Entities nicht verfügbar");
        return;
      }

      const searchTerm = this.searchTerm.toLowerCase();
      let results = [];

      // Nach Areas und Entities filtern
      if (searchTerm) {
        // Areas durchsuchen
        const matchingAreas = this.areas?.filter(area => 
          area.name.toLowerCase().includes(searchTerm)
        ) || [];

        // Für jede gefundene Area die zugehörigen Entities anzeigen
        matchingAreas.forEach(area => {
          const areaEntities = this.entities.filter(e => e.areaId === area.area_id);
          if (areaEntities.length) {
            results.push({ type: 'header', content: area.name });
            results.push(...areaEntities.map(e => ({ type: 'entity', content: e })));
          }
        });

        // Auch nach Entities suchen
        const matchingEntities = this.entities.filter(entity =>
          entity.name.toLowerCase().includes(searchTerm) ||
          entity.id.toLowerCase().includes(searchTerm)
        );
        
        if (matchingEntities.length) {
          if (results.length) {
            results.push({ type: 'header', content: 'Weitere Ergebnisse' });
          }
          results.push(...matchingEntities.map(e => ({ type: 'entity', content: e })));
        }
      } else {
        // Ohne Suchbegriff die ersten pageSize Entities anzeigen
        results = this.entities
          .slice(0, this.pageSize)
          .map(e => ({ type: 'entity', content: e }));
      }

      // Debug-Ausgabe
      console.log("Gefundene Ergebnisse:", results);

      // Ergebnisse anzeigen
      this.resultsContainer.innerHTML = results.length ? 
        results.map(result => {
          if (result.type === 'header') {
            return `<div class="area-header">${result.content}</div>`;
          }
          const entity = result.content;
          return `
            <div class="entity-card" data-entity-id="${entity.id}">
              <ha-icon icon="${this.getIcon(entity)}"></ha-icon>
              <span class="entity-name">${entity.name}</span>
            </div>
          `;
        }).join('') :
        '<div style="grid-column: 1/-1; text-align: center; padding: 16px;">Keine Ergebnisse gefunden</div>';

      // Click-Handler hinzufügen
      this.resultsContainer.querySelectorAll('.entity-card').forEach(card => {
        card.addEventListener('click', () => {
          const entityId = card.dataset.entityId;
          this.handleEntityClick(entityId);
        });
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
      // Debug-Ausgabe
      console.log("Entity geklickt:", entityId);
      
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true
      }));
    }
  }

  customElements.define("ha-search-card", HASearchCard);
}
