/**
 * Casino game result calculation engine.
 * All games use HMAC-SHA256 provably fair random number generation.
 * Each function is pure: (hmac, validatedParams) → GameResult
 */
import { hmacToFloat, hmacToInt, hmacToBytes, hmacToShuffle } from "./provablyFair";

export type GameResult = {
  multiplier: number;
  details: Record<string, any>;
};

// ─── Coin Flip ───
// 1.96x multiplier = 2% house edge
export function playCoinFlip(hmac: string, params: { choice: "heads" | "tails" }): GameResult {
  const flip = hmacToFloat(hmac) < 0.5 ? "heads" : "tails";
  const won = params.choice === flip;
  return {
    multiplier: won ? 1.96 : 0,
    details: { choice: params.choice, flip, won },
  };
}

// ─── Dice ───
// Roll 0.00-99.99, win if roll < target. Multiplier = 98 / target (2% house edge)
export function playDice(hmac: string, params: { target: number }): GameResult {
  const target = Math.max(2, Math.min(95, params.target));
  const roll = parseFloat((hmacToFloat(hmac) * 10000 / 100).toFixed(2)); // 0.00 - 99.99
  const won = roll < target;
  const multiplier = won ? parseFloat((98 / target).toFixed(4)) : 0;
  return {
    multiplier,
    details: { target, roll, won, winChance: target },
  };
}

// ─── Roulette ───
// European roulette: 0-36, house edge 2.7%
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export function playRoulette(hmac: string, params: {
  betType: "red" | "black" | "green" | "number" | "odd" | "even" | "high" | "low";
  number?: number;
}): GameResult {
  const result = hmacToInt(hmac, 37); // 0-36
  const isRed = RED_NUMBERS.includes(result);
  const isBlack = result > 0 && !isRed;
  const isGreen = result === 0;

  let won = false;
  let multiplier = 0;

  switch (params.betType) {
    case "red": won = isRed; multiplier = won ? 2 : 0; break;
    case "black": won = isBlack; multiplier = won ? 2 : 0; break;
    case "green": won = isGreen; multiplier = won ? 36 : 0; break;
    case "number": won = result === (params.number ?? -1); multiplier = won ? 36 : 0; break;
    case "odd": won = result > 0 && result % 2 === 1; multiplier = won ? 2 : 0; break;
    case "even": won = result > 0 && result % 2 === 0; multiplier = won ? 2 : 0; break;
    case "high": won = result >= 19; multiplier = won ? 2 : 0; break;
    case "low": won = result >= 1 && result <= 18; multiplier = won ? 2 : 0; break;
  }

  return {
    multiplier,
    details: {
      betType: params.betType,
      betNumber: params.betType === "number" ? params.number : undefined,
      result,
      color: isGreen ? "green" : isRed ? "red" : "black",
      won,
    },
  };
}

