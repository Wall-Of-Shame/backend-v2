import { AvatarAnimal, AvatarColor } from '.prisma/client';

export class CreateUserDto {
  username: string;
  name: string;
  avatar_animal: AvatarAnimal;
  avatar_color: AvatarColor;
  avatar_bg: string;
  email: string;
  messagingToken?: string | undefined;
}
