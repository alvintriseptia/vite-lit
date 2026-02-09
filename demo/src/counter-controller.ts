import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  COUNTER_INITIAL_VALUE,
  COUNTER_STEP,
  COUNTER_MIN,
  COUNTER_MAX,
} from './constants.ts';

/**
 * A Reactive Controller that manages counter state.
 * Edit this file while the dev server is running to test HMR!
 *
 * The controller encapsulates counter logic and notifies
 * the host element to re-render when the value changes.
 */
export class CounterController implements ReactiveController {
  host: ReactiveControllerHost;

  private _value: number = COUNTER_INITIAL_VALUE;

  get value(): number {
    return this._value;
  }

  /** Formatted display string for the counter value */
  get displayValue(): string {
    return `${this._value}`;
  }

  /** Whether the counter is at its maximum */
  get isAtMax(): boolean {
    return this._value >= COUNTER_MAX;
  }

  /** Whether the counter is at its minimum */
  get isAtMin(): boolean {
    return this._value <= COUNTER_MIN;
  }

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    // Reset to initial value when host connects
    this._value = COUNTER_INITIAL_VALUE;
  }

  hostDisconnected(): void {
    // Cleanup if needed
  }

  increment(): void {
    if (this._value + COUNTER_STEP <= COUNTER_MAX) {
      this._value += COUNTER_STEP;
      this.host.requestUpdate();
    }
  }

  decrement(): void {
    if (this._value - COUNTER_STEP >= COUNTER_MIN) {
      this._value -= COUNTER_STEP;
      this.host.requestUpdate();
    }
  }

  reset(): void {
    this._value = COUNTER_INITIAL_VALUE;
    this.host.requestUpdate();
  }
}
