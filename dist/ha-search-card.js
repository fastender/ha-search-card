import { LitElement, html, css } from 'lit-element';

class HaSearchCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      searchQuery: { type: String },
    };
  }

  constructor() {
    super();
    this.searchQuery = "";
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 16px;
        font-family: var(--ha-card-font-family, sans-serif);
        background-color: var(--card-background-color, #fff);
        color: var(--primary-text-color, #000);
      }
      .search-input {
        width: 100%;
        padding: 8px;
        margin-bottom: 16px;
        box-sizing: border-box;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 4px;
      }
      .entity-item {
        padding: 8px;
        border-bottom: 1px solid var(--divider-color, #ccc);
        cursor: pointer;
      }
      .entity-item:hover {
        background-color: var(--secondary-background-color, #f5f5f5);
      }
      @media (max-width: 600px) {
        :host {
          padding: 8px;
        }
        .search-input {
          padding: 6px;
        }
        .entity-item {
          padding: 6px;
        }
      }
    `;
  }

  render() {
    // Falls noch keine Daten vorhanden sind, gib einfach einen leeren Container aus
    const states = this.hass ? this.hass.states : {};
    const results = this.filterEntities(states);

    return html`
      <input
        type="text"
        class="search-input"
        placeholder="Suche Entitäten..."
        .value=${this.searchQuery}
        @input=${this.handleInput}
      />
      <div class="results">
        ${Object.keys(results).length === 0
          ? html`<div>Keine Ergebnisse gefunden.</div>`
          : Object.keys(results).map(
              (entityId) => html`
                <div class="entity-item" @click=${() =>
                  this.openEntity(results[entityId])}>
                  <strong>${entityId}</strong> – ${results[entityId].attributes.friendly_name || 'Ohne Namen'}
                </div>
              `
            )}
      </div>
    `;
  }

  handleInput(e) {
    this.searchQuery = e.target.value.toLowerCase();
  }

  filterEntities(entities) {
    if (!entities) return {};
    const filtered = {};
    Object.keys(entities).forEach((entityId) => {
      const entity = entities[entityId];
      const friendlyName = entity.attributes.friendly_name ? entity.attributes.friendly_name.toLowerCase() : "";
      // Suche sowohl im Entitätsnamen als auch in der ID
      if (
        entityId.toLowerCase().includes(this.searchQuery) ||
        friendlyName.includes(this.searchQuery)
      ) {
        filtered[entityId] = entity;
      }
    });
    return filtered;
  }

  openEntity(entity) {
    // Hier könntest Du z. B. eine Detailansicht öffnen oder eine Aktion auslösen.
    // Zum Beispiel: this.fireEvent('hass-more-info', { entityId: entity.entity_id });
    // Für den Moment loggen wir nur das ausgewählte Element:
    console.log("Ausgewählte Entität:", entity);
  }
}

customElements.define('ha-search-card', HaSearchCard);
