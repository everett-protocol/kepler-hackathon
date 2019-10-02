import { Message } from "./message";
import { Handler } from "./handler";
import MessageSender = chrome.runtime.MessageSender;
import { Result } from "./interfaces";

export class MessageManager {
  private registeredMsgType: Map<string, typeof Message> = new Map();
  private registeredHandler: Map<string, Handler> = new Map();

  private port = "";

  public registerMessage(msgCls: typeof Message & { type(): string }): void {
    if (this.registeredMsgType.has(msgCls.type())) {
      throw new Error(`Already registered type ${msgCls.type()}`);
    }

    this.registeredMsgType.set(msgCls.type(), msgCls);
  }

  public addHandler(route: string, handler: Handler) {
    if (this.registeredHandler.has(route)) {
      throw new Error(`Already registered type ${route}`);
    }

    this.registeredHandler.set(route, handler);
  }

  public listen(port: string) {
    if (!port) {
      throw new Error("Empty port");
    }

    this.port = port;
    chrome.runtime.onMessage.addListener(this.onMessage);
  }

  private onMessage = (
    message: any,
    _: MessageSender,
    sendResponse: (response: Result) => void
  ) => {
    if (message.port !== this.port) {
      return;
    }

    try {
      if (!message.type) {
        sendResponse({
          error: "Null type"
        });
        return;
      }

      const msgCls = this.registeredMsgType.get(message.type);
      if (!msgCls) {
        sendResponse({
          error: `Unregistered msg type ${message.type}`
        });
        return;
      }
      const msg = Object.setPrototypeOf(
        message.msg,
        msgCls.prototype
      ) as Message;

      try {
        // Can happen throw
        msg.validateBasic();
      } catch (e) {
        if (e) {
          sendResponse({
            error: e.toString()
          });
        } else {
          sendResponse({
            error: "Fail to validate msg, and error is null"
          });
        }
        return;
      }

      const route = msg.route();
      if (!route) {
        sendResponse({
          error: "Null route"
        });
        return;
      }
      const handler = this.registeredHandler.get(route);
      if (!handler) {
        sendResponse({
          error: "Can't get handler"
        });
        return;
      }

      try {
        const result = handler(msg);
        sendResponse({
          return: result
        });
        return;
      } catch (e) {
        sendResponse({
          error: e.toString()
        });
        return;
      }
    } catch (e) {
      if (e) {
        sendResponse({
          error: e.toString()
        });
      } else {
        sendResponse({
          error: "Unknown error, and error is null"
        });
      }
      return;
    }
  };
}