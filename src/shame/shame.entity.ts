export type EffectType = 'TOMATO' | 'EGG' | 'POOP';

export class ThrowItemPost {
  effect: EffectType;
  challengeId: string;
  targetUserId: string;
  count: number;
}
