import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store, type AppStore } from './store/index.ts';
import { COLORS } from './constants.ts';

/**
 * A Lit element that uses a Zustand vanilla store for state management.
 *
 * This demonstrates:
 * - Using zustand/vanilla with Lit (no React dependency)
 * - Subscribing/unsubscribing to store changes
 * - Whether HMR preserves zustand store state
 */
@customElement('zustand-element')
export class ZustandElement extends LitElement {
  @state()
  private accessor _storeState: AppStore = store.getState();

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    // Subscribe to zustand store — any state change triggers a Lit re-render
    this._unsubscribe = store.subscribe((newState) => {
      this._storeState = newState;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  private _onAddTodo() {
    const input = this.renderRoot.querySelector<HTMLInputElement>('#todo-input');
    const text = input?.value.trim();
    if (text) {
      this._storeState.addTodo(text);
      if (input) input.value = '';
    }
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') this._onAddTodo();
  }

  render() {
    const { count, increment, decrement, reset, todos, toggleTodo, removeTodo } =
      this._storeState;

    return html`
      <div class="container">
        <h2>Zustand Store Demo</h2>
        <p class="subtitle">State lives outside Lit — powered by <code>zustand/vanilla</code></p>

        <!-- Counter Section -->
        <div class="section">
          <h3>Counter Slice</h3>
          <p class="count">Count: <strong>${count}</strong></p>
          <div class="button-group">
            <button @click=${decrement}>-</button>
            <button @click=${reset}>Reset</button>
            <button @click=${increment}>+</button>
          </div>
        </div>

        <!-- Todo Section -->
        <div class="section">
          <h3>Todo Slice</h3>
          <div class="todo-input-row">
            <input
              id="todo-input"
              type="text"
              placeholder="Add a todo..."
              @keydown=${this._onKeyDown}
            />
            <button class="add-btn" @click=${this._onAddTodo}>Add</button>
          </div>
          ${todos.length === 0
            ? html`<p class="empty">No todos yet. Add one above!</p>`
            : html`
                <ul class="todo-list">
                  ${todos.map(
                    (todo) => html`
                      <li class=${todo.done ? 'done' : ''}>
                        <span class="todo-text" @click=${() => toggleTodo(todo.id)}>
                          ${todo.done ? '✓' : '○'} ${todo.text}
                        </span>
                        <button class="remove-btn" @click=${() => removeTodo(todo.id)}>x</button>
                      </li>
                    `
                  )}
                </ul>
              `}
        </div>

        <p class="hint">
          Edit this component or slices to test HMR — does the store state persist?
        </p>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      border: 2px solid ${unsafeCSS(COLORS.accent)};
      border-radius: 8px;
      background: linear-gradient(
        135deg,
        ${unsafeCSS(COLORS.background)} 0%,
        #1a2e1a 100%
      );
      margin: 1rem 0;
    }

    .container {
      text-align: center;
    }

    h2 {
      color: ${unsafeCSS(COLORS.accent)};
      margin-top: 0;
      font-size: 2em;
    }

    h3 {
      color: ${unsafeCSS(COLORS.text)};
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: ${unsafeCSS(COLORS.textMuted)};
      margin-top: -0.5rem;
    }

    code {
      background: ${unsafeCSS(COLORS.surface)};
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.9em;
      color: ${unsafeCSS(COLORS.accent)};
    }

    .section {
      margin: 1.5rem 0;
      padding: 1rem;
      border: 1px solid rgba(74, 222, 128, 0.2);
      border-radius: 6px;
    }

    .count strong {
      color: ${unsafeCSS(COLORS.accent)};
      font-size: 1.5em;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin: 1rem 0;
    }

    button {
      padding: 0.6rem 1.2rem;
      font-size: 1em;
      font-weight: bold;
      border: 2px solid ${unsafeCSS(COLORS.accent)};
      border-radius: 6px;
      background: ${unsafeCSS(COLORS.surface)};
      color: ${unsafeCSS(COLORS.text)};
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover {
      background: ${unsafeCSS(COLORS.accent)};
      color: #000;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
    }

    .todo-input-row {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin: 1rem 0;
    }

    input {
      padding: 0.6rem 1rem;
      font-size: 1em;
      border: 2px solid ${unsafeCSS(COLORS.accent)};
      border-radius: 6px;
      background: ${unsafeCSS(COLORS.surface)};
      color: ${unsafeCSS(COLORS.text)};
      outline: none;
      width: 250px;
    }

    input:focus {
      box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
    }

    .add-btn {
      padding: 0.6rem 1.2rem;
    }

    .todo-list {
      list-style: none;
      padding: 0;
      text-align: left;
      max-width: 400px;
      margin: 0 auto;
    }

    .todo-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.8rem;
      margin: 0.3rem 0;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      transition: background 0.2s;
    }

    .todo-list li:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .todo-list li.done .todo-text {
      text-decoration: line-through;
      opacity: 0.5;
    }

    .todo-text {
      cursor: pointer;
      flex: 1;
      color: ${unsafeCSS(COLORS.text)};
    }

    .remove-btn {
      padding: 0.2rem 0.5rem;
      font-size: 0.8em;
      border: 1px solid ${unsafeCSS(COLORS.warning)};
      color: ${unsafeCSS(COLORS.warning)};
      background: transparent;
    }

    .remove-btn:hover {
      background: ${unsafeCSS(COLORS.warning)};
      color: #000;
    }

    .empty {
      color: ${unsafeCSS(COLORS.textMuted)};
      font-style: italic;
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
    'zustand-element': ZustandElement;
  }
}
