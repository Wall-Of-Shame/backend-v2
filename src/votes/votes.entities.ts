export class VoteData {
  victim: {
    userId: string;
    username: string;
    hasProtec: boolean;
    name: string;
    evidenceLink?: string;
  };
  accusers: string[];
}
