import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, CronTime } from 'cron';
import { Exception } from 'handlebars';
import { ChallengesService } from 'src/challenges/challenges.service';

@Injectable()
export class CronService {
  constructor(private schedulerRegistry: SchedulerRegistry) {}

  private logger = new Logger(CronService.name);

  addCronJob(name: string, job: CronJob): void {
    const runDate = job.nextDate();
    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    this.logger.log(
      `Job ${name} added.\nIt will run at ${runDate.toString()}.`,
    );
  }

  getCronJob(name: string): CronJob | null {
    try {
      const job = this.schedulerRegistry.getCronJob(name);

      if (!job) {
        return null;
      }
      return job;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  deleteCronJob(name: string): void {
    try {
      this.schedulerRegistry.deleteCronJob(name);
      this.logger.log(`Job ${name} deleted.`);
    } catch (error) {
      console.log(error);
      return;
    }
  }

  changeCronJobDate(name: string, newDate: Date): void {
    const job = this.getCronJob(name);
    if (!job) {
      throw new Exception(`Cannot change cron job date for ${name}`);
    }

    job.setTime(new CronTime(newDate));
    this.logger.log(
      `Job ${name} changed. It will run at ${newDate.toString()} instead.`,
    );
  }

  dropAllJobs(): void {
    const jobs = this.schedulerRegistry.getCronJobs();
    jobs.forEach((job) => {
      job.stop();
    });
  }

  logStats(): void {
    const jobs = this.schedulerRegistry.getCronJobs();
    this.logger.log(`There are ${jobs.size} job(s) loaded in the registry`);
  }
}
