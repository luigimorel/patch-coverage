"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lcov_parse_1 = __importDefault(require("lcov-parse"));
const simple_git_1 = __importDefault(require("simple-git"));
const git = (0, simple_git_1.default)();
function parseLcov(filePath) {
    return new Promise((resolve, reject) => {
        (0, lcov_parse_1.default)(filePath, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data || []);
        });
    });
}
async function getDiff(commit1, commit2) {
    const diff = await git.diff([`${commit1}..${commit2}`]);
    return diff;
}
function calculatePatchCoverage(diff, coverage) {
    var _a;
    const coveredLines = new Map();
    for (const fileCoverage of coverage) {
        const covered = new Set();
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
    let currentFile = null;
    for (const line of diffLines) {
        if (line.startsWith("diff --git")) {
            const parts = line.split(" ");
            currentFile = parts[2].replace("b/", "");
        }
        else if (line.startsWith("@@")) {
            // Parsing hunk header for line numbers
            const match = /@@ -\d+(,\d+)? \+(\d+)(,\d+)? @@/.exec(line);
            if (match) {
                let lineNumber = parseInt(match[2], 10);
                for (const diffLine of diffLines.slice(diffLines.indexOf(line) + 1)) {
                    if (diffLine.startsWith("@@") || diffLine.startsWith("diff --git"))
                        break;
                    if (diffLine.startsWith("+")) {
                        addedLines++;
                        if (!((_a = coveredLines.get(currentFile || "")) === null || _a === void 0 ? void 0 : _a.has(lineNumber))) {
                            uncoveredAddedLines++;
                        }
                    }
                    if (!diffLine.startsWith("-"))
                        lineNumber++;
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
    }
    catch (error) {
        console.error("Error calculating patch coverage:", error);
        process.exit(1);
    }
}
main();
