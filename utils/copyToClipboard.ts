import toast from 'react-hot-toast';

export async function copyTextToClipboard(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error('Не удалось скопировать');
  }
}
