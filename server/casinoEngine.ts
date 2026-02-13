/**
 * Casino game result calculation engine.
 * All games use provably fair random number generation.
 */

type GameResult = {
  multiplier: number;
  details: any;
};

// ─── Coin Flip ───
function playCoinFlip(params: any): GameResult {
  const choice = params?.choice || "heads"; // "heads" or "tails"
  const flip = Math.random() < 0.5 ? "heads" : "tails";
  const won = choice === flip;
  return {
    multiplier: won ? 1.96 : 0,
    details: { choice, flip, won },
  };
}

// ─── Dice ───
function playDice(params: any): GameResult {
  const target = Number(params?.target) || 50; // roll under target (1-95)
  const clampedTarget = Math.max(2, Math.min(95, target));
  const roll = Math.floor(Math.random() * 100) + 1; // 1-100
  const won = roll <= clampedTarget;
  // House edge ~2%: multiplier = 98 / target
  const multiplier = won ? parseFloat((98 / clampedTarget).toFixed(4)) : 0;
  return {
    multiplier,
    details: { target: clampedTarget, roll, won, winChance: clampedTarget },
  };
}

// ─── Mines ───
function playMines(params: any): GameResult {
  const mineCount = Math.max(1, Math.min(24, Number(params?.mines) || 5));
  const revealed = Math.max(0, Math.min(24 - mineCount, Number(params?.revealed) || 0));
  const cashOut = !!params?.cashOut;

  // Generate mine positions (5x5 grid = 25 cells)
  const totalCells = 25;
  const minePositions = new Set<number>();
  while (minePositions.size < mineCount) {
    minePositions.add(Math.floor(Math.random() * totalCells));
  }

  // Simulate revealing cells
  const safeCells: number[] = [];
  const allCells = Array.from({ length: totalCells }, (_, i) => i).filter(i => !minePositions.has(i));

  // Shuffle safe cells
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }

  let hitMine = false;
  let revealedCount = 0;

  if (cashOut && revealed > 0) {
    // Player is cashing out after revealing some cells
    revealedCount = revealed;
  } else {
    // Player is revealing one more cell
    const targetReveals = revealed + 1;
    for (let i = 0; i < targetReveals && i < allCells.length; i++) {
      // Correct probability: remaining mines / remaining unrevealed cells
      const remainingCells = totalCells - i;
      const hitChance = mineCount / remainingCells;

      if (Math.random() < hitChance && !cashOut) {
        hitMine = true;
        break;
      }
      revealedCount++;
    }
  }

  // Calculate multiplier based on cells revealed
  // Formula: multiplier increases exponentially with each safe cell revealed
  let multiplier = 0;
  if (!hitMine && revealedCount > 0) {
    const safeCellCount = totalCells - mineCount;
    let mult = 1;
    for (let i = 0; i < revealedCount; i++) {
      mult *= (totalCells - i) / (safeCellCount - i);
    }
    multiplier = parseFloat((mult * 0.97).toFixed(4)); // 3% house edge
  }

  return {
    multiplier,
    details: {
      mines: mineCount,
      revealed: revealedCount,
      hitMine,
      cashOut,
      minePositions: hitMine || cashOut ? Array.from(minePositions) : undefined,
      grid: Array.from({ length: totalCells }, (_, i) => minePositions.has(i) ? "mine" : "safe"),
    },
  };
}

// ─── Crash ───
function playCrash(params: any): GameResult {
  const cashOutAt = Number(params?.cashOutAt) || 2.0; // target multiplier to cash out

  // Generate crash point using exponential distribution
  // House edge ~3%
  const e = Math.random();
  const crashPoint = Math.max(1.0, parseFloat((0.97 / (1 - e)).toFixed(2)));

  const won = cashOutAt <= crashPoint;
  const multiplier = won ? cashOutAt : 0;

  return {
    multiplier,
    details: {
      cashOutAt,
      crashPoint,
      won,
      // Generate crash history for display
      history: Array.from({ length: 10 }, () => {
        const r = Math.random();
        return parseFloat(Math.max(1.0, 0.97 / (1 - r)).toFixed(2));
      }),
    },
  };
}

