// Fügen Sie diesen Code am Anfang der Klasse HASearchCard hinzu
class HASearchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.searchTerm = "";
    this.entities = [];
    this.pageSize = 20;
    this.currentPage = 0;
    this.debouncedSearch = this.debounce(this.updateResults.bind(this), 300);
    // Lade gespeicherte Nutzungsstatistiken
    this.usageStats = this.loadUsageStats();
  }

  // Nutzungsstatistiken laden
  loadUsageStats() {
    try {
      const stats = localStorage.getItem('ha-search-card-usage');
      return stats ? JSON.parse(stats) : {};
    } catch (e) {
      console.warn('Could not load usage stats:', e);
      return {};
    }
  }

  // Nutzungsstatistiken speichern
  saveUsageStats() {
    try {
      localStorage.setItem('ha-search-card-usage', JSON.stringify(this.usageStats));
    } catch (e) {
      console.warn('Could not save usage stats:', e);
    }
  }

  // Nutzung einer Entität tracken
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

  // Score für eine Entität berechnen
  calculateEntityScore(entity) {
    const stats = this.usageStats[entity.id] || { count: 0, lastUsed: 0 };
    const now = Date.now();
    const daysSinceLastUse = (now - stats.lastUsed) / (1000 * 60 * 60 * 24);
    
    // Gewichtung basierend auf verschiedenen Faktoren
    const usageScore = stats.count * 10;  // Häufigkeit der Nutzung
    const recencyScore = Math.max(0, 100 - daysSinceLastUse);  // Aktualität
    const roomMatchScore = this.searchTerm.toLowerCase().includes(entity.room.toLowerCase()) ? 50 : 0;
    const nameMatchScore = entity.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ? 30 : 0;
    
    return usageScore + recencyScore + roomMatchScore + nameMatchScore;
  }

  // Überschreiben der updateResults Methode
  updateResults() {
    if (!this.resultsContainer) return;

    const searchTerms = this.searchTerm.toLowerCase().split(' ');
    
    // Erweiterte Filterung mit Multi-Term-Suche
    const filteredEntities = this.entities.filter(entity => {
      const searchString = `${entity.name} ${entity.room} ${entity.type} ${entity.id}`.toLowerCase();
      return searchTerms.every(term => searchString.includes(term));
    });

    // Sortierung nach Score
    const scoredEntities = filteredEntities.map(entity => ({
      ...entity,
      score: this.calculateEntityScore(entity)
    })).sort((a, b) => b.score - a.score);

    this.resultsContainer.innerHTML = "";

    if (scoredEntities.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 16px; color: var(--secondary-text-color);">
          No results found for "${this.searchTerm}"
        </div>
      `;
      return;
    }

    // Nur die aktuelle Seite anzeigen
    const startIndex = this.currentPage * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const entitiesToShow = scoredEntities.slice(startIndex, endIndex);

    entitiesToShow.forEach(entity => {
      const card = document.createElement("div");
      card.className = "entity-card";
      card.dataset.entityId = entity.id;
      
      // Zeige häufig verwendete Entitäten mit einem speziellen Indikator
      const usageInfo = this.usageStats[entity.id];
      const isFrequentlyUsed = usageInfo && usageInfo.count > 5;
      
      card.innerHTML = `
        <div class="entity-header">
          <ha-icon icon="${this.getEntityIcon(entity.type, entity.state)}"></ha-icon>
          <span class="entity-name">
            ${entity.name}
            ${isFrequentlyUsed ? '<span class="frequently-used">★</span>' : ''}
          </span>
        </div>
        <div class="entity-state">${entity.state}</div>
        <div class="tags">
          <span class="tag">${entity.room}</span>
          <span class="tag">${entity.type}</span>
          ${usageInfo ? `<span class="usage-tag">Used ${usageInfo.count}x</span>` : ''}
        </div>
      `;

      card.addEventListener("click", () => {
        this.trackEntityUsage(entity.id);
        this.handleEntityClick(entity.id);
      });

      this.resultsContainer.appendChild(card);
    });

    // "Mehr laden" Button
    if (endIndex < scoredEntities.length) {
      const loadMoreButton = document.createElement("button");
      loadMoreButton.className = "load-more";
      loadMoreButton.textContent = `Load more (${scoredEntities.length - endIndex} remaining)`;
      loadMoreButton.addEventListener("click", () => {
        this.currentPage++;
        this.updateResults();
      });
      this.resultsContainer.appendChild(loadMoreButton);
    }
  }

  // Fügen Sie diese CSS-Styles zu Ihren bestehenden Styles hinzu
  static get styles() {
    return `
      ${super.styles}
      .frequently-used {
        color: var(--primary-color);
        margin-left: 4px;
      }
      .usage-tag {
        background: var(--primary-color);
        opacity: 0.7;
        color: var(--text-primary-color);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
      }
    `;
  }
}




if(!customElements.get("ha-search-card")) {
  class HASearchCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.searchTerm = "";
      this.entities = [];
      this.pageSize = 20; // Anzahl der Entitäten pro Seite
      this.currentPage = 0;
      this.debouncedSearch = this.debounce(this.updateResults.bind(this), 300);
    }

    // Debounce-Funktion für die Suche
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
        // Lazy Loading der Entitäten
        requestAnimationFrame(() => this.loadEntities());
      } else {
        this._hass = hass;
        this.updateEntityStates();
      }
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
        .load-more {
          width: 100%;
          padding: 8px;
          margin-top: 16px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
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
      searchInput.placeholder = "Suche nach Bereichen oder Geräten...";
      
      searchInput.addEventListener("input", (e) => {
        this.searchTerm = e.target.value;
        this.currentPage = 0;
        this.debouncedSearch();
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

      // Filtern der Entitäten nach definierten Bereichen
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
              room: room
            };
          }
          return null;
        })
        .filter(entity => entity !== null) // Entferne alle Entitäten ohne Bereich
        .sort((a, b) => {
          // Erst nach Raum, dann nach Namen sortieren
          const roomCompare = a.room.localeCompare(b.room);
          return roomCompare !== 0 ? roomCompare : a.name.localeCompare(b.name);
        });

      this.updateResults();
    }

    updateEntityStates() {
      // Nur die sichtbaren Entitäten aktualisieren
      const visibleEntities = this.resultsContainer.querySelectorAll('.entity-card');
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
      
      // Filtern nach Suchbegriffen
      const filteredEntities = this.entities.filter(entity => {
        const searchString = `${entity.name} ${entity.room} ${entity.type}`.toLowerCase();
        return searchTerms.every(term => searchString.includes(term));
      });

      this.resultsContainer.innerHTML = "";

      if (filteredEntities.length === 0) {
        this.resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 16px; color: var(--secondary-text-color);">
            Keine Ergebnisse gefunden für "${this.searchTerm}"
          </div>
        `;
        return;
      }

      // Gruppiere Ergebnisse nach Raum
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
          
          card.innerHTML = `
            <div class="entity-header">
              <ha-icon icon="${this.getEntityIcon(entity.type, entity.state)}"></ha-icon>
              <span class="entity-name">${entity.name}</span>
            </div>
            <div class="entity-state">${entity.state}</div>
          `;

          card.addEventListener("click", () => {
            this.handleEntityClick(entity.id);
          });

          roomGrid.appendChild(card);
        });

        this.resultsContainer.appendChild(roomGrid);
      });
    }

      // Nur die aktuelle Seite anzeigen
      const startIndex = this.currentPage * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      const entitiesToShow = filteredEntities.slice(startIndex, endIndex);

      entitiesToShow.forEach(entity => {
        const card = document.createElement("div");
        card.className = "entity-card";
        card.dataset.entityId = entity.id;
        
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

      // "Mehr laden" Button hinzufügen, wenn es weitere Entitäten gibt
      if (endIndex < filteredEntities.length) {
        const loadMoreButton = document.createElement("button");
        loadMoreButton.className = "load-more";
        loadMoreButton.textContent = `Load more (${filteredEntities.length - endIndex} remaining)`;
        loadMoreButton.addEventListener("click", () => {
          this.currentPage++;
          this.updateResults();
        });
        this.resultsContainer.appendChild(loadMoreButton);
      }
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
