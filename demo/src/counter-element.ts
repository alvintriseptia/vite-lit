import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CounterController } from './counter-controller.ts';
import {
  COUNTER_TITLE,
  COUNTER_HINT_TEXT,
  COLORS,
} from './constants.ts';

/**
 * A counter component powered by a ReactiveController and shared constants.
 * Try editing constants.ts, counter-controller.ts, or this file
 * while the dev server is running to test HMR!
 */
@customElement('counter-element')
export class CounterElement extends LitElement {
  private counter = new CounterController(this);

  @property({ type: Number })
  accessor count = 0;

  render() {
    return html`
      <div class="counter-container">
        <h2>${COUNTER_TITLE}</h2>
        <p>Count: <strong>${this.counter.displayValue}</strong></p>
        <div class="button-group">
          <button
            @click=${() => this.counter.decrement()}
            ?disabled=${this.counter.isAtMin}
          >-</button>
          <button @click=${() => this.counter.reset()}>Reset</button>
          <button
            @click=${() => this.counter.increment()}
            ?disabled=${this.counter.isAtMax}
          >+</button>
        </div>
        <p class="hint">${COUNTER_HINT_TEXT}</p>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      border: 2px solid ${unsafeCSS(COLORS.primary)};
      border-radius: 8px;
      background: linear-gradient(
        135deg,
        ${unsafeCSS(COLORS.background)} 0%,
        ${unsafeCSS(COLORS.backgroundAlt)} 100%
      );
      margin: 1rem 0;
    }

    .counter-container {
      text-align: center;
    }

    h2 {
      color: ${unsafeCSS(COLORS.warning)};
      margin-top: 0;
      font-size: 2em;
    }

    p {
      font-size: 1.2em;
      color: ${unsafeCSS(COLORS.text)};
    }

    strong {
      color: ${unsafeCSS(COLORS.accent)};
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
      border: 2px solid ${unsafeCSS(COLORS.primary)};
      border-radius: 6px;
      background: ${unsafeCSS(COLORS.surface)};
      color: ${unsafeCSS(COLORS.text)};
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover:not(:disabled) {
      background: ${unsafeCSS(COLORS.primary)};
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
    }

    button:active:not(:disabled) {
      transform: translateY(0);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .hint {
      margin-top: 1.5rem;
      font-size: 0.9em;
      color: ${unsafeCSS(COLORS.textMuted)};
      font-style: italic;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'counter-element': CounterElement;
  }
}