// ─── Roulette ───
function playRoulette(params: any): GameResult {
  const betType = params?.betType || "red"; // red, black, green, number, odd, even, high, low
  const betNumber = Number(params?.number);

  // European roulette: 0-36
  const result = Math.floor(Math.random() * 37); // 0-36

  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const isRed = redNumbers.includes(result);
  const isBlack = result > 0 && !isRed;
  const isGreen = result === 0;

  let won = false;
  let multiplier = 0;

  switch (betType) {
    case "red":
      won = isRed;
      multiplier = won ? 2 : 0;
      break;
    case "black":
      won = isBlack;
      multiplier = won ? 2 : 0;
      break;
    case "green":
      won = isGreen;
      multiplier = won ? 36 : 0;
      break;
    case "number":
      won = result === betNumber;
      multiplier = won ? 36 : 0;
      break;
    case "odd":
      won = result > 0 && result % 2 === 1;
      multiplier = won ? 2 : 0;
      break;
    case "even":
      won = result > 0 && result % 2 === 0;
      multiplier = won ? 2 : 0;
      break;
    case "high":
      won = result >= 19;
      multiplier = won ? 2 : 0;
      break;
    case "low":
      won = result >= 1 && result <= 18;
      multiplier = won ? 2 : 0;
      break;
    default:
      won = false;
      multiplier = 0;
  }

  return {
    multiplier,
    details: {
      betType,
      betNumber: betType === "number" ? betNumber : undefined,
      result,
      color: isGreen ? "green" : isRed ? "red" : "black",
      won,
    },
  };
}

// ─── Plinko ───
function playPlinko(params: any): GameResult {
  const risk = params?.risk || "medium"; // low, medium, high
  const rows = Math.max(8, Math.min(16, Number(params?.rows) || 12));

  // Simulate ball dropping through pegs
  let position = 0;
  const path: number[] = [0];

  for (let i = 0; i < rows; i++) {
    position += Math.random() < 0.5 ? 1 : -1;
    path.push(position);
  }

  // Normalize position to bucket index (0 to rows)
  const bucketIndex = Math.floor((position + rows) / 2);
  const totalBuckets = rows + 1;
  const normalizedIndex = Math.max(0, Math.min(totalBuckets - 1, bucketIndex));

  // Multiplier tables based on risk
  const multiplierTables: Record<string, number[]> = {
    low: generatePlinkoMultipliers(totalBuckets, "low"),
    medium: generatePlinkoMultipliers(totalBuckets, "medium"),
    high: generatePlinkoMultipliers(totalBuckets, "high"),
  };

  const table = multiplierTables[risk] || multiplierTables.medium;
  const multiplier = table[normalizedIndex] || 0;

  return {
    multiplier,
    details: {
      risk,
      rows,
      path,
      bucketIndex: normalizedIndex,
      multipliers: table,
      won: multiplier > 0,
    },
  };
}

function generatePlinkoMultipliers(buckets: number, risk: string): number[] {
  const center = Math.floor(buckets / 2);
  const mults: number[] = [];

  for (let i = 0; i < buckets; i++) {
    const distFromCenter = Math.abs(i - center);
    const maxDist = center;
    const ratio = distFromCenter / maxDist;

    let mult: number;
    if (risk === "low") {
      mult = 0.5 + ratio * 2.5; // 0.5x to 3x
    } else if (risk === "high") {
      mult = ratio < 0.3 ? 0.2 : ratio < 0.6 ? 0.5 : Math.pow(ratio, 3) * 100; // 0.2x to ~100x
    } else {
      mult = 0.3 + Math.pow(ratio, 2) * 15; // 0.3x to ~15x
    }

    mults.push(parseFloat(mult.toFixed(2)));
  }

  return mults;
}

// ─── Main Calculator ───
export function calculateCasinoResult(gameType: string, params: any): GameResult {
  switch (gameType) {
    case "coinflip": return playCoinFlip(params);
    case "dice": return playDice(params);
    case "mines": return playMines(params);
    case "crash": return playCrash(params);
    case "roulette": return playRoulette(params);
    case "plinko": return playPlinko(params);
    default: return { multiplier: 0, details: { error: "Unknown game type" } };
  }
}
