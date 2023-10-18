import { ExtensionContext } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";
import { parseRC, printRC } from "./utilities/handleRcFile";
import { createTest, initializeTesting } from "./test/test-panel";
import { rc, workspacePath } from "./globals";
import { Problem } from "./model";
import fs = require("fs/promises");
import vscode = require("vscode");

const { commands, workspace, window } = vscode;

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
  rc.value = parseRC(text);
  console.log(printRC(rc.value));

  if (rc.value.kattis?.loginurl) console.log(rc.value.kattis.loginurl);

  context.subscriptions.push(...(await initializeTesting()));

  const dir = await fs.readdir(workspacePath.value, {
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
        if (!rc.value?.contest) return [];
        return element == null
          ? Object.keys(rc.value?.contest).filter((key) => key !== "contest")
          : [];
      },
      getTreeItem(element) {
        return {
          label: `${element}: ${rc.value?.contest?.[element]}`,
        };
      },
    },
  });

  await commands.executeCommand("setContext", "vs-kat.has-problems", true);
  await commands.executeCommand(
    "setContext",
    "vs-kat.contest-mode",
    rc.value?.contest != null
  );

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand, tree);
}
