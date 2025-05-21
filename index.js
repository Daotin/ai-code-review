import { getCommitHistory, getCommitDiff, getCommitDiffSummary } from './git.js';

const commitHistory = await getCommitHistory();
console.log(commitHistory);

const commitDiff = await getCommitDiff([commitHistory.hash]);
console.log('commitDiff==>', commitDiff);