// ─── Plinko ───
// Ball drops through pegs, each row goes left or right based on HMAC bytes
const PLINKO_MULTIPLIER_TABLES: Record<string, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    9: [5.6, 2.0, 1.6, 1.0, 0.7, 0.7, 1.0, 1.6, 2.0, 5.6],
    10: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9],
    11: [8.4, 3.0, 1.9, 1.3, 1.0, 0.7, 0.7, 1.0, 1.3, 1.9, 3.0, 8.4],
    12: [10, 3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
    13: [8.1, 4.0, 3.0, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3.0, 4.0, 8.1],
    14: [7.1, 4.0, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4.0, 7.1],
    15: [15, 8.0, 3.0, 2.0, 1.5, 1.1, 1.0, 0.7, 0.7, 1.0, 1.1, 1.5, 2.0, 3.0, 8.0, 15],
    16: [16, 9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16],
  },
  medium: {
    8: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    9: [18, 4.0, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4.0, 18],
    10: [22, 5.0, 2.0, 1.4, 0.6, 0.4, 0.6, 1.4, 2.0, 5.0, 22],
    11: [24, 6.0, 3.0, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3.0, 6.0, 24],
    12: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
    13: [43, 13, 6.0, 3.0, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3.0, 6.0, 13, 43],
    14: [58, 15, 7.0, 4.0, 1.9, 1.0, 0.5, 0.2, 0.5, 1.0, 1.9, 4.0, 7.0, 15, 58],
    15: [88, 18, 11, 5.0, 3.0, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3.0, 5.0, 11, 18, 88],
    16: [110, 41, 10, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10, 41, 110],
  },
  high: {
    8: [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
    9: [43, 7.0, 2.0, 0.6, 0.2, 0.2, 0.6, 2.0, 7.0, 43],
    10: [76, 10, 3.0, 0.9, 0.3, 0.2, 0.3, 0.9, 3.0, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
    13: [260, 37, 11, 4.0, 1.0, 0.2, 0.2, 0.2, 0.2, 1.0, 4.0, 11, 37, 260],
    14: [420, 56, 18, 5.0, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5.0, 18, 56, 420],
    15: [620, 83, 27, 8.0, 3.0, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3.0, 8.0, 27, 83, 620],
    16: [1000, 130, 26, 9.0, 4.0, 2.0, 0.2, 0.2, 0.2, 0.2, 0.2, 2.0, 4.0, 9.0, 26, 130, 1000],
  },
};

export function playPlinko(hmac: string, params: {
  risk: "low" | "medium" | "high";
  rows: number;
}): GameResult {
  const rows = Math.max(8, Math.min(16, params.rows));
  const risk = params.risk;
  const bytes = hmacToBytes(hmac);

  // Simulate ball dropping: each row, use one byte to decide left/right
  let position = 0;
  const path: number[] = [0];
  for (let i = 0; i < rows; i++) {
    const byte = bytes[i % bytes.length];
    position += byte % 2 === 0 ? 1 : -1;
    path.push(position);
  }

  // Normalize to bucket index
  const bucketIndex = Math.floor((position + rows) / 2);
  const totalBuckets = rows + 1;
  const normalizedIndex = Math.max(0, Math.min(totalBuckets - 1, bucketIndex));

  const table = PLINKO_MULTIPLIER_TABLES[risk]?.[rows];
  const multiplier = table ? (table[normalizedIndex] ?? 0) : 0;

  return {
    multiplier,
    details: {
      risk,
      rows,
      path,
      bucketIndex: normalizedIndex,
      multipliers: table || [],
      won: multiplier > 0,
      slot: normalizedIndex,
    },
  };
}

// ─── Crash ───
// Pre-determined crash point from HMAC. 3% house edge.
// If first 8 hex chars mod 33 === 0, instant crash at 1.00x
export function playCrash(hmac: string, params: { cashOutAt: number }): GameResult {
  const h = parseInt(hmac.substring(0, 8), 16);

  // 1/33 chance of instant crash (adds to house edge)
  let crashPoint: number;
  if (h % 33 === 0) {
    crashPoint = 1.0;
  } else {
    // Exponential distribution with 3% house edge
    crashPoint = parseFloat(Math.max(1.0, (0.97 * 0x100000000) / (h + 1)).toFixed(2));
  }

  const won = params.cashOutAt <= crashPoint;
  const multiplier = won ? params.cashOutAt : 0;

  return {
    multiplier,
    details: {
      cashOutAt: params.cashOutAt,
      crashPoint,
      won,
    },
  };
}

// ─── Mines ───
// Uses HMAC-based shuffle to place mines on a 5x5 grid.
// Called once at session start. Returns mine positions.
export function generateMinePositions(hmac: string, mineCount: number): number[] {
  const shuffled = hmacToShuffle(hmac, 25);
  return shuffled.slice(0, mineCount).sort((a, b) => a - b);
}

// ─── Rock Paper Scissors ───
// Win: 1.94x, Draw: 1.0x (push), Loss: 0x — ~2% house edge overall
export function playRockPaperScissors(hmac: string, params: { choice: "rock" | "paper" | "scissors" }): GameResult {
  const outcomes = ["rock", "paper", "scissors"] as const;
  const houseIndex = hmacToInt(hmac, 3);
  const houseChoice = outcomes[houseIndex];
  const playerChoice = params.choice;

  let result: "win" | "draw" | "loss";
  if (playerChoice === houseChoice) {
    result = "draw";
  } else if (
    (playerChoice === "rock" && houseChoice === "scissors") ||
    (playerChoice === "paper" && houseChoice === "rock") ||
    (playerChoice === "scissors" && houseChoice === "paper")
  ) {
    result = "win";
  } else {
    result = "loss";
  }

  const multiplier = result === "win" ? 1.94 : result === "draw" ? 1.0 : 0;

  return {
    multiplier,
    details: { choice: playerChoice, houseChoice, result, won: result === "win" },
  };
}

// ─── Bingo ───
// 5x5 card, 30 balls drawn from 75, multiplier by completed lines
const BINGO_MULTIPLIERS: Record<number, number> = {
  0: 0, 1: 5, 2: 12, 3: 30, 4: 30, 5: 30, 6: 30, 7: 30, 8: 30, 9: 30, 10: 30, 11: 30, 12: 500,
};

function generateBingoCard(hmac: string): number[][] {
  const bytes = hmacToBytes(hmac);
  const card: number[][] = [];
  const ranges = [
    [1, 15], [16, 30], [31, 45], [46, 60], [61, 75],
  ];

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);

    // Pick 5 numbers from 15 using bytes
    const selected: number[] = [];
    for (let i = 0; i < 5; i++) {
      const byteIdx = col * 5 + i;
      const idx = bytes[(byteIdx + 32) % bytes.length] % pool.length;
      selected.push(pool[idx]);
      pool.splice(idx, 1);
    }
    card.push(selected);
  }

  return card;
}

