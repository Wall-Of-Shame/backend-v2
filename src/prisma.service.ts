import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  // allow for error: any cause error handling has no strong types
  customGetMetaFields(e: any): {
    target: string[];
  } {
    const error: PrismaClientKnownRequestError = e;
    if (!error.meta) {
      // should not happen accd to docs
      return {
        target: [],
      };
    }

    const meta: { target: string[] } = error.meta as any;
    return meta;
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
