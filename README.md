# KHProAccount Telegram Bot & Admin Dashboard

ប្រព័ន្ធ Telegram Bot ជាមួយនឹងផ្ទាំងគ្រប់គ្រង Admin Web UI សម្រាប់គ្រប់គ្រងសារស្វាគមន៍ (Welcome Message), ប៊ូតុង Inline, និងការផ្សព្វផ្សាយសារ (Broadcast Message)។

## មុខងារចម្បង (Features)
- 🤖 **Telegram Bot**: ឆ្លើយតប `/start` ជាមួយនឹងសារ Welcome និងប៊ូតុងស្វ័យប្រវត្តិ
- 🌐 **Admin Web UI**: ផ្ទាំងគ្រប់គ្រងលើ Browser ងាយស្រួលប្រើប្រាស់
- 💬 **Live Editing**: កែប្រែសារស្វាគមន៍ និងប៊ូតុងបានភ្លាមៗដោយមិនបាច់ Restart Bot
- 📢 **Broadcast**: ផ្ញើសារជូនដំណឹងទៅកាន់អ្នកប្រើប្រាស់ទាំងអស់ដំណាលគ្នា
- 📋 **Message Logs**: មើលប្រវត្តិសារដែល User បានផ្ញើមក

## របៀបដំឡើង និងដំណើរការ (Installation & Setup)

1. Clone repository នេះ៖
   ```bash
   git clone https://github.com/Visith10/KHProAccount_bot.git
   cd KHProAccount_bot
   ```

2. បង្កើតឯកសារ `.env` (ចម្លងពី `.env.example`)៖
   ```bash
   BOT_TOKEN=your_bot_token_here
   PORT=3000
   ```

3. ដំណើរការ Bot & Web UI៖
   ```bash
   node index.js
   ```

4. បើក Browser ហើយចូលទៅកាន់៖
   ```
   http://localhost:3000
   ```
   *(ឬ Port ផ្សេងទៀតដែល Terminal បានបង្ហាញ)*
