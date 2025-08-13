const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const db = require('./db.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'slash');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    const commandName = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId.split('_')[0];
    const command = client.commands.get(commandName);

    if (!command) {
        console.error(`No command matching ${commandName} was found.`);
        return;
    }

    // Centralized user check for all interactions
    const user = db.getUser(interaction.user.id);
    if (!user && command.data.name !== 'start') {
        return interaction.reply({
            content: 'You need to create an account first! Use the `/start` command to begin your empire.',
            ephemeral: true,
        });
    }

    try {
        if (interaction.isChatInputCommand()) {
            await command.execute(interaction);
        } else if (interaction.isButton()) {
            if (command.handleButton) {
                await command.handleButton(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            if (command.handleModal) {
                await command.handleModal(interaction);
            }
        }
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this interaction!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
        }
    }
});

client.login(token);
