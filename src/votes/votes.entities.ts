export class VoteData {
  victim: {
    userId: string;
    username: string;
    name: string;
    evidenceLink?: string;
  };
  accusers: string[];
}
