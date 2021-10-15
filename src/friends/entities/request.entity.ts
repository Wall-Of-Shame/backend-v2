export class CreateRequestDto {
  userIds: string[];
}

export class AcceptRequestDto {
  userId: string;
}

export class RejectRequestDto {
  userId: string;
}
