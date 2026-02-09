import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CounterElement } from './counter-element.js';

/**
 * A subclass of CounterElement that overrides the default count value.
 * Used to test that HMR preserves the overridden accessor value
 * and doesn't revert to the base class default.
 */
@customElement('custom-counter')
export class CustomCounter extends CounterElement {
  @property({ type: Number })
  accessor count = 999;

  render() {
    return html`
      <div class="counter-container">
        <h3>Custom Counter (subclass, default=999)</h3>
        <p>Count: <strong>${this.count}</strong></p>
        <div class="button-group">
          <button @click=${this._sub}>-</button>
          <button @click=${this._resetCustom}>Reset to 999</button>
          <button @click=${this._add}>+</button>
        </div>
        <p class="hint">
          Edit this template to test HMR — the count value should persist!
        </p>
      </div>
    `;
  }

  private _add() {
    this.count++;
  }

  private _sub() {
    this.count--;
  }

  private _resetCustom() {
    this.count = 999;
  }

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      border: 2px solid #ff6464;
      border-radius: 8px;
      background: linear-gradient(135deg, #2e1a1a 0%, #3e1621 100%);
      margin: 1rem 0;
    }

    .counter-container {
      text-align: center;
    }

    h3 {
      color: #ff6464;
      margin-top: 0;
    }

    p {
      font-size: 1.2em;
      color: #fff;
    }

    strong {
      color: #ffb347;
      font-size: 1.5em;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin: 1.5rem 0;
    }

    button {
      padding: 0.8rem 1.5rem;
      font-size: 1.1em;
      font-weight: bold;
      border: 2px solid #ff6464;
      border-radius: 6px;
      background: #1a1a1a;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover {
      background: #ff6464;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 100, 100, 0.4);
    }

    button:active {
      transform: translateY(0);
    }

    .hint {
      margin-top: 1.5rem;
      font-size: 0.9em;
      color: #888;
      font-style: italic;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'custom-counter': CustomCounter;
  }
}
