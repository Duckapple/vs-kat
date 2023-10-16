import { commands, ExtensionContext, workspace, window, Uri } from "vscode";
import { readdir } from "fs/promises";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";
import { parseRC, printRC } from "./utilities/handleRcFile";
import { createTest, initializeTesting } from "./test/test-panel";
import { workspacePath } from "./globals";
import { Problem } from "./model";

export async function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand(
    "vs-kat.showHelloWorld",
    () => {
      HelloWorldPanel.render(context.extensionUri);
    }
  );

  workspacePath.value = workspace.workspaceFolders?.[0].uri.path!;

  const file = await workspace.openTextDocument(
    workspacePath.value + "/.kattisrc"
  );

  const text = file.getText();

  console.log(text);
  const rc = parseRC(text);
  console.log(printRC(rc));

  if (rc.kattis?.loginurl) console.log(rc.kattis.loginurl);

  context.subscriptions.push(...(await initializeTesting()));

  const dir = await readdir(workspacePath.value, {
    encoding: "utf-8",
    withFileTypes: true,
  });

  for (const f of dir) {
    if (f.name.startsWith(".") || !f.isDirectory()) continue;

    const test = createTest(f.name);

    const project = new Problem(f.name, test);
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
  context.subscriptions.push(showHelloWorldCommand, tree);
}
