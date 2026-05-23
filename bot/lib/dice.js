const VALID_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

// Parses "2d6+3", "d20", "1d8-1" etc.
// Returns { diceType, count, modifier } or null if invalid.
function parseDiceExpr(expr) {
  const m = expr.trim().match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!m) return null;

  const count = parseInt(m[1] || '1', 10);
  const diceType = `d${m[2]}`;
  const modifier = m[3] ? parseInt(m[3], 10) : 0;

  if (!VALID_DICE.includes(diceType)) return null;
  if (count < 1 || count > 20) return null;

  return { diceType, count, modifier };
}

module.exports = { parseDiceExpr };
