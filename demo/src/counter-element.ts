import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * A simple counter component to test HMR.
 * Try editing the styles, text, or render method while the dev server is running!
 */
@customElement('counter-element')
export class CounterElement extends LitElement {
  @property({ type: Number })
  count = 0;

  render() {
    return html`
      <div class="counter-container">
        <h2>HMR Test Counter</h2>
        <p>Count: <strong>${this.count}</strong></p>
        <div class="button-group">
          <button @click=${this._decrement}>-</button>
          <button @click=${this._reset}>Reset</button>
          <button @click=${this._increment}>+</button>
        </div>
        <p class="hint">
          💡 Try editing this component's styles or text while the dev server is running!
        </p>
      </div>
    `;
  }

  private _increment() {
    this.count++;
  }

  private _decrement() {
    this.count--;
  }

  private _reset() {
    this.count = 0;
  }

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      border: 2px solid #646cff;
      border-radius: 8px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      margin: 1rem 0;
    }

    .counter-container {
      text-align: center;
    }

    h2 {
      color: #646cff;
      margin-top: 0;
      font-size: 2em;
    }

    p {
      font-size: 1.2em;
      color: #fff;
    }

    strong {
      color: #4ade80;
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
      border: 2px solid #646cff;
      border-radius: 6px;
      background: #1a1a1a;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover {
      background: #646cff;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
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
    'counter-element': CounterElement;
  }
}
