import { PowerUp } from 'src/store/store.entity';
import { Avatar, UserList } from '../../users/entities/user.entity';

export type ChallengeType = 'LAST_TO_COMPLETE' | 'NOT_COMPLETED';

export type ChallengeInviteType = 'PRIVATE' | 'PUBLIC';

export class ChallengeData {
  challengeId: string;
  title: string;
  isFeatured: boolean;
  imageURL?: string | undefined;
  description?: string;
  startAt: string | null;
  endAt: string;
  participantCount: number;
  type: ChallengeType;
  inviteType: ChallengeInviteType;
  hasReleasedResult: boolean;
  owner: UserMiniBase;
  participants: {
    griefList: string[];
    accepted: {
      completed: UserMini[];
      notCompleted: UserMini[];
      protected: UserMini[];
    };
    pending: UserMini[];
  };
}

export class ChallengeList {
  ongoing: ChallengeData[];
  pendingStart: ChallengeData[];
  pendingResponse: ChallengeData[];
  votingPeriod: ChallengeData[];
  history: ChallengeData[];
}

export class PublicChallengeList {
  featured: ChallengeData[];
  others: ChallengeData[];
}

export class ShamedList {
  id: `${string}:${string}`; // userId + challengeId
  name: string;
  title: string;
  type: 'shame' | 'cheat';
  time: string;
  avatar: Avatar;
  effect: {
    tomato: number;
    egg: number;
    poop: number;
    ben: number;
    soo: number;
  };
}

export class ApplyPowerupDto {
  type: PowerUp;
  targetUserId?: string | undefined;
}

export class CompleteChallengeResponse {
  window: [string, string]; // the current window, [begin, end]
  pointsInWindow: number;
  pointsLeft: number;
}

// Internal type. They do not match to any route specifically, but rather used to construct them.
type UserMiniBase = Pick<UserList, 'userId' | 'username' | 'name' | 'avatar'>;

export type UserMini = UserMiniBase & {
  completedAt?: string;
  evidenceLink?: string;
  hasBeenVetoed: boolean;
  isGriefed: boolean;
  griefedBy?: UserMiniBase | undefined;
  isProtected: boolean;
};
