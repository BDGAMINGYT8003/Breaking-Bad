const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../db.js');

// Helper function to create the balance embed, can be reused
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
        .setFooter({ text: 'Heisenberg Bot' });
}

// Helper function to parse amounts like "10k", "1.5m", "all"
function parseAmount(amountStr, wallet, treasury, context) {
    const cleanedStr = amountStr.toLowerCase().trim();
    if (cleanedStr === 'all' || cleanedStr === 'max') {
        return context === 'stash' ? wallet : treasury;
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


module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your Wallet, Treasury, and Crystal balances."),

    async execute(interaction) {
        const userData = db.getUser(interaction.user.id);
        const balanceEmbed = createBalanceEmbed(interaction.user, userData);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('balance_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('balance_stash').setLabel('Stash').setStyle(ButtonStyle.Success).setEmoji('💰'),
                new ButtonBuilder().setCustomId('balance_haul').setLabel('Haul').setStyle(ButtonStyle.Danger).setEmoji('💸')
            );

        await interaction.reply({
            embeds: [balanceEmbed],
            components: [row],
        });
    },

    async handleButton(interaction) {
        const action = interaction.customId.split('_')[1];

        if (action === 'refresh') {
            const userData = db.getUser(interaction.user.id);
            const newEmbed = createBalanceEmbed(interaction.user, userData);
            await interaction.update({ embeds: [newEmbed] });
        } else if (action === 'stash' || action === 'haul') {
            const modal = new ModalBuilder()
                .setCustomId(`balance_${action}_modal`)
                .setTitle(action === 'stash' ? 'Stash to Treasury' : 'Haul from Treasury');

            const amountInput = new TextInputBuilder()
                .setCustomId(`${action}_amount_input`)
                .setLabel(`Amount to ${action} (e.g., 50k, 1m, all)`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const actionRow = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(actionRow);
            await interaction.showModal(modal);
        }
    },

    async handleModal(interaction) {
        const action = interaction.customId.split('_')[1]; // 'stash' or 'haul'
        const amountStr = interaction.fields.getTextInputValue(`${action}_amount_input`);
        const userData = db.getUser(interaction.user.id);

        const amount = parseAmount(amountStr, userData.wallet, userData.treasury, action);

        if (amount === null || !Number.isInteger(amount) || amount <= 0) {
            return interaction.reply({ content: "That's not a valid amount.", ephemeral: true });
        }

        if (action === 'stash') {
            if (amount > userData.wallet) {
                return interaction.reply({ content: "You don't have that much in your wallet.", ephemeral: true });
            }
            const space = userData.treasuryCapacity - userData.treasury;
            if (amount > space) {
                return interaction.reply({ content: "You don't have enough space in your treasury.", ephemeral: true });
            }
            db.updateUser(interaction.user.id, {
                wallet: userData.wallet - amount,
                treasury: userData.treasury + amount
            });
            await interaction.reply({ content: `You successfully stashed **${amount.toLocaleString()} ₿**.`, ephemeral: true });
        } else if (action === 'haul') {
            if (amount > userData.treasury) {
                return interaction.reply({ content: "You don't have that much in your treasury.", ephemeral: true });
            }
            db.updateUser(interaction.user.id, {
                treasury: userData.treasury - amount,
                wallet: userData.wallet + amount
            });
            await interaction.reply({ content: `You successfully hauled **${amount.toLocaleString()} ₿**.`, ephemeral: true });
        }
    }
};
