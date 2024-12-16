import { ActivityHandler, MessageFactory } from 'botbuilder';

export class EchoBot extends ActivityHandler {
  private sessions: Map<string, { sessionId: string; chatId: string; overrideConfig?: { sessionId: string } }> = new Map();

  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const question = context.activity.text;
      const conversationId = context.activity.conversation.id;
      let sessionInfo = this.sessions.get(conversationId);

      // If session does not exist, initialize it with empty values
      if (!sessionInfo) {
        sessionInfo = { sessionId: '', chatId: '' };
        this.sessions.set(conversationId, sessionInfo);
      }

      const data = { question };
      if (sessionInfo.sessionId && process.env.FSAI_AGENT_MEMORY !== NULL && process.env.FSAI_AGENT_MEMORY !== undefined) {
        data['sessionId'] = sessionInfo.sessionId;
        data['chatId'] = sessionInfo.chatId;
      }
      const response = await this.query(data);

      // Update session information after the first call
      if (!sessionInfo.sessionId && response.sessionId && response.chatId) {
        sessionInfo.sessionId = response.sessionId;
        sessionInfo.chatId = response.chatId;
        sessionInfo.overrideConfig = { sessionId: response.sessionId };

        this.sessions.set(conversationId, sessionInfo);
      }

      // Send response text to user
      await context.sendActivity(MessageFactory.text(response.text, response.text));
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = 'Hello, I am FSAI digital worker. Please let me know what I can help you';
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }

  query = async (data: { [k: string]: any }): Promise<any> => {
    const response: Response = await fetch(process.env.FSAI_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FSAI_AGENT_SECRET}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    let responseText = result.agentReasoning?.[0]?.messages ? result.agentReasoning[0].messages.join(" ") : result?.text;

    // Return the entire response, including sessionId and chatId for tracking
    return { text: responseText || 'talk later...', sessionId: result.sessionId, chatId: result.chatId };
  };
}
