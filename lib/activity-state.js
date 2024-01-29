/* global Zinnia */

// Create activity events when we become healthy or produce errors
export class ActivityState {
  #healthy = null

  onError (msg) {
    if (this.#healthy === null || this.#healthy) {
      this.#healthy = false
      Zinnia.activity.error(msg ?? 'Voyager failed reporting benchmarks')
    }
  }

  onHealthy () {
    if (this.#healthy === null) {
      this.#healthy = true
      Zinnia.activity.info('Voyager benchmarking started')
    } else if (!this.#healthy) {
      this.#healthy = true
      Zinnia.activity.info('Voyager benchmarking resumed')
    }
  }
}
