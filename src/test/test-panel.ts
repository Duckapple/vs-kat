import { TestItem, TestRunRequest, CancellationToken } from "vscode";
import { workspacePath } from "../globals";
import { SubTest, Test } from "../model";
import childProcess = require("child_process");
import { EQUAL } from "fast-diff";

import { delayedPromise } from "../utilities/delayedPromise";

import diff = require("fast-diff");
import vscode = require("vscode");
const { TestRunProfileKind, tests, Uri } = vscode;
import fs = require("fs");
const { existsSync } = fs;
import fsPromises = require("fs/promises");
const { readdir, readFile } = fsPromises;

const testController = tests.createTestController(
  "vs-kat.tests",
  "VS Kat Tests"
);

const testState = {
  value: new Map<string, Test>(),
};

export function createTest(name: string): Test {
  const file = `${workspacePath.value}/${name}/${name}.py`;
  const testDir = `${workspacePath.value}/${name}/test`;

  const testItem = testController.createTestItem(name, name, Uri.file(file));

  testItem.canResolveChildren = true;

  testController.items.add(testItem);

  const test = { testItem, testDir };
  testState.value.set(name, test);
  return test;
}

export async function initializeTesting() {
  testController.resolveHandler = resolveHandler;

  const testProfile = testController.createRunProfile(
    "VS Kat: Active Problems",
    TestRunProfileKind.Run,
    runProfileHandler
  );

  return [testController, testProfile];
}

async function resolveHandler(item?: TestItem) {
  if (!item || !item.canResolveChildren || item.children.size > 0) return;

  const test = testState.value.get(item.id);

  const testDir = test?.testDir;
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

async function runProfileHandler(
  request: TestRunRequest,
  token: CancellationToken
) {
  const run = testController.createTestRun(request);
  for (const item of request.include ?? []) {
    item.children.forEach(console.log);
    const test = testState.value.get(item.id);
    run.enqueued(item);
    await resolveHandler(item);

    const runs = await Promise.allSettled(
      test?.subTests?.map(async (subTest) => {
        const { promise, resolve, reject } = delayedPromise<true>();
        run.enqueued(subTest.testItem);
        const inBuffer = await readFile(subTest.inFile.fsPath);
        const testRun = childProcess.spawn(
          "python",
          [`${workspacePath.value}/${item.id}/${item.id}.py`],
          { stdio: "pipe" }
        );
        testRun.stdin.write(inBuffer, () => {
          testRun.stdin.end();
        });
        const outPromise = readFile(subTest.outFile.fsPath);

        let data = "";
        let error = "";
        testRun.stdout.on("data", (chunk) => (data += chunk));
        testRun.stderr.on("data", (chunk) => (error += chunk));
        testRun.on("close", async () => {
          const outText = (await outPromise).toString();
          if (error) {
            run.failed(subTest.testItem, {
              message: `An error occurred:\n${error}`,
            });
            reject(subTest.testItem.id);
            return;
          }
          const difference = diff(data, outText);
          if (difference.length === 1 && difference[0][0] === EQUAL) {
            run.passed(subTest.testItem);
            resolve(true);
          } else {
            run.failed(subTest.testItem, {
              message: "Output mismatched",
              actualOutput: data,
              expectedOutput: outText,
            });
            reject(subTest.testItem.id);
          }
        });
        return promise;
      }) ?? []
    );

    const failMessage = runs
      .filter((run): run is PromiseRejectedResult => run.status === "rejected")
      .map(({ reason }) => `'${reason}'`)
      .join(", ");

    if (failMessage.length === 0) {
      run.passed(item);
    } else {
      run.failed(item, { message: "Tests failed: " + failMessage });
    }
  }
  run.end();
}
