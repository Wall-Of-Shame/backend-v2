import { ChallengeType } from '../entities/challenge.entity';

export class UpdateChallengeDto {
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  type?: ChallengeType;
  participants?: string[];
}
