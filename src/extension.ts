import { commands, ExtensionContext } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";

export function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand(
    "vs-kat.showHelloWorld",
    () => {
      HelloWorldPanel.render(context.extensionUri);
    }
  );

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}
