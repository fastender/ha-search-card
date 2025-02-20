if(!customElements.get("ha-search-card")) {
  class HASearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.searchTerm = "";
      this.entities = null;
      this.pageSize = 12;
    }

    setConfig(config) {
      this.config = config;
    }

    set hass(hass) {
      const firstSet = !this._hass;
      this._hass = hass;
      
      if (firstSet) {
        this.initializeCard();
        this.loadData();
      } else if (this.entities) {
        // Nur Status-Updates durchführen
        this.updateEntityStates();
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
          display: flex;
          align-items: center;
        }
        .entity-card:hover {
          background: var(--primary-color);
          color: var(--text-primary-color);
        }
        .entity-name {
          margin-left: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .area-header {
          grid-column: 1/-1;
          padding: 8px;
          margin-top: 8px;
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
      
      // Debounce für die Suche
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchTerm = e.target.value;
          this.updateResults();
        }, 150);
      });

      this.resultsContainer = document.createElement("div");
      this.resultsContainer.className = "results-grid";

      content.appendChild(searchInput);
      content.appendChild(this.resultsContainer);
      this.shadowRoot.appendChild(style);
      card.appendChild(content);
      this.shadowRoot.appendChild(card);
    }

    async loadData() {
      try {
        const entityIds = Object.keys(this._hass.states);
        const areaReg = await this._hass.callWS({ type: "config/area_registry/list" });
        const deviceReg = await this._hass.callWS({ type: "config/device_registry/list" });
        const entityReg = await this._hass.callWS({ type: "config/entity_registry/list" });

        // Erstelle Lookup-Maps für schnelleren Zugriff
        const deviceAreaMap = {};
        deviceReg.forEach(device => {
          if (device.area_id) {
            deviceAreaMap[device.id] = device.area_id;
          }
        });

        const entityInfoMap = {};
        entityReg.forEach(entity => {
          entityInfoMap[entity.entity_id] = {
            areaId: entity.area_id || (entity.device_id ? deviceAreaMap[entity.device_id] : null)
          };
        });

        const areaMap = {};
        areaReg.forEach(area => {
          areaMap[area.area_id] = area.name;
        });

        // Einmalige Transformation der Entities
        this.entities = entityIds.map(id => {
          const state = this._hass.states[id];
          const info = entityInfoMap[id] || {};
          return {
            id,
            name: state.attributes.friendly_name || id,
            type: id.split('.')[0],
            state: state.state,
            areaId: info.areaId,
            areaName: info.areaId ? areaMap[info.areaId] : null
          };
        });

        this.updateResults();
      } catch (error) {
        console.error("Fehler beim Laden der Daten:", error);
      }
    }

    updateEntityStates() {
      if (!this.entities) return;
      
      let needsUpdate = false;
      this.entities.forEach(entity => {
        const newState = this._hass.states[entity.id]?.state;
        if (newState !== entity.state) {
          entity.state = newState;
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        this.updateResults();
      }
    }

    updateResults() {
      if (!this.resultsContainer || !this.entities) return;

      const searchTerm = this.searchTerm.toLowerCase();
      let results = [];

      if (searchTerm) {
        // Gruppiere nach Areas
        const areaGroups = {};
        const unassigned = [];

        this.entities.forEach(entity => {
          if (entity.name.toLowerCase().includes(searchTerm) ||
              entity.id.toLowerCase().includes(searchTerm) ||
              (entity.areaName && entity.areaName.toLowerCase().includes(searchTerm))) {
            
            if (entity.areaName) {
              areaGroups[entity.areaName] = areaGroups[entity.areaName] || [];
              areaGroups[entity.areaName].push(entity);
            } else {
              unassigned.push(entity);
            }
          }
        });

        // Füge gruppierte Ergebnisse hinzu
        Object.entries(areaGroups).forEach(([areaName, entities]) => {
          results.push({ type: 'header', content: areaName });
          results.push(...entities.map(e => ({ type: 'entity', content: e })));
        });

        // Füge nicht zugewiesene Entities hinzu
        if (unassigned.length) {
          if (results.length) {
            results.push({ type: 'header', content: 'Weitere Ergebnisse' });
          }
          results.push(...unassigned.map(e => ({ type: 'entity', content: e })));
        }
      } else {
        // Zeige initial nur die ersten pageSize Entities
        results = this.entities
          .slice(0, this.pageSize)
          .map(e => ({ type: 'entity', content: e }));
      }

      const html = results.length ? 
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

      // Effizientes DOM-Update
      if (this.resultsContainer.innerHTML !== html) {
        this.resultsContainer.innerHTML = html;
        
        // Event-Listener nur einmal hinzufügen
        this.resultsContainer.querySelectorAll('.entity-card').forEach(card => {
          card.addEventListener('click', () => {
            const entityId = card.dataset.entityId;
            this.dispatchEvent(new CustomEvent("hass-more-info", {
              detail: { entityId },
              bubbles: true,
              composed: true
            }));
          });
        });
      }
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
  }

  customElements.define("ha-search-card", HASearchCard);
}
