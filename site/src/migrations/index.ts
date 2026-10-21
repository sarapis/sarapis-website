import * as migration_20260702_024828_initial from './20260702_024828_initial';
import * as migration_20260704_021639_featured_posts from './20260704_021639_featured_posts';
import * as migration_20261021_140000_projects_child_label from './20261021_140000_projects_child_label';
import * as migration_20261021_140100_projects_logo_screenshot from './20261021_140100_projects_logo_screenshot';
import * as migration_20261021_140200_homepage_board_portrait from './20261021_140200_homepage_board_portrait';

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
  {
    up: migration_20261021_140000_projects_child_label.up,
    down: migration_20261021_140000_projects_child_label.down,
    name: '20261021_140000_projects_child_label',
  },
  {
    up: migration_20261021_140100_projects_logo_screenshot.up,
    down: migration_20261021_140100_projects_logo_screenshot.down,
    name: '20261021_140100_projects_logo_screenshot',
  },
  {
    up: migration_20261021_140200_homepage_board_portrait.up,
    down: migration_20261021_140200_homepage_board_portrait.down,
    name: '20261021_140200_homepage_board_portrait',
  },
];
