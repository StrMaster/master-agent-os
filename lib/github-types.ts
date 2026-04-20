export type ProposedFileChange = {
  filePath: string;
  content: string;
};

export type ChangeProposal = {
  summary: string;
  branchName: string;
  commitMessage: string;
  changes: ProposedFileChange[];
};