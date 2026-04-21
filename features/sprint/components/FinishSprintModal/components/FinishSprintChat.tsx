/**
 * Компонент отправки итогов спринта в чат
 */

import { Input } from '@/components/Input';

interface FinishSprintChatProps {
  selectedChat: string;
  sendToChat: boolean;
  onSelectedChatChange: (value: string) => void;
  onSendToChatChange: (value: boolean) => void;
}

export function FinishSprintChat({
  sendToChat,
  selectedChat,
  onSendToChatChange,
  onSelectedChatChange,
}: FinishSprintChatProps) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input
          checked={sendToChat}
          className="w-4 h-4 accent-blue-500 dark:accent-blue-400"
          type="checkbox"
          onChange={(e) => onSendToChatChange(e.target.checked)}
        />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Отправить итоги спринта в чат
        </span>
      </label>
      {sendToChat && (
        <div>
          <Input
            className="px-3 py-2 text-sm rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Введите название или ID чата"
            type="text"
            value={selectedChat}
            onChange={(e) => onSelectedChatChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

