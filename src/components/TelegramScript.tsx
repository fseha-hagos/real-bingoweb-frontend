import Script from 'next/script';

const TelegramScript = () => {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
    />
  );
};

export default TelegramScript;
