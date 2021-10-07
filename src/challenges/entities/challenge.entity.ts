import { UserList } from 'src/users/entities/user.entity';

export type ChallengeType = 'LAST_TO_COMPLETE' | 'NOT_COMPLETED';

export class ChallengeData {
  challengeId: string;
  title: string;
  description?: string;
  startAt: string | null;
  endAt: string;
  participantCount: number;
  type: ChallengeType;
  hasReleasedResult: boolean;
  owner: Omit<UserMini, 'hasBeenVetoed'>;
  participants: {
    accepted: {
      completed: UserMini[];
      notCompleted: UserMini[];
    };
    pending: UserMini[];
  };
}

export class ChallengeList {
  ongoing: ChallengeData[];
  pendingStart: ChallengeData[];
  pendingResponse: ChallengeData[];
  history: ChallengeData[];
}

// Internal type. They do not match to any route specifically, but rather used to construct them.
export type UserMini = Pick<
  UserList,
  'userId' | 'username' | 'name' | 'avatar'
> & {
  completedAt?: string;
  evidenceLink?: string;
  hasBeenVetoed: boolean;
};
