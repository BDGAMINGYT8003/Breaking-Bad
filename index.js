const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, ActivityType, REST, Routes, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
require('dotenv').config(); // Load .env file for local development
const db = require('./db.js');

// Retrieve token and client ID from environment variables
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
    console.error('[FATAL] DISCORD_TOKEN and CLIENT_ID must be provided in environment variables.');
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Command Loading ---
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

// --- Event Handlers ---
client.once(Events.ClientReady, async c => {
    console.log('------------------------------------------------------');
    console.log(`✅ Logged in as ${c.user.tag} (${c.user.id})`);
    console.log(`✅ Loaded ${client.commands.size} commands.`);
    console.log(`✅ Node.js version: ${process.version}`);
    console.log('------------------------------------------------------');

    const presences = [
        { name: 'over the empire', type: ActivityType.Watching },
        { name: 'with chemicals ⌬', type: ActivityType.Playing },
        { name: 'the DEA', type: ActivityType.Listening },
        { name: 'for Gus Fring', type: ActivityType.Competing },
    ];

    setInterval(() => {
        const presence = presences[Math.floor(Math.random() * presences.length)];
        client.user.setActivity(presence.name, { type: presence.type });
    }, 15000);
});

client.on(Events.InteractionCreate, async interaction => {
    const commandName = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId.split('_')[0];
    const command = client.commands.get(commandName);

    if (!command) {
        console.error(`No command matching ${commandName} was found.`);
        return;
    }

    const user = db.getUser(interaction.user.id);
    if (!user && command.data.name !== 'start') {
        const unregisteredUserComponent = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('**Account Required**'),
                new TextDisplayBuilder().setContent('You need to create an account first! Use the `/start` command to begin your empire.')
            );
        return interaction.reply({
            components: [unregisteredUserComponent],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true,
        });
    }

    try {
        if (interaction.isChatInputCommand()) {
            await command.execute(interaction);
        } else if (interaction.isButton()) {
            if (command.handleButton) await command.handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
            if (command.handleModal) await command.handleModal(interaction);
        }
    } catch (error) {
        console.error(`Error executing interaction for command ${commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this interaction!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
        }
    }
});

// --- Main Execution ---
(async () => {
    try {
        console.log(`[DEPLOY] Started refreshing ${client.commands.size} application (/) commands.`);
        const rest = new REST({ version: '10' }).setToken(token);
        const commandData = client.commands.map(cmd => cmd.data.toJSON());

        const data = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commandData },
		);
        console.log(`[DEPLOY] Successfully reloaded ${data.length} application (/) commands.`);

        await client.login(token);
    } catch (error) {
        console.error('[FATAL] An error occurred during startup:', error);
    }
})();
