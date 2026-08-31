import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Sparkles } from 'lucide-react';
import { MeetingMessage } from '../../types/meeting';

interface MeetingChatProps {
  messages: MeetingMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export const MeetingChat: React.FC<MeetingChatProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTime = (ts: string | number) => {
    try {
      const d = new Date(Number(ts));
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <aside className="w-80 sm:w-96 border-l border-neutral-800 bg-[#181C1B] flex flex-col z-30 animate-slide-left select-none">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#2E7D5B]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono">
            In-Call Chat
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-0 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-500 space-y-2">
            <MessageSquare className="w-8 h-8 opacity-40" />
            <p className="text-xs font-bold text-neutral-400">No messages yet</p>
            <p className="text-[11px] text-neutral-500">
              Messages sent here are visible to everyone in this meeting.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`space-y-1 ${isMe ? 'items-end text-right' : 'items-start text-left'}`}
              >
                <div className="flex items-center gap-2">
                  {!isMe && (
                    <img
                      src={
                        msg.senderAvatar ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          msg.senderName
                        )}`
                      }
                      alt={msg.senderName}
                      className="w-5 h-5 rounded-md object-cover"
                    />
                  )}
                  <span
                    className={`text-[11px] font-bold ${
                      isMe ? 'text-[#2E7D5B]' : 'text-neutral-300'
                    }`}
                  >
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[9px] text-neutral-500 font-mono">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-2xl max-w-[85%] break-words inline-block leading-relaxed ${
                    isMe
                      ? 'bg-[#1F5E4B] text-white rounded-tr-none'
                      : 'bg-neutral-800/80 text-neutral-200 rounded-tl-none border border-neutral-700/50'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-800 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message to everyone..."
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1F5E4B] transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white transition disabled:opacity-40 disabled:hover:bg-[#1F5E4B]"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
