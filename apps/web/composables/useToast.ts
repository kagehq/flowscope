import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const toasts = ref<Toast[]>([]);

export const useToast = () => {
  const show = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type, duration };
    
    toasts.value.push(toast);
    
    setTimeout(() => {
      remove(id);
    }, duration);
    
    return id;
  };
  
  const remove = (id: string) => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  };
  
  const success = (message: string, duration?: number) => show(message, 'success', duration);
  const error = (message: string, duration?: number) => show(message, 'error', duration);
  const info = (message: string, duration?: number) => show(message, 'info', duration);
  const warning = (message: string, duration?: number) => show(message, 'warning', duration);
  
  return {
    toasts,
    show,
    remove,
    success,
    error,
    info,
    warning,
  };
};

