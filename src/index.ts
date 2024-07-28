import lcov from "lcov-parse";
import simpleGit, { SimpleGit } from "simple-git";

const git: SimpleGit = simpleGit();

interface Coverage {
  file: string;
  lines: {
    found: number;
    hit: number;
    details: { line: number; hit: number }[];
  };
}

function parseLcov(filePath: string): Promise<Coverage[]> {
  return new Promise((resolve, reject) => {
    lcov(filePath, (err: string | null, data: Coverage[] | undefined) => {
      if (err) {
        return reject(err);
      }
      resolve(data || []);
    });
  });
}

async function getDiff(commit1: string, commit2: string): Promise<string> {
  const diff = await git.diff([`${commit1}..${commit2}`]);
  return diff;
}

function calculatePatchCoverage(diff: string, coverage: Coverage[]): number {
  const coveredLines = new Map<string, Set<number>>();

  for (const fileCoverage of coverage) {
    const covered = new Set<number>();
    for (const detail of fileCoverage.lines.details) {
      if (detail.hit > 0) {
        covered.add(detail.line);
      }
    }
    coveredLines.set(fileCoverage.file, covered);
  }

  const diffLines = diff.split("\n");
  let addedLines = 0;
  let uncoveredAddedLines = 0;
  let currentFile: string | null = null;

  for (const line of diffLines) {
    if (line.startsWith("diff --git")) {
      const parts = line.split(" ");
      currentFile = parts[2].replace("b/", "");
    } else if (line.startsWith("@@")) {
      // Parsing hunk header for line numbers
      const match = /@@ -\d+(,\d+)? \+(\d+)(,\d+)? @@/.exec(line);
      if (match) {
        let lineNumber = parseInt(match[2], 10);
        for (const diffLine of diffLines.slice(diffLines.indexOf(line) + 1)) {
          if (diffLine.startsWith("@@") || diffLine.startsWith("diff --git"))
            break;
          if (diffLine.startsWith("+")) {
            addedLines++;
            if (!coveredLines.get(currentFile || "")?.has(lineNumber)) {
              uncoveredAddedLines++;
            }
          }
          if (!diffLine.startsWith("-")) lineNumber++;
        }
      }
    }
  }

  return uncoveredAddedLines / addedLines;
}

async function main() {
  const commit1 = process.argv[2];
  const commit2 = process.argv[3];
  const lcovFilePath = process.argv[4];

  try {
    const coverage = await parseLcov(lcovFilePath);
    const diff = await getDiff(commit1, commit2);
    const patchCoverage = calculatePatchCoverage(diff, coverage);

    console.log(`Patch coverage: ${(patchCoverage * 100).toFixed(2)}%`);
  } catch (error) {
    console.log(commit1, commit2, lcovFilePath);
    console.error("Error calculating patch coverage:", error);
    process.exit(1);
  }
}

main();
