// parseDiceExpr(expr) — parse "2d6+3" or "2d6+3+5-1" → {diceType, count, modifier} or null if invalid

const VALID_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

// Parses "2d6+3", "d20", "1d8-1", "2d12+3+5-1" etc.
// Multiple modifier terms (e.g. +3+5+7) are summed into a single modifier value.
// Returns { diceType, count, modifier } or null if invalid.
function parseDiceExpr(expr) {
  const m = expr.trim().match(/^(\d+)?d(\d+)((?:[+-]\d+)*)$/i);
  if (!m) return null;

  const count = parseInt(m[1] || '1', 10);
  const diceType = `d${m[2]}`;

  let modifier = 0;
  if (m[3]) {
    const terms = m[3].match(/[+-]\d+/g) || [];
    modifier = terms.reduce((sum, t) => sum + parseInt(t, 10), 0);
  }

  if (!VALID_DICE.includes(diceType)) return null;
  if (count < 1 || count > 20) return null;

  return { diceType, count, modifier };
}

module.exports = { parseDiceExpr };
