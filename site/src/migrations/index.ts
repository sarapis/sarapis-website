import * as migration_20260702_024828_initial from './20260702_024828_initial';
import * as migration_20260704_021639_featured_posts from './20260704_021639_featured_posts';

export const migrations = [
  {
    up: migration_20260702_024828_initial.up,
    down: migration_20260702_024828_initial.down,
    name: '20260702_024828_initial',
  },
  {
    up: migration_20260704_021639_featured_posts.up,
    down: migration_20260704_021639_featured_posts.down,
    name: '20260704_021639_featured_posts'
  },
];
