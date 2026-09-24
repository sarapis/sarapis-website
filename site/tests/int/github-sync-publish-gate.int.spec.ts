import { describe, it, expect } from 'vitest'

import { aggregateCommitsByDay, type GhCommit } from '@/endpoints/github-sync'

/**
 * Commit-day events auto-publish to the PUBLIC activity feed when one of their
 * `logins` is in PUBLISH_ACTORS, and their commit subjects are summarized by an
 * LLM into published text. So `logins` is a trust boundary.
 *
 * `c.author` is the GitHub account GitHub attributed the commit to. When no
 * account matches, it is null — and `c.commit.author.name` is whatever the
 * committer typed into `git config user.name`. The gate must never read the
 * latter: it previously fell back to it, so anyone able to land a commit in a
 * synced repo could set their name to a publish actor's username and have the
 * day auto-published. The name is still useful for DISPLAY.
 */
const commit = (over: {
  login?: string | null
  name?: string
  date?: string
  message?: string
}): GhCommit => ({
  sha: Math.random().toString(16).slice(2),
  author: over.login === undefined || over.login === null ? null : { login: over.login },
  commit: {
    message: over.message ?? 'Add a feature',
    author: { name: over.name ?? 'Someone', date: over.date ?? '2026-09-24T10:00:00Z' },
    committer: { date: over.date ?? '2026-09-24T10:00:00Z' },
  },
})

describe('github-sync auto-publish gate', () => {
  it('never lets a free-text git name into the gate', () => {
    const days = aggregateCommitsByDay([commit({ login: null, name: 'devinbalkind' })])
    const day = days.get('2026-09-24')!
    expect([...day.logins]).toEqual([])
  })

  it('still shows that name for display', () => {
    const day = aggregateCommitsByDay([commit({ login: null, name: 'Jane Contributor' })]).get('2026-09-24')!
    expect([...day.names]).toEqual(['Jane Contributor'])
  })

  it('admits a GitHub-attributed account', () => {
    const day = aggregateCommitsByDay([commit({ login: 'devinbalkind', name: 'Devin Balkind' })]).get('2026-09-24')!
    expect([...day.logins]).toEqual(['devinbalkind'])
    // display prefers the account login over the free-text name
    expect([...day.names]).toEqual(['devinbalkind'])
  })

  it('keeps only attributed accounts on a mixed day', () => {
    const day = aggregateCommitsByDay([
      commit({ login: 'mstem', name: 'Matt' }),
      commit({ login: null, name: 'devinbalkind' }),
      commit({ login: null, name: 'Someone Else' }),
    ]).get('2026-09-24')!
    expect([...day.logins].sort()).toEqual(['mstem'])
    expect([...day.names].sort()).toEqual(['Someone Else', 'devinbalkind', 'mstem'])
    expect(day.count).toBe(3)
  })

  it('groups by committer date', () => {
    const days = aggregateCommitsByDay([
      commit({ login: 'a', date: '2026-09-23T23:00:00Z' }),
      commit({ login: 'b', date: '2026-09-24T01:00:00Z' }),
    ])
    expect([...days.keys()].sort()).toEqual(['2026-09-23', '2026-09-24'])
  })
})
