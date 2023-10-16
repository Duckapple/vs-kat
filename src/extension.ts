import { commands, ExtensionContext, workspace, window } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";
import { parseRC, printRC } from "./utilities/handleRcFile";
import { initializeTesting } from "./test/test-panel";

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

  context.subscriptions.push(...(await initializeTesting()));

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
