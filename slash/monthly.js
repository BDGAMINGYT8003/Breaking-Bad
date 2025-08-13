const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monthly')
        .setDescription('Claim your monthly reward.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);

        const now = new Date();
        const lastMonthly = userData.lastMonthly ? new Date(userData.lastMonthly) : null;

        // Calculate the last 1st of the month at 6 AM UTC reset time
        let lastReset = new Date(now);
        lastReset.setUTCDate(1);
        lastReset.setUTCHours(6, 0, 0, 0);

        if (now < lastReset) {
            // If we are before the 1st @ 6AM of the current month, the last reset was the previous month.
            lastReset.setUTCMonth(lastReset.getUTCMonth() - 1);
        }

        // --- Cooldown Check ---
        if (lastMonthly && lastMonthly > lastReset) {
            const nextReset = new Date(lastReset);
            nextReset.setUTCMonth(nextReset.getUTCMonth() + 1);
            const timestamp = Math.floor(nextReset.getTime() / 1000);

            const cooldownComponent = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('**Monthly Reward Already Claimed**').setHeadingLevel(2),
                    new TextDisplayBuilder().setContent(`You can claim your next monthly reward <t:${timestamp}:R>.`)
                );
            return interaction.reply({ components: [cooldownComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        // --- Reward and Update ---
        const reward = 50000;
        db.updateUser(userId, {
            wallet: userData.wallet + reward,
            lastMonthly: now.toISOString()
        });

        // --- Send Confirmation ---
        const rewardComponent = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('**Monthly Reward Claimed!**').setHeadingLevel(1),
                new TextDisplayBuilder().setContent(`You have successfully claimed your monthly reward of **${reward.toLocaleString()} ₿**!`)
            );

        await interaction.reply({ components: [rewardComponent], flags: MessageFlags.IsComponentsV2 });
    },
};
