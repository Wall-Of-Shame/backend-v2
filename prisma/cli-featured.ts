import { seedFeaturedCli } from './seed-utils';
import { prompt } from 'inquirer';

const questions = [
  {
    type: 'input',
    name: 'title',
    message: 'Challenge title:',
  },
  {
    type: 'input',
    name: 'description',
    message: 'Challenge description:',
  },
  {
    type: 'input',
    name: 'startAt',
    message: 'Challenge startAt:',
  },
  {
    type: 'input',
    name: 'endAt',
    message: 'Challenge endAt',
  },
  {
    type: 'input',
    name: 'imageUrl',
    message: 'Challenge imageUrl',
  },
];

prompt(questions).then((answers) => {
  const title = answers['title'];
  const description = answers['description'];
  const startAt = answers['startAt'];
  const endAt = answers['endAt'];
  const imageUrl = answers['imageUrl'];

  if (!title || !description || !startAt || !endAt || !imageUrl) {
    console.log('Invalid input');
  }

  const startAtDate = new Date(startAt);
  const endAtDate = new Date(endAt);

  seedFeaturedCli(imageUrl, title, description, startAtDate, endAtDate).catch(
    (e) => console.log(e),
  );
});
