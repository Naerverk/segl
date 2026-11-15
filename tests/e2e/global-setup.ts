import { writeFixtures } from '../../scripts/make-fixtures.ts';

export default async function globalSetup() {
  await writeFixtures();
}
