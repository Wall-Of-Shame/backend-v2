export class Avatar {
  animal: 'CAT' | 'DOG' | 'RABBIT';
  color: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  background: string;
}

export class UserData {
  userId: string;
  email: string;
  username?: string;
  name?: string;
  completedChallengeCount?: number;
  failedChallengeCount?: number;
  vetoedChallengeCount?: number;
  avatar: Partial<Avatar>;
  settings: {
    deadlineReminder: boolean;
    invitations: boolean;
  };
  store: {
    points: number;
    griefCount: number;
    protecCount: number;
  };
}

export class UserList {
  userId: string;
  name: string;
  username: string;
  completedChallengeCount: number;
  failedChallengeCount: number;
  vetoedChallengeCount: number;
  avatar: Avatar;
}

export class UserFriends {
  userId: string;
  name: string;
  username: string;
  avatar: Avatar;
}
