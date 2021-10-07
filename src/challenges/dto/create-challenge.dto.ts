import { ChallengeType } from '../entities/challenge.entity';

export class CreateChallengeDto {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  type: ChallengeType;
  notificationMessage?: string;
  participants: string[];
}
