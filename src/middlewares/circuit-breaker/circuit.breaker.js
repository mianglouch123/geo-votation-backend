class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.timeout = options.timeout ?? 30000;

    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelay = options.retryDelay ?? 300; // ms base

    this.failureCount = 0;
    this.state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    this.nextAttempt = Date.now();

    this.isTesting = false; // para HALF_OPEN

    this.onOpen = options.onOpen || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onHalfOpen = options.onHalfOpen || (() => {});
  }

  // ========================
  // ESTADOS
  // ========================

  onSuccess() {
    this.failureCount = 0;

    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.isTesting = false;
      this.onClose();
      console.log("🟢 Circuito CLOSED (recuperado)");
    }
  }

  onFailure() {
    this.failureCount++;

    if (this.state === "HALF_OPEN") {
      // si falla en prueba → vuelve a OPEN
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      this.isTesting = false;
      this.onOpen();
      console.log("🔴 HALF_OPEN falló → OPEN");
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      this.onOpen();

      console.log(
        "🔴 Circuito OPEN - Esperando",
        this.timeout / 1000,
        "segundos"
      );
    }
  }

  canRequest() {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
        this.onHalfOpen();
        console.log("🟡 Circuito HALF_OPEN");
        return true;
      }
      return false;
    }

    if (this.state === "HALF_OPEN") {
      if (this.isTesting) return false;

      this.isTesting = true;
      return true;
    }

    return true;
  }

  // ========================
  // RETRY CON BACKOFF
  // ========================

  async executeWithRetry(fn) {
    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;

        if (attempt > this.maxRetries) {
          throw err;
        }

        const delay = this.retryDelay * Math.pow(2, attempt);

        await new Promise(res => setTimeout(res, delay));
      }
    } 
  }

  // ========================
  // LLAMADA PRINCIPAL
  // ========================

  async call(fn, fallback = null) {
    if (!this.canRequest()) {
      if (fallback) {
        return fallback();
      }
      throw new Error("Circuit breaker OPEN");
    }

    try {
      const result = await this.executeWithRetry(fn);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();

      if (fallback) {
        return fallback(err);
      }

      throw err;
    }
  }
}

export const dbBreaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 30000,
  maxRetries: 2,
  retryDelay: 200,

  onOpen: () => console.log("⚠️ DB DOWN"),
  onClose: () => console.log("✅ DB UP"),
  onHalfOpen: () => console.log("🔄 Probando DB...")
});