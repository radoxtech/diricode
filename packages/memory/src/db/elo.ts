// Bradley-Terry Elo: expectedScore(R) = 1 / (1 + 10^((oppR - R) / 400))
// newRating = R + K * (actual - expected)  [actual: winner=1, loser=0]
// K=32 for < 30 matches, K=16 for >= 30

export const DEFAULT_ELO = 1000;

export interface EloResult {
  newWinnerRating: number;
  newLoserRating: number;
}

export function getKFactor(matchCount: number): number {
  return matchCount < 30 ? 32 : 16;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

export function calculateElo(
  winnerRating: number,
  loserRating: number,
  winnerMatches: number,
  loserMatches: number,
): EloResult {
  const kWinner = getKFactor(winnerMatches);
  const kLoser = getKFactor(loserMatches);

  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  return {
    newWinnerRating: winnerRating + kWinner * (1 - expectedWinner),
    newLoserRating: loserRating + kLoser * (0 - expectedLoser),
  };
}
