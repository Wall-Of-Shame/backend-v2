export type EffectType = 'TOMATO' | 'EGG' | 'POOP' | 'SOO' | 'BEN';

export class ThrowItemPost {
  effect: EffectType;
  challengeId: string;
  targetUserId: string;
  count: number;
}