function countBingoLines(card: number[][], marked: boolean[][]): number {
  let lines = 0;

  // 5 rows
  for (let r = 0; r < 5; r++) {
    if (marked[r].every(Boolean)) lines++;
  }
  // 5 columns
  for (let c = 0; c < 5; c++) {
    if (marked.every(row => row[c])) lines++;
  }
  // 2 diagonals
  if ([0, 1, 2, 3, 4].every(i => marked[i][i])) lines++;
  if ([0, 1, 2, 3, 4].every(i => marked[i][4 - i])) lines++;

  return lines;
}

export function playBingo(hmac: string, _params: {}): GameResult {
  // Generate card
  const card = generateBingoCard(hmac);

  // Draw 30 balls from 75 using shuffle
  const shuffled = hmacToShuffle(hmac, 75);
  const drawnBalls = shuffled.slice(0, 30).map(i => i + 1); // 1-75

  // Build 5x5 marked grid (row-major: card[col][row] -> marked[row][col])
  const marked: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));

  // Center is free
  marked[2][2] = true;

  for (const ball of drawnBalls) {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        if (card[col][row] === ball) {
          marked[row][col] = true;
        }
      }
    }
  }

  const lineCount = countBingoLines(card, marked);
  const isFullHouse = marked.every(row => row.every(Boolean));
  const multiplier = isFullHouse ? 500 : (BINGO_MULTIPLIERS[lineCount] ?? (lineCount >= 3 ? 30 : 0));

  return {
    multiplier,
    details: {
      card,
      drawnBalls,
      marked,
      lineCount,
      isFullHouse,
      won: multiplier > 0,
    },
  };
}

// ─── Blackjack Helpers ───
const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export type BlackjackCard = { rank: string; suit: string; value: number };

export function generateBlackjackDeck(hmac: string): BlackjackCard[] {
  const shuffled = hmacToShuffle(hmac, 52);
  return shuffled.map(i => {
    const suitIdx = Math.floor(i / 13);
    const rankIdx = i % 13;
    const rank = RANKS[rankIdx];
    let value: number;
    if (rank === "A") value = 11;
    else if (["J", "Q", "K"].includes(rank)) value = 10;
    else value = parseInt(rank);
    return { rank, suit: SUITS[suitIdx], value };
  });
}

