import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const _dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = resolve(_dirname, '../test-audio');

test.describe('E-Soccer Battle E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to mount
    await page.waitForSelector('h1', { timeout: 15000 });
  });

  // ── Teste A — Comandos por texto ──────────────────────
  test('A — Fluxo completo de comandos por texto', async ({ page }) => {
    await page.screenshot({ path: 'test-results/A-01-initial-state.png' });

    // Verify pre-match screen is showing
    await expect(page.locator('text=Nova Partida')).toBeVisible();
    await expect(page.locator('input[placeholder="Time A"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Time B"]')).toBeVisible();

    // Type a command to start match via text input
    const textInput = page.locator('#text-command');
    await textInput.fill('volta seis');
    await textInput.press('Enter');

    // Wait for match to start (status changes from pre-match)
    await expect(page.locator('text=Em Andamento')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/A-02-match-started.png' });

    // Verify command appeared in history with "Partida iniciada"
    const cmdLog = page.locator('[role="log"][aria-label="Histórico de comandos"]');
    await expect(cmdLog).toContainText('Partida iniciada');

    // Command: gol time A
    await textInput.fill('gol time A');
    await textInput.press('Enter');
    await expect(cmdLog).toContainText('Gol do Time A', { timeout: 5000 });
    await page.screenshot({ path: 'test-results/A-03-gol-time-a.png' });

    // Command: resultado
    await textInput.fill('resultado');
    await textInput.press('Enter');
    await expect(cmdLog).toContainText('um a zero', { timeout: 5000 });
    await page.screenshot({ path: 'test-results/A-04-resultado.png' });

    // Command: intervalo
    await textInput.fill('intervalo');
    await textInput.press('Enter');
    await expect(cmdLog).toContainText('pausada', { timeout: 5000 });
    await expect(page.locator('text=Pausado')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/A-05-intervalo.png' });

    // Command: resultado (while paused)
    await textInput.fill('resultado');
    await textInput.press('Enter');
    await expect(cmdLog).toContainText('um a zero', { timeout: 5000 });

    // Command: encerrar
    await textInput.fill('encerrar');
    await textInput.press('Enter');
    await expect(cmdLog).toContainText('encerrada', { timeout: 5000 });
    await expect(page.locator('text=Encerrado')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/A-06-final-scoreboard.png' });
  });

  // ── Teste B — Pre-match screen (nomes customizados) ────
  test('B — Pre-match com nomes customizados', async ({ page }) => {
    // Verify pre-match screen is visible
    await expect(page.locator('text=Nova Partida')).toBeVisible();
    await expect(page.locator('text=Digite os nomes dos times')).toBeVisible();

    const inputA = page.locator('input[placeholder="Time A"]');
    const inputB = page.locator('input[placeholder="Time B"]');
    await expect(inputA).toBeVisible();
    await expect(inputB).toBeVisible();

    // Clear and fill custom names
    await inputA.clear();
    await inputA.fill('Flamengo');
    await inputB.clear();
    await inputB.fill('Botafogo');

    await page.screenshot({ path: 'test-results/B-01-names-filled.png' });

    // Click "Iniciar Partida" button
    await page.getByRole('button', { name: /Iniciar Partida/ }).first().click();

    // Verify scoreboard appears with "Em Andamento"
    await expect(page.locator('text=Em Andamento')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ao Vivo')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/B-02-match-live.png' });
  });

  // ── Teste C — Página de histórico ──────────────────────
  test('C — Modal de histórico de partidas', async ({ page }) => {
    // Start a match first so we have history
    const textInput = page.locator('#text-command');
    await textInput.fill('volta seis');
    await textInput.press('Enter');
    await expect(page.locator('text=Em Andamento')).toBeVisible({ timeout: 10000 });

    // End the match so it appears in history
    await textInput.fill('encerrar');
    await textInput.press('Enter');
    await expect(page.locator('text=Encerrado')).toBeVisible({ timeout: 10000 });

    // Click "Partidas Anteriores"
    await page.locator('text=Partidas Anteriores').click();

    // Verify modal opens
    await expect(page.locator('[aria-label="Histórico de partidas"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=1 partida registrada')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/C-01-history-modal.png' });

    // Close modal
    await page.locator('[aria-label="Fechar"]').click();
    await expect(page.locator('[aria-label="Histórico de partidas"]')).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/C-02-history-closed.png' });
  });

  // ── Teste D — Áudios reais (injeção via invokeCommand) ─
  test('D — Invocar comandos via invokeCommand direto (mock)', async ({ page }) => {
    // Use page.evaluate to invoke commands directly on the tauriBridge mock
    // This simulates what would happen when audio is processed

    const result1 = await page.evaluate(async () => {
      const mod = await import('/src/tauriBridge.ts');
      return await mod.invokeCommand('process_text_command', { text: 'volta seis' });
    });
    expect(result1.response_text).toContain('Partida iniciada');
    await page.screenshot({ path: 'test-results/D-01-invoke-start.png' });

    const result2 = await page.evaluate(async () => {
      const mod = await import('/src/tauriBridge.ts');
      return await mod.invokeCommand('process_text_command', { text: 'gol time A' });
    });
    expect(result2.response_text).toContain('Gol do Time A');

    const result3 = await page.evaluate(async () => {
      const mod = await import('/src/tauriBridge.ts');
      return await mod.invokeCommand('process_text_command', { text: 'gol time B' });
    });
    expect(result3.response_text).toContain('Gol do Time B');

    const result4 = await page.evaluate(async () => {
      const mod = await import('/src/tauriBridge.ts');
      return await mod.invokeCommand('process_text_command', { text: 'resultado' });
    });
    expect(result4.response_text).toContain('um a um');

    await page.screenshot({ path: 'test-results/D-02-invoke-commands.png' });

    // Test encerrar
    const result5 = await page.evaluate(async () => {
      const mod = await import('/src/tauriBridge.ts');
      return await mod.invokeCommand('process_text_command', { text: 'encerrar' });
    });
    expect(result5.response_text).toContain('encerrada');

    // Test get_match_history
    const history = await page.evaluate(async () => {
      const mod = await import('/src/tauriBridge.ts');
      return await mod.invokeCommand('get_match_history');
    });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('score_a');
    expect(history[0]).toHaveProperty('score_b');

    await page.screenshot({ path: 'test-results/D-03-final.png' });
  });

  // ── Teste E — Áudio real via file + AudioContext ───────
  test('E — Leitura de arquivos de áudio .ogg (validação de integridade)', async ({ page }) => {
    const audioFiles = [
      '01-volta-seis.ogg',
      '02-resultado.ogg',
      '03-gol-time-a.ogg',
      '04-gol-time-b.ogg',
      '05-intervalo.ogg',
      '06-resultado.ogg',
      '07-encerrar.ogg',
      '08-comandos.ogg',
    ];

    for (const file of audioFiles) {
      const filePath = resolve(AUDIO_DIR, file);
      const buffer = readFileSync(filePath);
      // Verify file is not empty and has OGG header
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.slice(0, 4).toString('ascii')).toContain('Ogg');
    }

    // Load one audio file into the browser and verify it decodes
    const audioBuffer = readFileSync(resolve(AUDIO_DIR, '01-volta-seis.ogg'));
    const base64 = audioBuffer.toString('base64');

    const canDecode = await page.evaluate(async (b64) => {
      try {
        const resp = await fetch(`data:audio/ogg;base64,${b64}`);
        const arrayBuf = await resp.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        await ctx.close();
        return { success: true, duration: decoded.duration, channels: decoded.numberOfChannels, sampleRate: decoded.sampleRate };
      } catch (e: unknown) {
        return { success: false, error: String(e) };
      }
    }, base64);

    expect(canDecode.success).toBe(true);
    expect(canDecode.duration).toBeGreaterThan(0);
    expect(canDecode.sampleRate).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/E-01-audio-decoded.png' });
  });
});
