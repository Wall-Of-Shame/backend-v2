import {
  AvatarAnimal,
  AvatarColor,
  ChallengeInviteType,
  ChallengeType,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

const seedEmails: [string, string, string][] = [
  ['yazmin63', 'Yazmin', 'yazmin63@example.com'],
  ['albert', 'Albert', 'albertha_kub@example.org'],
  ['daneee', 'Dane Crooks', 'dane.crooks@example.com'],
  ['malika28', 'Malika', 'malika28@example.net'],
  ['aidenschiller', 'Aiden', 'aiden.schiller82@example.com'],
  ['eldredlad', 'Eldred', 'eldred2@example.net'],
  ['luellabotsf', 'Luella Botsford', 'luella_botsford@example.com'],
];

function getRandomInt(max: number): number {
  // ouput: [0, max-1]
  return Math.floor(Math.random() * max);
}

function getRandomAnimal(): AvatarAnimal {
  const x = getRandomInt(3);
  if (x === 0) {
    return AvatarAnimal.CAT;
  } else if (x === 1) {
    return AvatarAnimal.DOG;
  } else {
    return AvatarAnimal.RABBIT;
  }
}

function getRandomColor(): AvatarColor {
  const x = getRandomInt(3);
  if (x === 0) {
    return AvatarColor.PRIMARY;
  } else if (x === 1) {
    return AvatarColor.SECONDARY;
  } else {
    return AvatarColor.TERTIARY;
  }
}

function getRandomBg(): string {
  const x = getRandomInt(3);
  if (x === 0) {
    return '#cbe8e0';
  } else if (x === 1) {
    return '#c9b2e1';
  } else {
    return '#c2d5eb';
  }
}

const taskNames: [string, Date, Date][] = [
  [
    'Watch lectures for CS1010',
    new Date(2021, 8, 1, 10, 0),
    new Date(2021, 8, 7, 23, 0),
  ],
  ['Run 8km', new Date(2021, 8, 1, 10, 0), new Date(2021, 8, 7, 23, 0)],
  ['Do IPPT', new Date(2021, 8, 1, 10, 0), new Date(2021, 8, 15, 23, 0)],
  [
    'Submit that hard af problem set',
    new Date(2021, 8, 1, 10, 0),
    new Date(2021, 8, 15, 23, 0),
  ],
  [
    'Complete assignment for GET1210',
    new Date(2021, 8, 1, 10, 0),
    new Date(2021, 8, 15, 23, 0),
  ],
  [
    'Write research paper for GES1001',
    new Date(2021, 8, 1, 10, 0),
    new Date(2021, 8, 15, 23, 0),
  ],
  [
    'Apply for internship to shopee',
    new Date(2021, 8, 1, 10, 0),
    new Date(2021, 8, 15, 23, 0),
  ],
  [
    'Submit PR for the assigned issue',
    new Date(2021, 8, 1, 10, 0),
    new Date(2021, 8, 12, 23, 0),
  ],
  ['Do 100 pushups', new Date(2021, 8, 1, 10, 0), new Date(2021, 8, 3, 23, 0)],
  ['Do 100 situps', new Date(2021, 8, 1, 10, 0), new Date(2021, 8, 3, 23, 0)],
];

async function main() {
  await prisma.user.createMany({
    data: seedEmails.map((t) => {
      return {
        username: t[0],
        name: t[1],
        email: t[2],
        avatar_animal: getRandomAnimal(),
        avatar_color: getRandomColor(),
        avatar_bg: getRandomBg(),
      };
    }),
  });

  const users: { userId: string }[] = await prisma.user.findMany({
    select: {
      userId: true,
    },
  });

  const sharedJoin = new Date(2021, 8, 1, 10, 0);
  const sharedStart = new Date(2021, 8, 2, 10, 0);
  const sharedComplete = new Date(2021, 8, 2, 13, 0);

  for (const t of taskNames) {
    await prisma.challenge.create({
      data: {
        title: t[0],
        startAt: sharedStart,
        endAt: t[2],
        type: ChallengeType.NOT_COMPLETED,
        ownerId: users[0].userId,
        result_released_at: new Date(),
        invite_type: ChallengeInviteType.PRIVATE,
        participants: {
          createMany: {
            data: users.map((u) => ({
              userId: u.userId,
              joined_at: sharedJoin,
              completed_at: getRandomInt(3) === 2 ? undefined : sharedComplete,
              has_been_vetoed: getRandomInt(15) === 14 ? true : false,
            })),
          },
        },
      },
    });
  }

  for (const u1 of users) {
    for (const u2 of users) {
      if (u1.userId === u2.userId) {
        continue;
      } else {
        await prisma.contact.create({
          data: {
            pers1_id: u1.userId,
            pers2_id: u2.userId,
            accepted_at: new Date(),
          },
        });
      }
    }
  }
}

export async function featuredCli(
  imageUrl: string,
  title: string,
  description: string,
  startAt: Date,
  endAt: Date,
  rank: number,
): Promise<void> {
  if (!process.env.EMAIL_HOST) {
    console.log('No host');
    return;
  }

  try {
    await prisma.$connect();
  } catch (error) {
    console.log(error);
    return;
  }

  let superuserId: string;
  try {
    superuserId = await prisma.user
      .findFirst({
        where: { email: process.env.EMAIL_HOST },
      })
      .then((user) => user.userId);
  } catch (error) {
    console.log(error);
    return;
  }

  await prisma.challenge
    .create({
      data: {
        title,
        description,
        startAt,
        endAt,
        image_url: imageUrl,
        type: ChallengeType.NOT_COMPLETED,
        ownerId: superuserId,
        invite_type: ChallengeInviteType.PUBLIC,
        feature_rank: rank,
      },
    })
    .then((c) => console.log('Success', c.challengeId));
}

const featuredChallenges: [string, string, string, Date, Date, number][] = [
  [
    'Vote Wall of Shame for the 19th STePs',
    `The School of Computing Term Project Showcase (STePS) is one of the largest event, similar to Trade shows, aims to bring together and present selected student projects/products in the School of Computing (SoC) to facilitate independent peer learning, entrepreneurship and effective employment with modern flipped career-fair approach.

    The 19th STePs is approaching and Wall of Shame will be participating in it!
    To complete this challenge, you will need to vote for us 😊
    `,
    'https://res.cloudinary.com/wallofshame/image/upload/v1635056434/19thsteps.png',
    new Date(2021, 10, 14),
    new Date(2021, 10, 15),
    1,
  ],
  [
    'National Steps Challenge Season 6',
    `Boost your mood and foster kampong spirit as you get moving with your community. Stay active and help your GRC climb the leaderboard by clocking steps and moderate to Vigorous Physical Activity (MVPA) minutes.

    Download and launch the Healthy 365 app
    Sign up for the National Steps Challenge - Season 6
    Walk more than 10,000 steps daily
    Take a screenshot and upload your proof to win exclusive prizes!
    `,
    'https://res.cloudinary.com/wallofshame/image/upload/v1635056443/nationalstepschallenge.png',
    new Date(2021, 10, 1),
    new Date(2021, 11, 25),
    3,
  ],
  [
    'Call For Ideas Fund 2021',
    `The Call for Ideas Fund aims to help applicants kickstart projects that seek to resolve an environmental challenge in the local community. These projects should seek to encourage the community to make environmentally responsible choices through outreach and education efforts.\n
  Upload your best idea and stand a chance to be funded for up to $20,000!`,
    'https://res.cloudinary.com/wallofshame/image/upload/v1635056443/callforideasfund.png',
    new Date(2021, 11, 1),
    new Date(2021, 11, 20),
    2,
  ],
];

export async function featured(): Promise<void> {
  if (!process.env.EMAIL_HOST) {
    console.log('No host');
    return;
  }

  featuredChallenges.forEach(async (c) => {
    await featuredCli(c[2], c[0], c[1], c[3], c[4], c[5]);
  });

  return;
}

export async function seed(): Promise<void> {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export async function seedFeaturedCli(
  imageUrl: string,
  title: string,
  description: string,
  startAt: Date,
  endAt: Date,
  rank: number,
): Promise<void> {
  featuredCli(imageUrl, title, description, startAt, endAt, rank)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export async function seedFeatured() {
  featured()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
