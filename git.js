import simpleGit from 'simple-git';
const git = simpleGit();

export async function getCommitHistory() {
  const log = await git.log({ maxCount: 1 });
  return log.latest;
}

export async function getCommitDiff(commits) {
  const diff = await git.diff(commits);
  return diff;
}

// diffSummary
export async function getCommitDiffSummary(commits) {
  const diffSummary = await git.diffSummary(commits);
  return diffSummary;
}
