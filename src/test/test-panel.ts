import { TestRunProfileKind, tests, Uri, TestItem } from "vscode";
import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { workspacePath } from "../globals";
import { SubTest, Test } from "../model";
import { spawn } from "child_process";
import { EQUAL } from "fast-diff";

import diff = require("fast-diff");

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

        test?.subTests?.forEach(async (subTest) => {
          run.enqueued(subTest.testItem);
          const inBuffer = await readFile(subTest.inFile.fsPath);
          const testRun = spawn(
            "python",
            [`${workspacePath.value}/${item.id}/${item.id}.py`],
            { stdio: "pipe" }
          );
          testRun.stdin.write(inBuffer);
          const outPromise = readFile(subTest.outFile.fsPath);

          let data = "";
          testRun.stdout.on("data", (chunk) => (data += chunk));
          testRun.on("close", async () => {
            const outText = (await outPromise).toString();
            const difference = diff(data, outText);
            console.log(difference);
            if (difference.length === 1 && difference[0][0] === EQUAL) {
              run.passed(subTest.testItem);
            } else {
              run.failed(subTest.testItem, { message: "no matchy :(" });
            }
          });
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
