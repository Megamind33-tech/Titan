import { test, expect } from '@playwright/test';

test.describe('SWIM26 guided project workflow', () => {
  test('first run onboarding -> select SWIM26 -> export shows SWIM26 target', async ({ page }: { page: any }) => {
    await page.goto('http://127.0.0.1:3000');

    await expect(page.getByTestId('project-onboarding-modal')).toBeVisible();
    await page.getByRole('button', { name: /SWIM26 Game Builder/i }).click();
    await page.getByTestId('start-project-button').click();

    await expect(page.getByTestId('active-project-summary')).toBeVisible();
    await expect(page.getByText(/SWIM26 Babylon Project/i)).toBeVisible();
    await expect(page.getByText('Plugins', { exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('button', { name: /export_scene/i }).click();

    await expect(page.getByTestId('export-modal')).toBeVisible();
    await expect(page.getByTestId('export-format-select')).toContainText('SWIM26 MANIFEST');
    await expect(page.getByTestId('recommended-export-format')).toContainText('swim26-manifest');
    await expect(page.getByTestId('export-format-select')).toHaveValue('swim26-manifest');
    await expect(page.getByText(/runtime handoff metadata/i)).toBeVisible();
  });

  test('invalid session recovery prompts setup review', async ({ page }: { page: any }) => {
    await page.goto('http://127.0.0.1:3000?projectProfile=profile.invalid');

    await expect(page.getByTestId('project-session-recovery-banner')).toBeVisible();
    await expect(page.getByText(/could not be restored/i)).toBeVisible();
    await page.getByRole('button', { name: /REVIEW SETUP/i }).click();
    await expect(page.getByTestId('project-onboarding-modal')).toBeVisible();
  });
});
