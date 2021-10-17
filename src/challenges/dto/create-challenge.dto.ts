import {
  ChallengeInviteType,
  ChallengeType,
} from '../entities/challenge.entity';

export class CreateChallengeDto {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  type: ChallengeType;
  inviteType?: ChallengeInviteType | undefined;
  notificationMessage?: string;
  participants: string[];
}
