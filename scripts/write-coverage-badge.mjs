import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function colorForCoverage(value) {
  if (value >= 95) return 'brightgreen';
  if (value >= 90) return 'green';
  if (value >= 80) return 'yellow';
  if (value >= 70) return 'orange';
  return 'red';
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    throw new Error('Usage: node scripts/write-coverage-badge.mjs <coverage-output.txt> <output-json>');
  }

  const raw = await readFile(inputPath, 'utf8');
  const match = raw.match(/all files\s+\|\s+(\d+\.\d+)/);

  if (!match) {
    throw new Error('Could not find "all files" line coverage in coverage output');
  }

  const lineCoverage = Number(match[1]);
  const badge = {
    schemaVersion: 1,
    label: 'coverage',
    message: `${lineCoverage.toFixed(2)}%`,
    color: colorForCoverage(lineCoverage),
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(badge, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
