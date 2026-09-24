import { test, expect } from '@playwright/test'

// Replaces the template's check for "Payload Website Template", which could never pass here.
test.describe('Frontend', () => {
  test('home renders the Sarapis page', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/^Sarapis/)
    await expect(page.locator('h1.sds-onehero__title')).not.toBeEmpty()
    for (const section of ['Services', 'About'])
      await expect(page.locator('h2.sds-seclead__title', { hasText: section })).toBeVisible()
  })

  test('home section links navigate', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.getByRole('link', { name: 'All posts →' }).click()
    await expect(page).toHaveURL(/\/posts\/?$/)
    await expect(page.locator('main, body').first()).toBeVisible()
  })

  test('an unknown path is a 404', async ({ page }) => {
    const res = await page.goto('http://localhost:3000/no-such-page-e2e')
    expect(res?.status()).toBe(404)
  })
})
