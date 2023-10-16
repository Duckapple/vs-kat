import {
  commands,
  ExtensionContext,
  TestRunProfileKind,
  tests,
  workspace,
  window,
  Uri,
  TestItem,
} from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";
import { parseRC, printRC } from "./utilities/handleRcFile";
import { readdir } from "fs/promises";
import { existsSync } from "fs";

export async function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand(
    "vs-kat.showHelloWorld",
    () => {
      HelloWorldPanel.render(context.extensionUri);
    }
  );

  const file = await workspace.openTextDocument(
    workspace.workspaceFolders?.[0].uri.path + "/.kattisrc"
  );

  const text = file.getText();

  console.log(text);
  const rc = parseRC(text);
  console.log(printRC(rc));

  if (rc.kattis?.loginurl) console.log(rc.kattis.loginurl);

  const testController = tests.createTestController(
    "vs-kat.tests",
    "VS Kat Tests"
  );

  async function resolveHandler(item?: TestItem) {
    if (!item || !item.canResolveChildren || item.children.size > 0) return;

    const testDir = item.uri?.fsPath;
    if (!testDir) return;
    item.busy = true;

    if (existsSync(testDir)) {
      for (const testFile of await readdir(testDir, { encoding: "utf-8" })) {
        if (!testFile.endsWith(".in")) continue;
        item.children.add(
          testController.createTestItem(
            item.id + "." + testFile,
            testFile,
            Uri.file(testDir + "/" + testFile)
          )
        );
      }
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
        run.enqueued(item);
        await resolveHandler(item);
        item.children.forEach((item) => run.enqueued(item));

        setTimeout(() => {
          run.passed(item);
          item.children.forEach((item) => run.passed(item));
        }, 1000);
      }
      setTimeout(() => {
        run.end();
      }, 2500);
    }
  );

  if (workspace.workspaceFolders?.[0].uri.path) {
    const path = workspace.workspaceFolders[0].uri.path;
    const dir = await readdir(path, {
      encoding: "utf-8",
      withFileTypes: true,
    });

    for (const f of dir) {
      if (f.name.startsWith(".") || !f.isDirectory()) continue;

      const testDir = `${path}/${f.name}/test`;

      const item = testController.createTestItem(
        f.name,
        f.name,
        Uri.file(testDir)
      );

      item.canResolveChildren = true;

      testController.items.add(item);
    }
  }

  const tree = window.createTreeView<string>("contest", {
    treeDataProvider: {
      getChildren(element) {
        if (!rc.contest) return [];
        return element == null
          ? Object.keys(rc.contest).filter((key) => key !== "contest")
          : [];
      },
      getTreeItem(element) {
        return {
          label: `${element}: ${rc.contest?.[element]}`,
        };
      },
    },
  });

  await commands.executeCommand("setContext", "vs-kat.has-problems", true);
  await commands.executeCommand("setContext", "vs-kat.contest-mode", true);

  // Add command to the extension context
  context.subscriptions.push(
    showHelloWorldCommand,
    tree,
    testController,
    testProfile
  );
}
