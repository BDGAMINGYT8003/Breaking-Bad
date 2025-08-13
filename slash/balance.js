const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your Wallet, Treasury, and Crystal balances."),
    async execute(interaction) {
        const usersFilePath = path.join(__dirname, '..', 'database/users.json');
        const usersData = fs.readFileSync(usersFilePath, 'utf-8');
        const users = JSON.parse(usersData);
        const userData = users[interaction.user.id];

        // This check is technically redundant due to the main index.js check, but it's good practice.
        if (!userData) {
            return interaction.reply({ content: 'You need to create an account first! Use `/start`.', ephemeral: true });
        }

        const { wallet, treasury, treasuryCapacity, inventory } = userData;
        const remainingSpace = treasuryCapacity - treasury;

        const balanceEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${interaction.user.username}'s Balance`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: 'Heisenberg Bucks (₿)', value: `**Wallet:** ${wallet.toLocaleString()} ₿`, inline: true },
                { name: 'Blue Crystals (⌬)', value: `**Inventory:** ${inventory.blueCrystals.toLocaleString()} ⌬`, inline: true },
                { name: '🏦 Treasury', value: `**Stored:** ${treasury.toLocaleString()} / ${treasuryCapacity.toLocaleString()} ₿` },
                { name: 'Remaining Space', value: `${remainingSpace.toLocaleString()} ₿`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Heisenberg Bot', iconURL: 'https://i.imgur.com/AfFp7pu.png' }); // Placeholder icon

        const refreshButton = new ButtonBuilder()
            .setCustomId('balance_refresh')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');

        const stashButton = new ButtonBuilder()
            .setCustomId('balance_stash')
            .setLabel('Stash')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰');

        const haulButton = new ButtonBuilder()
            .setCustomId('balance_haul')
            .setLabel('Haul')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💸');

        const row = new ActionRowBuilder()
            .addComponents(refreshButton, stashButton, haulButton);

        await interaction.reply({
            embeds: [balanceEmbed],
            components: [row],
        });
    },
};
