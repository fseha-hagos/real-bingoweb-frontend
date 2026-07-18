# Telegram Bingo Bot Setup Guide

This guide will help you set up a Telegram bot that integrates with your Bingo webapp.

## Prerequisites

- Node.js and npm installed
- A Telegram account
- Basic knowledge of Telegram Bot API

## Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather and send `/newbot`
3. Follow the instructions to create your bot:
   - Choose a name for your bot (e.g., "My Bingo Bot")
   - Choose a username (must end with 'bot', e.g., "my_bingo_bot")
4. Save the bot token you receive (you'll need this later)

## Step 2: Set Up Web App

1. Send `/newapp` to BotFather
2. Select your bot
3. Provide the following information:
   - **App title**: "Bingo Game"
   - **App description**: "Play Bingo with friends!"
   - **App photo**: Upload a bingo-related image (optional)
   - **App URL**: Your deployed webapp URL (e.g., `https://your-domain.com`)
   - **App short name**: "bingo" (this will be used in the URL)

## Step 3: Deploy Your Webapp

### Option A: Vercel (Recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. In your project directory, run: `vercel`
3. Follow the prompts to deploy
4. Copy the deployment URL

### Option B: Netlify

1. Build your project: `npm run build`
2. Upload the `out` folder to Netlify
3. Copy the deployment URL

### Option D: Other Hosting

Any static hosting service that supports Next.js will work.

## Step 4: Configure Bot Commands

Send these commands to BotFather:

```
/setcommands
@your_bot_username
start - Start playing Bingo
help - Get help with the game
stats - View your game statistics
```

## Step 5: Test Your Bot

1. Find your bot in Telegram (search for the username you created)
2. Send `/start` to your bot
3. The bot should respond with a "Play Bingo" button
4. Click the button to open your webapp

## Bot Implementation Example

Here's a basic Node.js bot implementation using the `node-telegram-bot-api` library:

```javascript
const TelegramBot = require('node-telegram-bot-api');

// Replace with your bot token
const token = 'YOUR_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Replace with your webapp URL
const webAppUrl = 'https://your-deployed-app.vercel.app';

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{
          text: '🎲 Play Bingo',
          web_app: { url: webAppUrl }
        }]
      ]
    }
  };
  
  bot.sendMessage(chatId, 'Welcome to Bingo! Click the button below to start playing.', options);
});

// Handle web app data
bot.on('web_app_data', (msg) => {
  const chatId = msg.chat.id;
  const data = JSON.parse(msg.web_app_data.data);
  
  if (data.action === 'bingo_complete') {
    const winMessage = `🎉 Congratulations! You completed a ${data.winType}!\n` +
                      `Game time: ${Math.round(data.gameTime / 1000)}s\n` +
                      `Games played: ${data.stats.gamesPlayed + 1}`;
    
    bot.sendMessage(chatId, winMessage);
  }
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `🎲 Bingo Game Help

How to play:
1. Click the "Play Bingo" button to open the game
2. Click on numbers to mark them
3. Complete a row, column, or diagonal to win!

Commands:
/start - Start playing
/help - Show this help
/stats - View your statistics`;
  
  bot.sendMessage(chatId, helpText);
});

// Stats command
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  // You can implement user statistics storage here
  bot.sendMessage(chatId, 'Statistics feature coming soon!');
});

console.log('Bot is running...');
```

## Environment Variables

Create a `.env` file in your bot project:

```
BOT_TOKEN=your_bot_token_here
WEBAPP_URL=https://your-deployed-app.vercel.app
```

## Features Implemented

### Webapp Features:
- ✅ Modern, responsive UI with dark theme
- ✅ Interactive 5x5 Bingo grid
- ✅ Multiple win conditions (rows, columns, diagonals)
- ✅ Game statistics tracking
- ✅ Telegram Web App integration
- ✅ User data collection
- ✅ Win animations and feedback
- ✅ Mobile-optimized design

### Bot Integration:
- ✅ Web App button in bot interface
- ✅ Data reception from webapp
- ✅ User feedback on game completion
- ✅ Game statistics display

## Customization

### Changing Colors
Edit the CSS variables in `src/app/globals.css`:
```css
:root {
  --background: #1a1a2e;
  --primary: #4ecdc4;
  --secondary: #ff6b6b;
  --accent: #16213e;
}
```

### Adding More Game Features
- Modify `src/components/BingoCard.tsx` for game logic changes
- Update `src/app/page.tsx` for UI modifications
- Add new components in `src/components/`

## Troubleshooting

### Bot Not Responding
- Check if the bot token is correct
- Ensure the bot is not blocked
- Verify the webapp URL is accessible

### Webapp Not Loading
- Check if the deployment URL is correct
- Ensure the Telegram script is loading
- Check browser console for errors

### Data Not Sending
- Verify the webapp is running in Telegram
- Check if `window.Telegram.WebApp` is available
- Ensure the bot is listening for `web_app_data` events

## Security Notes

- Never expose your bot token in client-side code
- Validate all data received from the webapp
- Use HTTPS for your webapp deployment
- Consider implementing user authentication if needed

## Support

For issues or questions:
1. Check the Telegram Bot API documentation
2. Review the Next.js documentation
3. Check the browser console for errors
4. Verify your deployment is working correctly
