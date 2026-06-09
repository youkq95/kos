export type IncomingTextMessage = {
  messageId?: string;
  senderId: string;
  chatId: string;
  text: string;
  timestamp: Date;
  contextToken?: string;
  isGroupChat?: boolean;
  raw?: unknown;
};

export type CaptureCommand =
  | {
      type: "capture";
      content: string;
    }
  | {
      type: "empty";
    }
  | {
      type: "help";
    }
  | {
      type: "ignore";
    };

export type HandleResult =
  | {
      action: "reply";
      text: string;
    }
  | {
      action: "ignore";
    };

export type CaptureLogEntry = {
  content: string;
  timestamp: Date;
  source: "wechat";
};
