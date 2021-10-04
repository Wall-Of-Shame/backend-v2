import { Avatar } from '../entities/user.entity';

export class UpdateUserDto {
  userId: string;
  name: string;
  username: string;
  avatar: Avatar;
  settings: {
    deadlineReminder?: boolean;
    invitations?: boolean;
  };
}

export class UpdateUserMsgToken {
  messagingToken: string;
}
