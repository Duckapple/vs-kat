import { TestItem, Uri } from "vscode";

export type SubTest = { testItem: TestItem; inFile: Uri; outFile: Uri };

export type Test = {
  testItem: TestItem;
  testDir: string;
  subTests?: SubTest[];
};

export class Problem {
  constructor(public name: string, public test: Test) {}
}
