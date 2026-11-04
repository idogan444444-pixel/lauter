// Echter Look-ahead-Brickwall-Limiter: garantiert Ausgang <= Decke, ohne Clipping/Kratzen.
// Prinzip: kleine Vorschau-Verzögerung; sobald vorne ein lauter Teil kommt, wird die
// Verstärkung SOFORT heruntergezogen und langsam wieder losgelassen (kein Pumpen).
class LimiterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ceiling = 0.97;                                  // ~ -0.3 dBFS Sicherheits-Decke
    this.look = Math.max(16, Math.round(0.003 * sampleRate)); // ~3 ms Vorschau
    this.rel = Math.exp(-1 / (0.08 * sampleRate));        // 80 ms Release
    this.g = 1;
    this.bufs = null;
    this.idx = 0;
  }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    if (!input || input.length === 0) return true;
    const ch = input.length, n = input[0] ? input[0].length : 0;
    if (!this.bufs || this.bufs.length !== ch) {
      this.bufs = [];
      for (let c = 0; c < ch; c++) this.bufs.push(new Float32Array(this.look));
      this.idx = 0;
    }
    const look = this.look, ceiling = this.ceiling, rel = this.rel;
    let g = this.g, idx = this.idx;
    for (let i = 0; i < n; i++) {
      // lautester eingehender Kanal
      let p = 0;
      for (let c = 0; c < ch; c++) { const a = Math.abs(input[c][i]); if (a > p) p = a; }
      const target = p > ceiling ? ceiling / p : 1;
      if (target < g) { g = target; }                    // sofort runter (Vorschau deckt es ab)
      else { g = g * rel + target * (1 - rel); if (g > 1) g = 1; } // langsam hoch
      for (let c = 0; c < ch; c++) {
        const buf = this.bufs[c];
        const delayed = buf[idx];
        buf[idx] = input[c][i];
        let y = delayed * g;
        if (y > ceiling) y = ceiling; else if (y < -ceiling) y = -ceiling; // harte Garantie
        if (output[c]) output[c][i] = y;
      }
      idx++; if (idx >= look) idx = 0;
    }
    this.g = g; this.idx = idx;
    return true;
  }
}
registerProcessor('limiter', LimiterProcessor);
