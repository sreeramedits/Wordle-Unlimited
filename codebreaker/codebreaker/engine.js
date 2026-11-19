(function (root) {
  const PALETTE = [
    { id: 'red', name: 'Red', hex: '#E84D4D', sym: '●' },
    { id: 'blue', name: 'Blue', hex: '#4385D5', sym: '▲' },
    { id: 'green', name: 'Green', hex: '#45A36B', sym: '■' },
    { id: 'yellow', name: 'Yellow', hex: '#E8C34A', sym: '◆' },
    { id: 'purple', name: 'Purple', hex: '#9B65CE', sym: '★' },
    { id: 'orange', name: 'Orange', hex: '#E58A43', sym: '✚' },
    { id: 'teal', name: 'Teal', hex: '#2BB3B1', sym: '⬟' },
    { id: 'pink', name: 'Pink', hex: '#E06AA6', sym: '▼' },
    { id: 'brown', name: 'Brown', hex: '#9A6B4B', sym: '◖' },
    { id: 'slate', name: 'Slate', hex: '#8E99A8', sym: '✖' },
  ];
  const LIMITS = { posMin: 3, posMax: 8, colMin: 4, colMax: 10, attMin: 4, attMax: 20 };
  const ids = (n) => PALETTE.slice(0, n).map((c) => c.id);
  const MODES = {
    easy: { mode: 'easy', positionCount: 4, availableColors: ids(5), maxAttempts: 10, allowDuplicates: true },
    classic: { mode: 'classic', positionCount: 4, availableColors: ids(6), maxAttempts: 10, allowDuplicates: true },
    hard: { mode: 'hard', positionCount: 5, availableColors: ids(7), maxAttempts: 10, allowDuplicates: true },
    expert: { mode: 'expert', positionCount: 6, availableColors: ids(8), maxAttempts: 12, allowDuplicates: true },
  };

  function validateConfig(c) {
    const e = [];
    if (!c || typeof c !== 'object') return ['Configuration is missing.'];
    const { positionCount: p, availableColors: cols, maxAttempts: a, allowDuplicates: d } = c;
    const isInt = Number.isInteger;
    if (!isInt(p) || p < LIMITS.posMin || p > LIMITS.posMax) e.push(`Positions must be between ${LIMITS.posMin} and ${LIMITS.posMax}.`);
    if (!Array.isArray(cols) || new Set(cols).size !== cols.length) e.push('Colors must be a list without repeats.');
    else {
      if (cols.length < LIMITS.colMin || cols.length > LIMITS.colMax) e.push(`Choose between ${LIMITS.colMin} and ${LIMITS.colMax} colors.`);
      if (cols.some((x) => !PALETTE.some((pc) => pc.id === x))) e.push('One or more colors are not in the palette.');
    }
    if (!isInt(a) || a < LIMITS.attMin || a > LIMITS.attMax) e.push(`Attempts must be between ${LIMITS.attMin} and ${LIMITS.attMax}.`);
    if (d === false && Array.isArray(cols) && isInt(p) && cols.length < p) e.push(`Without repeated colors you need at least ${p} colors (you have ${cols.length}).`);
    if (!['easy', 'classic', 'hard', 'expert', 'custom'].includes(c.mode)) e.push('Unknown game mode.');
    return e;
  }

  function generateSecret(config, rng) {
    const r = rng || Math.random;
    const errs = validateConfig(config);
    if (errs.length) throw new Error(errs[0]);
    const pool = config.availableColors.slice();
    const out = [];
    for (let i = 0; i < config.positionCount; i++) {
      const k = Math.floor(r() * pool.length);
      out.push(pool[k]);
      if (!config.allowDuplicates) pool.splice(k, 1);
    }
    return out;
  }

  function evaluateGuess(secret, guess) {
    let exact = 0;
    const counts = {};
    const gRest = [];
    for (let i = 0; i < secret.length; i++) {
      if (guess[i] === secret[i]) exact++;
      else {
        counts[secret[i]] = (counts[secret[i]] || 0) + 1;
        gRest.push(guess[i]);
      }
    }
    let misplaced = 0;
    for (const g of gRest) {
      if (counts[g] > 0) { counts[g]--; misplaced++; }
    }
    return { exact, misplaced, incorrect: secret.length - exact - misplaced };
  }

  function validateGuess(guess, config) {
    if (!Array.isArray(guess) || guess.length !== config.positionCount) return { valid: false, error: `Fill all ${config.positionCount} positions.` };
    if (guess.some((g) => !g)) return { valid: false, error: `Fill all ${config.positionCount} positions.` };
    if (guess.some((g) => !config.availableColors.includes(g))) return { valid: false, error: 'That color is not in this game.' };
    return { valid: true, error: null };
  }
  const checkWin = (secret, guess) => secret.length === guess.length && secret.every((c, i) => c === guess[i]);
  const checkGameOver = (attempts, config) => attempts >= config.maxAttempts;

  function emptyStats() {
    return { played: 0, won: 0, lost: 0, winPct: 0, currentStreak: 0, maxStreak: 0, avgAttempts: 0, best: null, distribution: {} };
  }
  // history: completed games oldest -> newest: {won:boolean, attempts:number}
  function calculateStatistics(history) {
    const s = emptyStats();
    let run = 0, sum = 0;
    for (const g of history) {
      s.played++;
      if (g.won) {
        s.won++; run++; sum += g.attempts;
        s.maxStreak = Math.max(s.maxStreak, run);
        s.best = s.best === null ? g.attempts : Math.min(s.best, g.attempts);
        s.distribution[g.attempts] = (s.distribution[g.attempts] || 0) + 1;
      } else { s.lost++; run = 0; }
    }
    s.currentStreak = run;
    s.winPct = s.played ? Math.round((s.won / s.played) * 100) : 0;
    s.avgAttempts = s.won ? Math.round((sum / s.won) * 10) / 10 : 0;
    return s;
  }

  function configSummary(c) {
    return `${c.positionCount} positions · ${c.availableColors.length} colors · ${c.maxAttempts} attempts · ${c.allowDuplicates ? 'repeats allowed' : 'no repeats'}`;
  }
  function shareText(game) {
    const c = game.config;
    const name = c.mode === 'custom' ? 'Custom' : c.mode[0].toUpperCase() + c.mode.slice(1);
    const head = `CODEBREAKER ${name} ${game.won ? game.guesses.length : 'X'}/${c.maxAttempts}`;
    const rows = game.guesses.map((g) => {
      const f = g.fb;
      return '🟩'.repeat(f.exact) + '🟨'.repeat(f.misplaced) + '⬛'.repeat(c.positionCount - f.exact - f.misplaced);
    });
    const lines = [head];
    if (c.mode === 'custom') lines.push(configSummary(c));
    lines.push('', ...rows);
    return lines.join('\n');
  }

  const api = { PALETTE, LIMITS, MODES, validateConfig, generateSecret, evaluateGuess, validateGuess, checkWin, checkGameOver, calculateStatistics, emptyStats, configSummary, shareText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CBEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
