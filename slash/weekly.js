const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly reward.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);

        const now = new Date();
        const lastWeekly = userData.lastWeekly ? new Date(userData.lastWeekly) : null;

        // Calculate the last Saturday 6 AM UTC reset time
        let lastReset = new Date(now);
        const dayOfWeek = lastReset.getUTCDay(); // 0=Sun, 6=Sat
        const daysToSubtract = (dayOfWeek < 6) ? dayOfWeek + 1 : 0;
        lastReset.setUTCDate(lastReset.getUTCDate() - daysToSubtract);
        lastReset.setUTCHours(6, 0, 0, 0);

        if (now < lastReset) {
             lastReset.setUTCDate(lastReset.getUTCDate() - 7);
        }

        // --- Cooldown Check ---
        if (lastWeekly && lastWeekly > lastReset) {
            const nextReset = new Date(lastReset);
            nextReset.setUTCDate(nextReset.getUTCDate() + 7);
            const timestamp = Math.floor(nextReset.getTime() / 1000);

            const cooldownComponent = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('**Weekly Reward Already Claimed**').setHeadingLevel(2),
                    new TextDisplayBuilder().setContent(`You can claim your next weekly reward <t:${timestamp}:R>.`)
                );
            return interaction.reply({ components: [cooldownComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        // --- Reward and Update ---
        const reward = 10000;
        db.updateUser(userId, {
            wallet: userData.wallet + reward,
            lastWeekly: now.toISOString()
        });

        // --- Send Confirmation ---
        const rewardComponent = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('**Weekly Reward Claimed!**').setHeadingLevel(1),
                new TextDisplayBuilder().setContent(`You have successfully claimed your weekly reward of **${reward.toLocaleString()} ₿**!`)
            );

        await interaction.reply({ components: [rewardComponent], flags: MessageFlags.IsComponentsV2 });
    },
};
