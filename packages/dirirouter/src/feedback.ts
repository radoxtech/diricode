import type { FeedbackCollector, FeedbackSubmission } from "@diricode/dirirouter";

const logFeedback = (data: unknown): void => {
  // eslint-disable-next-line no-console -- POC log-only implementation; v2 will use Elo scoring
  console.log("[feedback]", data);
};

export class LogFeedbackCollector implements FeedbackCollector {
  submit(feedback: FeedbackSubmission): Promise<void> {
    logFeedback({
      chatId: feedback.chatId,
      requestId: feedback.requestId,
      outcome: feedback.outcome,
    });
    return Promise.resolve();
  }
}
