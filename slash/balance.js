const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const db = require('../db.js');

// Helper function to create the balance component
function createBalanceComponent(user, userData) {
    const { wallet, treasury, treasuryCapacity, inventory } = userData;
    const remainingSpace = treasuryCapacity - treasury;

    return new ContainerBuilder()
        .setAccentColor(0x0099FF)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${user.username}'s Balance**`),
            new TextDisplayBuilder().setContent(`**Wallet:** ${wallet.toLocaleString()} ₿`),
            new TextDisplayBuilder().setContent(`**Inventory:** ${inventory.blueCrystals.toLocaleString()} ⌬`),
            new TextDisplayBuilder().setContent(`**🏦 Treasury:** ${treasury.toLocaleString()} / ${treasuryCapacity.toLocaleString()} ₿`),
            new TextDisplayBuilder().setContent(`*Remaining Space: ${remainingSpace.toLocaleString()} ₿*`)
        );
}

// Helper function to parse amounts
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
        const balanceComponent = createBalanceComponent(interaction.user, userData);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('balance_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('balance_stash').setLabel('Stash').setStyle(ButtonStyle.Success).setEmoji('💰'),
                new ButtonBuilder().setCustomId('balance_haul').setLabel('Haul').setStyle(ButtonStyle.Danger).setEmoji('💸')
            );

        await interaction.reply({
            components: [balanceComponent, row],
            flags: MessageFlags.IsComponentsV2,
        });
    },

    async handleButton(interaction) {
        const action = interaction.customId.split('_')[1];

        if (action === 'refresh') {
            const userData = db.getUser(interaction.user.id);
            const newComponent = createBalanceComponent(interaction.user, userData);
            const row = interaction.message.components[1]; // Get the existing button row
            await interaction.update({ components: [newComponent, row], flags: MessageFlags.IsComponentsV2 });
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
        const action = interaction.customId.split('_')[1];
        const amountStr = interaction.fields.getTextInputValue(`${action}_amount_input`);
        const userData = db.getUser(interaction.user.id);

        const amount = parseAmount(amountStr, userData.wallet, userData.treasury, action);

        let replyComponent;

        if (amount === null || !Number.isInteger(amount) || amount <= 0) {
            replyComponent = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent("That's not a valid amount."));
            return interaction.reply({ components: [replyComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        if (action === 'stash') {
            if (amount > userData.wallet) {
                replyComponent = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent("You don't have that much in your wallet."));
            } else if (amount > (userData.treasuryCapacity - userData.treasury)) {
                replyComponent = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent("You don't have enough space in your treasury."));
            } else {
                db.updateUser(interaction.user.id, { wallet: userData.wallet - amount, treasury: userData.treasury + amount });
                replyComponent = new ContainerBuilder().setAccentColor(0x00FF00).addTextDisplayComponents(new TextDisplayBuilder().setContent(`You successfully stashed **${amount.toLocaleString()} ₿**.`));
            }
        } else if (action === 'haul') {
            if (amount > userData.treasury) {
                replyComponent = new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(new TextDisplayBuilder().setContent("You don't have that much in your treasury."));
            } else {
                db.updateUser(interaction.user.id, { treasury: userData.treasury - amount, wallet: userData.wallet + amount });
                replyComponent = new ContainerBuilder().setAccentColor(0x00FF00).addTextDisplayComponents(new TextDisplayBuilder().setContent(`You successfully hauled **${amount.toLocaleString()} ₿**.`));
            }
        }

        await interaction.reply({ components: [replyComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }
};
