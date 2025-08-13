const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, ModalBuilder, TextInputBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, TextInputStyle } = require('discord.js');

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

// Helper function to create the balance embed
function createBalanceEmbed(user, userData) {
    const { wallet, treasury, treasuryCapacity, inventory } = userData;
    const remainingSpace = treasuryCapacity - treasury;

    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`${user.username}'s Balance`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: 'Heisenberg Bucks (₿)', value: `**Wallet:** ${wallet.toLocaleString()} ₿`, inline: true },
            { name: 'Blue Crystals (⌬)', value: `**Inventory:** ${inventory.blueCrystals.toLocaleString()} ⌬`, inline: true },
            { name: '🏦 Treasury', value: `**Stored:** ${treasury.toLocaleString()} / ${treasuryCapacity.toLocaleString()} ₿` },
            { name: 'Remaining Space', value: `${remainingSpace.toLocaleString()} ₿`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Heisenberg Bot', iconURL: 'https://i.imgur.com/AfFp7pu.png' });
}

// Helper function to parse amounts like "10k", "1.5m", "all"
function parseAmount(amountStr, wallet, treasury) {
    const cleanedStr = amountStr.toLowerCase().trim();
    if (cleanedStr === 'all' || cleanedStr === 'max') {
        return wallet; // In the context of stashing, 'all' means the entire wallet
    }
    if (cleanedStr.endsWith('k')) {
        return Math.floor(parseFloat(cleanedStr) * 1000);
    }
    if (cleanedStr.endsWith('m')) {
        return Math.floor(parseFloat(cleanedStr) * 1000000);
    }
    const num = parseInt(cleanedStr, 10);
    return isNaN(num) ? null : num;
}

function parseHaulAmount(amountStr, treasury) {
    const cleanedStr = amountStr.toLowerCase().trim();
    if (cleanedStr === 'all' || cleanedStr === 'max') {
        return treasury; // In hauling, 'all' means the entire treasury
    }
    return parseAmount(amountStr, 0); // Reuse main parser, wallet balance is irrelevant here
}


client.on(Events.InteractionCreate, async interaction => {
    const usersFilePath = path.join(__dirname, 'database/users.json');

    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        const usersData = fs.readFileSync(usersFilePath, 'utf-8');
        const users = JSON.parse(usersData);

        if (interaction.commandName !== 'start' && !users[interaction.user.id]) {
            return interaction.reply({ content: 'You need to create an account first! Use the `/start` command.', ephemeral: true });
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
        }
    } else if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === 'balance_refresh') {
            const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
            const userData = users[interaction.user.id];
            const newEmbed = createBalanceEmbed(interaction.user, userData);
            await interaction.update({ embeds: [newEmbed] });
        } else if (customId === 'balance_stash') {
            const modal = new ModalBuilder()
                .setCustomId('balance_stash_modal')
                .setTitle('Stash to Treasury');
            const amountInput = new TextInputBuilder()
                .setCustomId('stash_amount_input')
                .setLabel("Amount to Stash (e.g., 50k, 1m, all)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            const actionRow = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(actionRow);
            await interaction.showModal(modal);
        } else if (customId === 'balance_haul') {
            const modal = new ModalBuilder()
                .setCustomId('balance_haul_modal')
                .setTitle('Haul from Treasury');
            const amountInput = new TextInputBuilder()
                .setCustomId('haul_amount_input')
                .setLabel("Amount to Haul (e.g., 50k, 1m, all)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            const actionRow = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(actionRow);
            await interaction.showModal(modal);
        }
    } else if (interaction.isModalSubmit()) {
        const { customId } = interaction;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
        const userData = users[interaction.user.id];

        if (customId === 'balance_stash_modal') {
            const amountStr = interaction.fields.getTextInputValue('stash_amount_input');
            const amount = parseAmount(amountStr, userData.wallet);

            if (amount === null || amount <= 0) {
                return interaction.reply({ content: "That's not a valid amount.", ephemeral: true });
            }
            if (amount > userData.wallet) {
                return interaction.reply({ content: "You don't have that much in your wallet.", ephemeral: true });
            }
            const space = userData.treasuryCapacity - userData.treasury;
            if (amount > space) {
                return interaction.reply({ content: "You don't have enough space in your treasury.", ephemeral: true });
            }

            userData.wallet -= amount;
            userData.treasury += amount;
            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));
            await interaction.reply({ content: `You successfully stashed **${amount.toLocaleString()} ₿**.`, ephemeral: true });

        } else if (customId === 'balance_haul_modal') {
            const amountStr = interaction.fields.getTextInputValue('haul_amount_input');
            const amount = parseHaulAmount(amountStr, userData.treasury);

            if (amount === null || amount <= 0) {
                return interaction.reply({ content: "That's not a valid amount.", ephemeral: true });
            }
            if (amount > userData.treasury) {
                return interaction.reply({ content: "You don't have that much in your treasury.", ephemeral: true });
            }

            userData.treasury -= amount;
            userData.wallet += amount;
            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));
            await interaction.reply({ content: `You successfully hauled **${amount.toLocaleString()} ₿**.`, ephemeral: true });
        }
    }
});

// A .env file with DISCORD_TOKEN is required to run this.
// For example: DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
client.login(process.env.DISCORD_TOKEN);
