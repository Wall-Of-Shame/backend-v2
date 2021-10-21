export const enum PowerUp {
  GRIEF = 'GRIEF',
  PROTEC = 'PROTEC',
}

export class PurchasePost {
  powerup: PowerUp;
  count: number;
}

// For internal reference only
export const CHALLENGE_COMPLETION_AWARD = 5;

export const POWER_UP_PRICE = {
  GRIEF: 50,
  PROTEC: 50,
};
