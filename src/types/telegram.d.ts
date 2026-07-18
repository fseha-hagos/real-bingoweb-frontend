// types/telegram.d.ts
export {};

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData?: string;
        ready: () => void;
        expand: () => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
      };
    };
  }
}
