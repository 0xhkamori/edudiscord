# 🏫 Vulcan Schedule Discord Bot

Discord Bot client for EduVulcan e-diary that brings your school schedule, homework, and exams directly to Discord!

## ✨ Features

- 📅 Display your school schedule in a beautifully formatted way in Discord
- 📚 View homework assignments with detailed descriptions
- 📝 Check upcoming exams and tests
- 🗓️ Support for custom date ranges
- 🔄 Automatic current week detection
- 📋 Detailed lesson information including subjects, teachers, rooms, and times
- 🕒 Time formatting with AM/PM for better readability

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 16.9.0 or higher
- A Discord bot token (see below for how to create one)
- Vulcan account credentials (configured in the `.env` file)

### Creating a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under the "TOKEN" section, click "Copy" to copy your bot token
5. Under "Privileged Gateway Intents", enable:
   - MESSAGE CONTENT INTENT
   - SERVER MEMBERS INTENT
   - PRESENCE INTENT

### Inviting the Bot to Your Server

1. In the Discord Developer Portal, go to the "OAuth2" tab
2. In the "URL Generator" section, select the following scopes:
   - bot
   - applications.commands
3. In the "Bot Permissions" section, select:
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Use External Emojis
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to and click "Authorize"

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your Discord token and Vulcan API data:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   VULCAN_APIAP='<html>...'  # HTML page from eduvulcan.pl/api/ap
   ```
4. Start the bot:
   ```
   npm start
   ```

## 🤖 Usage

The bot responds to the following commands:

### Schedule Commands
- `!plan` - Shows the schedule for the current day
- `!data` - Shows the schedule for one week starting from today
- `!data YYYY-MM-DD` - Shows the schedule for one week starting from the specified date
- `!data YYYY-MM-DD YYYY-MM-DD` - Shows the schedule between the two specified dates

### Homework Commands
- `!zadanie` - Shows homework assignments for the current week

### Exam Commands
- `!testy` - Shows exams for the current week
