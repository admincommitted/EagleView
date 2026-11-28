// EagleView AI assistant: answers from the database (job / BE / SB / importer / summary / duty / exchange rate, Gemini
// for general questions); every message is saved per user, so the chat comes back after a reload or on another PC.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, Loader2, Send, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Input } from '@/components/ui';
import { askConfirm } from './common/askConfirm';
import { sharedWidgetsApi } from './common/sharedWidgetsApi';

const WELCOME = {
  id: 'welcome',
  text: "Hi there! I'm your Eagleview AI Assistant. Ask me about a job no, BE / SB no, importer, today's summary, a duty rate (CTH) or an exchange rate.",
  sender: 'bot',
  timestamp: new Date(),
};
const SUGGESTIONS = ["Today's summary", 'Pending jobs', 'BE 1234567', 'duty 85171300', 'rate USD', 'help'];
const BLINK_KEYFRAMES = '@keyframes chatbot-blink { 0%, 96%, 98%, 100% { transform: scaleY(1); opacity: 1; } 97%, 99% { transform: scaleY(0.1); opacity: 0.5; } }';

const toMessage = (saved) => ({ id: saved.id, text: saved.text, sender: saved.role === 'user' ? 'user' : 'bot', timestamp: saved.createdAt });

// WhatsApp-style time: "10:42 am", "Yesterday, 10:42 am", "21 Nov, 10:42 am"
function chatTime(when) {
  const date = new Date(when);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (date.toDateString() === now.toDateString()) return time;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${time}`;
}

function RobotAvatar({ className }) {
  const picture = 'tw:absolute tw:inset-0 tw:size-full tw:object-cover';
  return (
    <div className={cn('tw:relative tw:shrink-0 tw:overflow-hidden tw:rounded-full tw:bg-white', className)}>
      <img src="/robot.png" alt="Robot" className={picture} />
      <div className="tw:absolute tw:inset-0 tw:z-[1] tw:bg-primary tw:mix-blend-hue" />
      <img
        src="/robot.png"
        alt="Robot Eyes"
        className={cn(
          picture,
          'tw:z-[2] tw:origin-[center_45%] tw:animate-[chatbot-blink_5s_infinite] tw:brightness-[1.8]',
          'tw:[mask-image:radial-gradient(circle_at_50%_45%,black_20%,transparent_35%)]'
        )}
      />
    </div>
  );
}

function MessageBubble({ message, onRetry }) {
  const fromUser = message.sender === 'user';
  return (
    <div className={cn('tw:flex tw:max-w-[85%] tw:gap-2.5', fromUser ? 'tw:flex-row-reverse tw:self-end' : 'tw:self-start')}>
      {!fromUser && <RobotAvatar className="tw:mt-auto tw:size-7" />}
      <div
        onClick={() => onRetry(message)}
        title={message.failed ? 'Not sent - tap to send again' : undefined}
        className={cn(
          'tw:min-w-20 tw:px-3.5 tw:pt-2.5 tw:pb-1.5 tw:text-[13px] tw:leading-normal',
          fromUser
            ? 'tw:rounded-[20px_20px_4px_20px] tw:bg-linear-135 tw:from-primary tw:to-head tw:text-white'
            : 'tw:rounded-[20px_20px_20px_4px] tw:border tw:border-border tw:bg-background tw:text-foreground',
          message.pending && 'tw:opacity-75',
          message.failed && 'tw:cursor-pointer tw:outline-2 tw:outline-destructive/40'
        )}
      >
        <div className={cn('tw:break-words tw:whitespace-pre-wrap', message.error && 'tw:text-destructive')}>{message.text}</div>
        <div className="tw:mt-1 tw:flex tw:items-center tw:justify-end tw:gap-1">
          <span className={cn('tw:text-[10px] tw:whitespace-nowrap', fromUser ? 'tw:text-white/70' : 'tw:text-muted-foreground')}>
            {message.timestamp ? chatTime(message.timestamp) : ''}
          </span>
          {fromUser && !message.pending && !message.failed && <CheckCheck className="tw:size-3.5 tw:shrink-0 tw:text-white/85" />}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="tw:flex tw:max-w-[85%] tw:items-center tw:gap-2.5 tw:self-start">
      <div className="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-primary">
        <Loader2 className="tw:size-4 tw:animate-spin tw:text-white" />
      </div>
      <div className="tw:flex tw:gap-1 tw:rounded-[20px_20px_20px_4px] tw:border tw:border-border tw:bg-background tw:px-4 tw:py-3">
        {['tw:[animation-delay:100ms]', 'tw:[animation-delay:200ms]', 'tw:[animation-delay:300ms]'].map((delay) => (
          <span key={delay} className={cn('tw:size-1.5 tw:animate-bounce tw:rounded-full tw:bg-input', delay)} />
        ))}
      </div>
    </div>
  );
}

export default function ChatBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const keepScrollRef = useRef(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (keepScrollRef.current) {
      keepScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  const loadHistory = useCallback(async (before) => {
    try {
      setLoadError('');
      const answer = await sharedWidgetsApi.chatHistory(before);
      if (!answer.success) throw new Error(answer.error || 'could not load the chat');
      if (before) keepScrollRef.current = true;
      const older = answer.data.map(toMessage);
      setMessages((current) => (before ? [...older, ...current] : older));
      setHasMore(Boolean(answer.more));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isOpen && !loaded) loadHistory();
  }, [isOpen, loaded, loadHistory]);

  const handleSend = async (preset) => {
    const text = String(preset !== undefined ? preset : input).trim();
    if (!text || isTyping) return;
    const tempId = `tmp-${Date.now()}`;
    setMessages((current) => [...current, { id: tempId, text, sender: 'user', timestamp: new Date(), pending: true }]);
    setInput('');
    setIsTyping(true);
    try {
      const answer = await sharedWidgetsApi.sendChatMessage({ text, page: window.location.pathname });
      if (!answer.success) throw new Error(answer.error || 'no answer');
      setMessages((current) => [...current.filter((message) => message.id !== tempId), ...answer.data.map(toMessage)]);
    } catch (error) {
      setMessages((current) => [
        ...current.map((message) => (message.id === tempId ? { ...message, pending: false, failed: true } : message)),
        {
          id: `err-${Date.now()}`,
          text: `Could not reach the server (${errorMessage(error)}). Your message was not saved - tap it to send again.`,
          sender: 'bot',
          timestamp: new Date(),
          error: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const retry = (failedMessage) => {
    if (!failedMessage.failed) return;
    setMessages((current) => current.filter((message) => message.id !== failedMessage.id && !message.error));
    handleSend(failedMessage.text);
  };

  const clearChat = async () => {
    const goAhead = await askConfirm({ title: 'Clear chat', message: 'Delete your whole chat history with EagleView AI?', okLabel: 'Delete', tone: 'danger' });
    if (!goAhead) return;
    try {
      await sharedWidgetsApi.clearChatHistory();
      setMessages([]);
      setHasMore(false);
    } catch {
      // the chat stays on screen
    }
  };

  const oldestSavedId = () => messages.find((message) => typeof message.id === 'number')?.id;
  const shown = messages.length ? messages : [WELCOME];
  const canSend = Boolean(input.trim());
  const headerButton = 'tw:size-8 tw:rounded-full tw:bg-white/10 tw:text-white tw:hover:bg-white/20';

  return (
    <>
      <style>{BLINK_KEYFRAMES}</style>

      <Button
        variant="ghost"
        aria-label="Open the EagleView AI assistant"
        onClick={() => setIsOpen(true)}
        className={cn(
          'tw:group tw:fixed tw:right-[35px] tw:bottom-[35px] tw:z-[9999] tw:size-[60px] tw:rounded-full tw:border-0 tw:bg-white tw:p-0 tw:transition-transform tw:duration-400 tw:hover:scale-105 tw:hover:bg-white',
          isOpen ? 'tw:scale-0' : 'tw:scale-100'
        )}
      >
        <span className="tw:absolute tw:inset-0 tw:animate-ping tw:rounded-full tw:border-2 tw:border-primary tw:opacity-50" />
        <RobotAvatar className="tw:size-full" />
      </Button>

      <div
        className={cn(
          'tw:fixed tw:inset-x-2 tw:bottom-2 tw:z-[10000] tw:flex tw:h-[min(550px,calc(100dvh-16px))] tw:flex-col tw:overflow-hidden tw:rounded-3xl tw:bg-background tw:normal-case tw:ring-1 tw:ring-black/5 tw:transition-all tw:duration-400',
          'tw:sm:inset-x-auto tw:sm:right-[30px] tw:sm:bottom-[30px] tw:sm:w-[380px]',
          isOpen ? 'tw:pointer-events-auto tw:translate-y-0 tw:scale-100 tw:opacity-100' : 'tw:pointer-events-none tw:translate-y-5 tw:scale-90 tw:opacity-0'
        )}
      >
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-white/10 tw:bg-linear-135 tw:from-primary tw:to-head tw:p-5 tw:text-white">
          <div className="tw:flex tw:items-center tw:gap-3.5">
            <RobotAvatar className="tw:size-10 tw:rounded-xl" />
            <div>
              <h4 className="tw:m-0 tw:text-[15px] tw:font-extrabold tw:tracking-wide tw:text-white">EAGLEVIEW AI</h4>
              <div className="tw:mt-0.5 tw:flex tw:items-center tw:gap-1.5">
                <span className="tw:size-1.5 tw:rounded-full tw:bg-success" />
                <span className="tw:text-[11px] tw:font-semibold tw:text-white/85">Always Online</span>
              </div>
            </div>
          </div>
          <div className="tw:flex tw:gap-2">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" title="Clear chat history" className={headerButton} onClick={clearChat}>
                <Trash2 />
              </Button>
            )}
            <Button variant="ghost" size="icon" title="Close" className={headerButton} onClick={() => setIsOpen(false)}>
              <X className="tw:size-[18px]" strokeWidth={2.5} />
            </Button>
          </div>
        </div>

        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:bg-page tw:p-5">
          {hasMore && (
            <Button size="sm" className="tw:self-center tw:rounded-full" onClick={() => loadHistory(oldestSavedId())}>
              Load older messages
            </Button>
          )}
          {isOpen && !loaded && <div className="tw:self-center tw:text-[11px] tw:text-muted-foreground">Loading your chat...</div>}
          {loadError && (
            <div className="tw:self-center tw:text-[11px] tw:text-destructive">
              Chat history not loaded: {loadError}{' '}
              <Button variant="link" size="sm" className="tw:h-auto tw:text-[11px] tw:text-destructive tw:underline" onClick={() => loadHistory()}>retry</Button>
            </div>
          )}
          {shown.map((message) => <MessageBubble key={message.id} message={message} onRetry={retry} />)}
          {isTyping && <TypingIndicator />}
          {loaded && messages.length === 0 && !isTyping && (
            <div className="tw:ml-[38px] tw:flex tw:flex-wrap tw:gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion} size="sm" className="tw:rounded-full tw:border-primary tw:text-primary" onClick={() => handleSend(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="tw:flex tw:items-center tw:gap-3 tw:border-t tw:border-border tw:bg-background tw:p-4">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleSend(); } }}
            maxLength={2000}
            placeholder="Ask: job no, BE no, duty 85171300, rate USD..."
            data-allow-text=""
            className="tw:h-auto tw:flex-1 tw:rounded-3xl tw:bg-page tw:px-4 tw:py-3.5 tw:text-[13px]"
          />
          <Button
            variant="default"
            size="icon"
            aria-label="Send"
            onClick={() => handleSend()}
            disabled={!canSend || isTyping}
            className={cn(
              'tw:size-[46px] tw:rounded-full tw:border-0 tw:transition-all',
              canSend ? 'tw:scale-100 tw:bg-linear-135 tw:from-primary tw:to-head' : 'tw:scale-95 tw:bg-input'
            )}
          >
            <Send className="tw:ml-0.5 tw:size-[18px]" />
          </Button>
        </div>
      </div>
    </>
  );
}
