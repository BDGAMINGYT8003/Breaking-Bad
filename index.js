const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');

// I am assuming the user will have a .env file for the token
// If not, they can replace process.env.DISCORD_TOKEN with their token string
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const slashCommandsPath = path.join(__dirname, 'slash');
const commandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(slashCommandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    // NOTE: The deploy-commands.js script needs to be run separately to register commands.
    // I will not create that script as it was not requested, but it is necessary for the bot to work.
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    // The core logic to check for a user account
    const usersFilePath = path.join(__dirname, 'database/users.json');
    const usersData = fs.readFileSync(usersFilePath, 'utf-8');
    const users = JSON.parse(usersData);

    // If the command is NOT 'start' and the user does NOT exist in the database, block execution.
    if (interaction.commandName !== 'start' && !users[interaction.user.id]) {
        await interaction.reply({
            content: 'You need to create an account first! Use the `/start` command to begin your empire.',
            ephemeral: true
        });
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// A .env file with DISCORD_TOKEN is required to run this.
// For example: DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
client.login(process.env.DISCORD_TOKEN);
