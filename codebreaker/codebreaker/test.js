const E = require('./engine.js');
const assert = require('assert');
let n = 0; const t = (name, fn) => { fn(); n++; };
const ev = (s, g) => { const r = E.evaluateGuess(s.split(' '), g.split(' ')); return [r.exact, r.misplaced]; };
t('brief example', () => assert.deepStrictEqual(ev('R B G Y', 'R G B P'), [1, 2]));
t('full match', () => assert.deepStrictEqual(ev('R B G Y', 'R B G Y'), [4, 0]));
t('none', () => assert.deepStrictEqual(ev('R B G Y', 'P P O O'), [0, 0]));
t('all wrong place', () => assert.deepStrictEqual(ev('R B G Y', 'B R Y G'), [0, 4]));
t('dup: secret RRBB guess RBRB', () => assert.deepStrictEqual(ev('R R B B', 'R B R B'), [2, 2]));
t('dup: guess excess', () => assert.deepStrictEqual(ev('R B G Y', 'R R R R'), [1, 0]));
t('dup: secret has one R, guess two R wrong', () => assert.deepStrictEqual(ev('B R G Y', 'R R P P'), [1, 0]));
t('dup: no double count', () => assert.deepStrictEqual(ev('R G G Y', 'G R R R'), [0, 2]));
t('all same', () => assert.deepStrictEqual(ev('R R R R', 'R R R R'), [4, 0]));
t('mixed', () => assert.deepStrictEqual(ev('R R G B', 'R G R P'), [1, 2]));
t('3 pos', () => assert.deepStrictEqual(ev('R B G', 'G B R'), [1, 2]));
t('8 pos', () => assert.deepStrictEqual(ev('A B C D E F G H', 'H G F E D C B A'), [0, 8]));
t('6 pos dups', () => assert.deepStrictEqual(ev('A A B B C C', 'A B A B C D'), [3, 2]));
// brute force invariant: exact+misplaced == sum_c min(count_s, count_g)
t('bruteforce', () => {
  const cols = ['a', 'b', 'c']; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 3000; k++) {
    const p = 3 + Math.floor(rnd() * 6);
    const s = Array.from({ length: p }, () => cols[Math.floor(rnd() * 3)]);
    const g = Array.from({ length: p }, () => cols[Math.floor(rnd() * 3)]);
    const r = E.evaluateGuess(s, g);
    let tot = 0; for (const c of cols) tot += Math.min(s.filter((x) => x === c).length, g.filter((x) => x === c).length);
    assert.strictEqual(r.exact + r.misplaced, tot);
    assert.strictEqual(r.exact, s.filter((x, i) => x === g[i]).length);
  }
});
// configs
for (const m of Object.values(E.MODES)) t('mode ' + m.mode, () => {
  assert.deepStrictEqual(E.validateConfig(m), []);
  const s = E.generateSecret(m); assert.strictEqual(s.length, m.positionCount);
  assert(s.every((c) => m.availableColors.includes(c)));
});
t('spec modes', () => {
  assert.deepStrictEqual([E.MODES.easy, E.MODES.classic, E.MODES.hard, E.MODES.expert].map((m) => [m.positionCount, m.availableColors.length, m.maxAttempts]), [[4, 5, 10], [4, 6, 10], [5, 7, 10], [6, 8, 12]]);
});
t('no dups unique', () => {
  const c = { mode: 'custom', positionCount: 8, availableColors: E.PALETTE.slice(0, 10).map((x) => x.id), maxAttempts: 8, allowDuplicates: false };
  for (let i = 0; i < 300; i++) assert.strictEqual(new Set(E.generateSecret(c)).size, 8);
});
t('dups appear', () => {
  const c = { ...E.MODES.classic, positionCount: 8, availableColors: ['red', 'blue', 'green', 'yellow'] };
  let seen = false; for (let i = 0; i < 100; i++) if (new Set(E.generateSecret(c)).size < 8) seen = true; assert(seen);
});
t('invalid configs', () => {
  const base = { mode: 'custom', positionCount: 4, availableColors: ['red', 'blue', 'green', 'yellow'], maxAttempts: 8, allowDuplicates: true };
  assert.deepStrictEqual(E.validateConfig(base), []);
  assert(E.validateConfig({ ...base, positionCount: 2 }).length);
  assert(E.validateConfig({ ...base, positionCount: 9 }).length);
  assert(E.validateConfig({ ...base, availableColors: ['red', 'blue', 'green'] }).length);
  assert(E.validateConfig({ ...base, maxAttempts: 3 }).length);
  assert(E.validateConfig({ ...base, maxAttempts: 21 }).length);
  assert(E.validateConfig({ ...base, positionCount: 6, allowDuplicates: false }).length);
  assert(E.validateConfig({ ...base, availableColors: ['red', 'blue', 'green', 'nope'] }).length);
  assert.throws(() => E.generateSecret({ ...base, positionCount: 6, allowDuplicates: false }));
});
t('validateGuess', () => {
  const c = E.MODES.classic;
  assert(!E.validateGuess(['red', null, 'blue', 'green'], c).valid);
  assert(!E.validateGuess(['red', 'blue'], c).valid);
  assert(!E.validateGuess(['red', 'blue', 'green', 'teal'], c).valid);
  assert(E.validateGuess(['red', 'blue', 'green', 'red'], c).valid);
});
t('win/loss', () => {
  assert(E.checkWin(['a', 'b'], ['a', 'b'])); assert(!E.checkWin(['a', 'b'], ['b', 'a']));
  assert(!E.checkGameOver(9, E.MODES.classic)); assert(E.checkGameOver(10, E.MODES.classic)); assert(E.checkGameOver(12, E.MODES.expert) && !E.checkGameOver(11, E.MODES.expert));
});
t('stats', () => {
  const s = E.calculateStatistics([{ won: true, attempts: 5 }, { won: true, attempts: 3 }, { won: false, attempts: 10 }, { won: true, attempts: 4 }, { won: true, attempts: 4 }]);
  assert.deepStrictEqual([s.played, s.won, s.lost, s.winPct, s.currentStreak, s.maxStreak, s.avgAttempts, s.best], [5, 4, 1, 80, 2, 2, 4, 3]);
  assert.strictEqual(s.distribution[4], 2);
  assert.strictEqual(E.calculateStatistics([]).played, 0);
});
t('share hides secret', () => {
  const g = { config: E.MODES.classic, won: true, guesses: [{ guess: ['red', 'red', 'red', 'red'], fb: { exact: 1, misplaced: 1 } }, { guess: [], fb: { exact: 4, misplaced: 0 } }] };
  const s = E.shareText(g); assert(s.startsWith('CODEBREAKER Classic 2/10')); assert(!/red|blue/i.test(s));
  const c = { ...g, config: { ...E.MODES.classic, mode: 'custom' }, won: false }; const s2 = E.shareText(c);
  assert(s2.includes('X/10') && s2.includes('positions'));
});
console.log(n + ' tests passed');
