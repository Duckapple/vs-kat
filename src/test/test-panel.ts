import { TestRunProfileKind, tests, Uri, TestItem } from "vscode";
import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { workspacePath } from "../globals";
import { SubTest, Test } from "../model";

const testController = tests.createTestController(
  "vs-kat.tests",
  "VS Kat Tests"
);

const testState = {
  value: new Map<string, Test>(),
};

export function createTest(name: string): Test {
  const testDir = `${workspacePath.value}/${name}/test`;

  const testItem = testController.createTestItem(name, name, Uri.file(testDir));

  testItem.canResolveChildren = true;

  testController.items.add(testItem);

  const test = { testItem };
  testState.value.set(name, test);
  return test;
}

export async function initializeTesting() {
  async function resolveHandler(item?: TestItem) {
    if (!item || !item.canResolveChildren || item.children.size > 0) return;

    const test = testState.value.get(item.id);

    const testDir = item.uri?.fsPath;
    if (!testDir || !test) return;
    item.busy = true;
    test.subTests = test.subTests ?? [];

    if (existsSync(testDir)) {
      const incompleteTests = new Map<string, Partial<SubTest>>();

      for (const testFile of await readdir(testDir, { encoding: "utf-8" })) {
        const [testName] = testFile.split(".");
        const incompleteTest = incompleteTests.get(testName) ?? {};
        if (testFile.endsWith(".in")) {
          incompleteTest.inFile = Uri.file(testDir + "/" + testFile);
        } else {
          incompleteTest.outFile = Uri.file(testDir + "/" + testFile);
        }
        incompleteTests.set(testName, incompleteTest);
      }

      incompleteTests.forEach(function (subTest, name) {
        const inFile = subTest.inFile;
        if (inFile == null || !subTest.outFile) return;

        subTest.testItem = testController.createTestItem(
          item.id + "." + name,
          name,
          inFile
        );
        item.children.add(subTest.testItem);
        test.subTests?.push(subTest as SubTest);
      });
    }

    item.busy = false;
  }

  testController.resolveHandler = resolveHandler;

  const testProfile = testController.createRunProfile(
    "VS Kat: Active Problems",
    TestRunProfileKind.Run,
    async (request, cancel) => {
      const run = testController.createTestRun(request);
      for (const item of request.include ?? []) {
        const test = testState.value.get(item.id);
        run.enqueued(item);
        await resolveHandler(item);

        test?.subTests?.forEach((subTest) => {
          run.enqueued(subTest.testItem);
          setTimeout(() => run.passed(subTest.testItem), 500);
        });

        setTimeout(() => {
          run.passed(item);
        }, 1000);
      }
      setTimeout(() => {
        run.end();
      }, 2500);
    }
  );

  return [testController, testProfile];
}