export function handTotal(cards: BlackjackCard[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") aces++;
    total += c.value;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(cards: BlackjackCard[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

export function dealerPlay(deck: BlackjackCard[], dealerCards: BlackjackCard[], nextIdx: number): { dealerCards: BlackjackCard[]; nextIdx: number } {
  const cards = [...dealerCards];
  let idx = nextIdx;
  while (handTotal(cards) < 17 && idx < deck.length) {
    cards.push(deck[idx++]);
  }
  return { dealerCards: cards, nextIdx: idx };
}

export function calculateBlackjackResult(
  playerCards: BlackjackCard[],
  dealerCards: BlackjackCard[],
  isDouble: boolean,
): { multiplier: number; result: "blackjack" | "win" | "push" | "loss" } {
  const playerTotal = handTotal(playerCards);
  const dealerTotal = handTotal(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);
  const baseMultiplier = isDouble ? 2 : 1;

  if (playerBJ && dealerBJ) return { multiplier: 1.0, result: "push" };
  if (playerBJ) return { multiplier: 2.5, result: "blackjack" };
  if (dealerBJ) return { multiplier: 0, result: "loss" };
  if (playerTotal > 21) return { multiplier: 0, result: "loss" };
  if (dealerTotal > 21) return { multiplier: 2 * baseMultiplier, result: "win" };
  if (playerTotal > dealerTotal) return { multiplier: 2 * baseMultiplier, result: "win" };
  if (playerTotal === dealerTotal) return { multiplier: 1.0 * baseMultiplier, result: "push" };
  return { multiplier: 0, result: "loss" };
}

// ─── Keno ───
// Player picks 1-10 numbers from 1-40, 10 balls drawn. Payout by hits.
const KENO_MULTIPLIERS: Record<number, Record<number, number>> = {
  // picks: { hits: multiplier }
  1:  { 0: 0, 1: 3.8 },
  2:  { 0: 0, 1: 1.5, 2: 8.5 },
  3:  { 0: 0, 1: 1, 2: 3, 3: 25 },
  4:  { 0: 0, 1: 0.5, 2: 2, 3: 8, 4: 80 },
  5:  { 0: 0, 1: 0, 2: 1.5, 3: 4, 4: 20, 5: 200 },
  6:  { 0: 0, 1: 0, 2: 1, 3: 2.5, 4: 8, 5: 50, 6: 500 },
  7:  { 0: 0, 1: 0, 2: 0.5, 3: 2, 4: 5, 5: 20, 6: 100, 7: 1000 },
  8:  { 0: 0, 1: 0, 2: 0, 3: 1.5, 4: 3, 5: 12, 6: 50, 7: 250, 8: 2000 },
  9:  { 0: 0, 1: 0, 2: 0, 3: 1, 4: 2.5, 5: 8, 6: 25, 7: 100, 8: 500, 9: 5000 },
  10: { 0: 0, 1: 0, 2: 0, 3: 0.5, 4: 2, 5: 5, 6: 15, 7: 50, 8: 250, 9: 1000, 10: 10000 },
};

export function playKeno(hmac: string, params: { picks: number[] }): GameResult {
  const picks = params.picks.slice(0, 10).filter(n => n >= 1 && n <= 40);
  const pickCount = picks.length;

  // Draw 10 balls from 40
  const shuffled = hmacToShuffle(hmac, 40);
  const drawnBalls = shuffled.slice(0, 10).map(i => i + 1); // 1-40

  // Count hits
  const hits = picks.filter(p => drawnBalls.includes(p)).length;

  const table = KENO_MULTIPLIERS[pickCount];
  const multiplier = table ? (table[hits] ?? 0) : 0;

  return {
    multiplier,
    details: {
      picks,
      pickCount,
      drawnBalls,
      hits,
      hitNumbers: picks.filter(p => drawnBalls.includes(p)),
      won: multiplier > 0,
    },
  };
}

// ─── Limbo ───
// Player sets target multiplier. HMAC generates a result multiplier.
// If result >= target, player wins target × stake. 3% house edge.
export function playLimbo(hmac: string, params: { target: number }): GameResult {
  const target = Math.max(1.01, Math.min(1000000, params.target));
  const h = parseInt(hmac.substring(0, 8), 16);

  // Generate result multiplier using inverse distribution with 3% house edge
  // P(result >= x) = 0.97 / x → result = 0.97 / random
  let resultMultiplier: number;
  if (h % 33 === 0) {
    resultMultiplier = 1.0; // instant loss (house edge boost)
  } else {
    const raw = (0.97 * 0x100000000) / (h + 1);
    resultMultiplier = parseFloat(Math.max(1.0, raw).toFixed(2));
  }

  const won = resultMultiplier >= target;
  const multiplier = won ? target : 0;

  return {
    multiplier,
    details: {
      target,
      result: resultMultiplier,
      won,
    },
  };
}

// ─── Hilo Helpers ───
// Session-based: draw cards, guess higher or lower, cash out anytime.
// Uses same card types as Blackjack.
export type HiloCard = { rank: string; suit: string; numericValue: number };

export function generateHiloDeck(hmac: string): HiloCard[] {
  const shuffled = hmacToShuffle(hmac, 52);
  const HILO_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
  return shuffled.map(i => {
    const suitIdx = Math.floor(i / 13);
    const rankIdx = i % 13;
    const rank = HILO_RANKS[rankIdx];
    const numericValue = rankIdx + 1; // A=1, 2=2, ..., K=13
    return { rank, suit: SUITS[suitIdx], numericValue };
  });
}

export function calculateHiloMultiplier(
  currentCard: HiloCard,
  guess: "higher" | "lower",
): number {
  // Probability of correct guess determines multiplier
  const v = currentCard.numericValue;
  // Cards equal to current count as loss for both guesses (strict higher/lower)
  // There are 4 cards of each rank, total 52, minus the 1 already showing = 51 remaining
  const cardsHigher = (13 - v) * 4; // ranks above current
  const cardsLower = (v - 1) * 4;   // ranks below current
  // const cardsEqual = 3; // same rank, different suits (already one out)

  const favorable = guess === "higher" ? cardsHigher : cardsLower;
  if (favorable === 0) return 0; // impossible guess

  // Multiplier = 0.97 * 51 / favorable (3% house edge)
  return parseFloat((0.97 * 51 / favorable).toFixed(4));
}

// Multiplier for Mines: exponential increase per safe cell, 3% house edge
export function calculateMinesMultiplier(revealedCount: number, mineCount: number): number {
  if (revealedCount <= 0) return 0;
  const totalCells = 25;
  const safeCells = totalCells - mineCount;
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    mult *= (totalCells - i) / (safeCells - i);
  }
  return parseFloat((mult * 0.97).toFixed(4)); // 3% house edge
}
